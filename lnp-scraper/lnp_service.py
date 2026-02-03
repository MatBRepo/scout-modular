from __future__ import annotations

import asyncio
import os
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from playwright.async_api import async_playwright, BrowserContext, Page

# --- Windows fix: ensure subprocess works (Playwright driver) ---
if os.name == "nt":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())  # type: ignore[attr-defined]
    except Exception:
        pass

BASE_SITE = "https://www.laczynaspilka.pl"
BASE_API = "https://competition-api-pro.laczynaspilka.pl/api/bus/competition/v1"

DEBUG = os.getenv("DEBUG", "").strip().lower() in ("1", "true", "yes", "on")
HEADLESS = os.getenv("HEADLESS", "").strip().lower() not in ("0", "false", "no", "off")

# Persistent profile (cookies/localStorage) – critical for recaptcha stability
LNP_USER_DATA_DIR = os.getenv("LNP_USER_DATA_DIR", "./.lnp-profile").strip()

# If 1 => you run once headful and can solve challenge manually
LNP_INTERACTIVE = os.getenv("LNP_INTERACTIVE", "").strip().lower() in ("1", "true", "yes", "on")

# Stability tuning
TOKEN_TTL_MS = int(os.getenv("TOKEN_TTL_MS", "15000"))
CAPTURE_WAIT_MS = int(os.getenv("CAPTURE_WAIT_MS", "12000"))
CAPTURE_RETRIES = int(os.getenv("CAPTURE_RETRIES", "3"))
PLAYWRIGHT_RESTART_RETRIES = int(os.getenv("PLAYWRIGHT_RESTART_RETRIES", "2"))

UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-"
    r"[0-9a-fA-F]{4}-"
    r"[0-9a-fA-F]{4}-"
    r"[0-9a-fA-F]{4}-"
    r"[0-9a-fA-F]{12}$"
)


def is_uuid(v: Any) -> bool:
    return isinstance(v, str) and bool(UUID_RE.match(v))


def dprint(*args):
    if DEBUG:
        print("[DEBUG]", *args, flush=True)


def now_ms() -> int:
    return int(time.time() * 1000)


@dataclass
class TokenState:
    token: str = ""
    token_src: str = ""
    token_at_ms: int = 0


class TokenProvider:
    """
    Captures Bearer token by loading LNP page and listening to requests.
    Uses persistent profile (user_data_dir) to survive recaptcha.
    Keeps separate token state per sex (Male/Female) and separate page per sex.
    Auto-restarts Playwright if driver connection drops.
    """

    def __init__(self):
        self._pw = None
        self._ctx: Optional[BrowserContext] = None
        self._pages: Dict[str, Page] = {}
        self._state_by_sex: Dict[str, TokenState] = {}
        self._locks: Dict[str, asyncio.Lock] = {}

        # bookkeeping for recaptcha diagnostics
        self._last_recaptcha_at: Dict[str, int] = {"Male": 0, "Female": 0}

    def state(self, sex: str) -> TokenState:
        return self._state_by_sex.get(sex) or TokenState()

    def _lock(self, sex: str) -> asyncio.Lock:
        if sex not in self._locks:
            self._locks[sex] = asyncio.Lock()
        return self._locks[sex]

    async def start(self):
        if self._pw and self._ctx:
            return

        dprint("Starting Playwright… headless=", HEADLESS, "interactive=", LNP_INTERACTIVE, "profile=", LNP_USER_DATA_DIR)

        self._pw = await async_playwright().start()

        # Launch persistent context (profile)
        chromium = self._pw.chromium
        self._ctx = await chromium.launch_persistent_context(
            user_data_dir=LNP_USER_DATA_DIR,
            headless=HEADLESS,
            viewport={"width": 1280, "height": 720},
            locale="pl-PL",
            timezone_id="Europe/Warsaw",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ],
        )
        self._ctx.set_default_timeout(25000)

        # create pages per sex lazily in refresh()

    async def stop(self):
        try:
            for _, p in list(self._pages.items()):
                try:
                    await p.close()
                except Exception:
                    pass
            self._pages.clear()

            if self._ctx:
                await self._ctx.close()
        finally:
            self._ctx = None

        try:
            if self._pw:
                await self._pw.stop()
        finally:
            self._pw = None

    async def _restart(self):
        dprint("Restarting Playwright driver/context…")
        await self.stop()
        await self.start()

    async def _ensure_page(self, sex: str) -> Page:
        if not self._ctx:
            raise RuntimeError("TokenProvider not started")

        if sex in self._pages:
            return self._pages[sex]

        page = await self._ctx.new_page()

        # Attach request listener dedicated for this sex
        async def on_request(req):
            url = req.url
            if "competition-api-pro.laczynaspilka.pl" not in url:
                return

            auth = req.headers.get("authorization") or req.headers.get("Authorization")
            if auth and auth.lower().startswith("bearer "):
                tok = auth.split(" ", 1)[1].strip()
                if tok and tok.count(".") >= 2:
                    self._state_by_sex[sex] = TokenState(token=tok, token_src=url, token_at_ms=now_ms())
                    dprint(f"Captured Bearer [{sex}] from:", url)
            else:
                if "/Authorize/recaptcha" in url:
                    self._last_recaptcha_at[sex] = now_ms()
                    if DEBUG:
                        dprint(f"REQ(no-auth) [{sex}]:", url)

        page.on("request", on_request)

        self._pages[sex] = page
        return page

    async def refresh(self, sex: str) -> TokenState:
        async with self._lock(sex):
            # someone might have refreshed already
            st = self.state(sex)
            if st.token and (now_ms() - st.token_at_ms) <= TOKEN_TTL_MS:
                return st

            last_err: Optional[Exception] = None

            for pw_restart_try in range(0, PLAYWRIGHT_RESTART_RETRIES + 1):
                if pw_restart_try > 0:
                    await self._restart()

                page = await self._ensure_page(sex)

                for attempt in range(1, CAPTURE_RETRIES + 1):
                    ts = now_ms()
                    url = f"{BASE_SITE}/rozgrywki?isAdvanceMode=false&genderType={sex}&__ts={ts}"
                    dprint(f"Refreshing token [{sex}] (attempt {attempt}/{CAPTURE_RETRIES}) -> {url}")

                    try:
                        await page.goto(url, wait_until="domcontentloaded")
                        await page.wait_for_timeout(250)

                        # Detect LNP internal 404 route (often bot/recaptcha flow)
                        cur_url = (page.url or "").lower()
                        if "/rozgrywki/404" in cur_url:
                            msg = (
                                "LNP przekierowuje do /rozgrywki/404 (anti-bot/recaptcha). "
                                "Uruchom serwis raz w trybie interaktywnym: HEADLESS=0 i LNP_INTERACTIVE=1 "
                                "i w otwartej przeglądarce przejdź ewentualny challenge. "
                                "Potem możesz wrócić na HEADLESS=1."
                            )
                            raise RuntimeError(msg)

                        # Wait for bearer to appear
                        deadline = now_ms() + CAPTURE_WAIT_MS
                        while now_ms() < deadline:
                            st = self.state(sex)
                            if st.token and (now_ms() - st.token_at_ms) < CAPTURE_WAIT_MS:
                                return st
                            await page.wait_for_timeout(100)

                        # No bearer
                        # If we saw recaptcha recently, likely blocked
                        if (now_ms() - self._last_recaptcha_at.get(sex, 0)) < CAPTURE_WAIT_MS:
                            if HEADLESS and not LNP_INTERACTIVE:
                                raise RuntimeError(
                                    "Nie złapano Bearer tokena: widać /Authorize/recaptcha (anti-bot). "
                                    "Odpal raz: HEADLESS=0 oraz LNP_INTERACTIVE=1 i przejdź challenge w oknie przeglądarki."
                                )

                            # interactive mode: keep window; user can click/solve
                            if LNP_INTERACTIVE and not HEADLESS:
                                dprint("Interactive mode: waiting longer for manual challenge…")
                                # wait extra 60s for manual solve
                                extra_deadline = now_ms() + 60000
                                while now_ms() < extra_deadline:
                                    st = self.state(sex)
                                    if st.token and (now_ms() - st.token_at_ms) < 60000:
                                        return st
                                    await page.wait_for_timeout(200)

                        raise RuntimeError("No bearer captured (timeout).")
                    except Exception as e:
                        last_err = e
                        dprint("Token refresh failed:", repr(e))
                        # small backoff
                        await asyncio.sleep(0.35)

                # try pw restart loop (driver may have died)
                dprint("All capture retries failed; will try restarting Playwright (if allowed).")

            raise RuntimeError(f"No bearer captured after retries. Last error: {last_err!r}")


class ApiClient:
    """
    Async HTTP client (httpx) + auto refresh on 401.
    """

    def __init__(self, tp: TokenProvider):
        self.tp = tp
        self.client: Optional[httpx.AsyncClient] = None

    async def start(self):
        if self.client:
            return
        limits = httpx.Limits(max_connections=25, max_keepalive_connections=10)
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(25.0),
            limits=limits,
            headers={
                "accept": "application/json, text/plain, */*",
                "origin": BASE_SITE,
                "referer": BASE_SITE + "/",
                "user-agent": "Mozilla/5.0",
            },
            follow_redirects=False,
        )

    async def stop(self):
        if self.client:
            await self.client.aclose()
        self.client = None

    async def ensure_token(self, sex: str):
        st = self.tp.state(sex)
        if not st.token or (now_ms() - st.token_at_ms) > TOKEN_TTL_MS:
            await self.tp.refresh(sex)

    def _auth_headers(self, sex: str) -> Dict[str, str]:
        st = self.tp.state(sex)
        return {"authorization": f"Bearer {st.token}"}

    async def get_json(self, sex: str, path: str) -> Any:
        if not self.client:
            raise RuntimeError("ApiClient not started")

        try:
            await self.ensure_token(sex)
        except RuntimeError as e:
            raise HTTPException(status_code=503, detail=str(e))

        url = BASE_API + path
        dprint(
            "GET", path,
            "token_age=", (now_ms() - self.tp.state(sex).token_at_ms), "ms",
            "token_src=", self.tp.state(sex).token_src
        )

        r = await self.client.get(url, headers=self._auth_headers(sex))
        if r.status_code == 401:
            dprint("401 for", path, "-> refresh + retry")
            try:
                await self.tp.refresh(sex)
            except RuntimeError as e:
                raise HTTPException(status_code=503, detail=str(e))
            r = await self.client.get(url, headers=self._auth_headers(sex))

        if r.status_code >= 400:
            body = (r.text or "").strip()
            raise HTTPException(status_code=r.status_code, detail=body or "error")

        txt = (r.text or "").strip()
        return r.json() if txt else None


def normalize_seasons(data: Any) -> List[Dict[str, Any]]:
    if isinstance(data, dict):
        for k in ("seasons", "items", "data", "result"):
            if isinstance(data.get(k), list):
                data = data[k]
                break
    if not isinstance(data, list):
        return []
    out = []
    for it in data:
        if not isinstance(it, dict):
            continue
        sid = it.get("id") or it.get("seasonId")
        name = it.get("name") or it.get("seasonName")
        cur = it.get("isCurrent") if "isCurrent" in it else it.get("current")
        if sid and name:
            out.append({"id": sid, "name": name, "isCurrent": bool(cur)})
    return out


def normalize_league_groups(data: Any) -> List[Dict[str, Any]]:
    items = []
    if isinstance(data, dict):
        for k in ("items", "data", "result", "leagueGroups", "groups"):
            if isinstance(data.get(k), list):
                items = data[k]
                break
    elif isinstance(data, list):
        items = data

    leagues = []
    for g in items:
        if not isinstance(g, dict):
            continue
        gname = g.get("name") or g.get("groupName") or g.get("title") or ""
        arr = g.get("leagues") or g.get("items") or []
        if isinstance(arr, dict):
            arr = list(arr.values())
        if not isinstance(arr, list):
            arr = []
        for l in arr:
            if not isinstance(l, dict):
                continue
            lid = l.get("id") or l.get("leagueId")
            lname = l.get("name") or l.get("leagueName") or l.get("title")
            if lid and lname:
                leagues.append({"group": gname, "league": lname, "league_id": lid})

    leagues = [x for x in leagues if x.get("league_id")]

    seen = set()
    out = []
    for l in leagues:
        if l["league_id"] in seen:
            continue
        seen.add(l["league_id"])
        out.append(l)
    return out


def normalize_play_dictionaries(data: Any) -> List[Dict[str, Any]]:
    items = []
    if isinstance(data, dict):
        for k in ("items", "data", "result", "playDictionaries", "plays"):
            if isinstance(data.get(k), list):
                items = data[k]
                break
    elif isinstance(data, list):
        items = data
    out = []
    for it in items:
        if not isinstance(it, dict):
            continue
        pid = it.get("id") or it.get("playDictionaryId") or it.get("playId")
        name = it.get("name") or it.get("title")
        if pid and name:
            out.append({"id": pid, "name": name})
    return out


def extract_teams(payload: Any) -> List[Dict[str, Any]]:
    teams: List[Dict[str, Any]] = []

    def add_team(tid: Any, name: Any, points: Any = None):
        if not is_uuid(tid):
            return
        if not isinstance(name, str) or not name.strip():
            return
        teams.append({"team": name.strip(), "team_id": tid, "points": points})

    def scan(obj: Any):
        if isinstance(obj, dict):
            tid = obj.get("teamId") or obj.get("team_id")
            tname = obj.get("teamName") or obj.get("team_name")
            pts = obj.get("points") or obj.get("pts")
            if tid and tname:
                add_team(tid, tname, pts)

            for key in ("team", "club", "teamDto", "clubDto"):
                sub = obj.get(key)
                if isinstance(sub, dict):
                    stid = sub.get("id") or sub.get("teamId") or sub.get("clubId")
                    sname = sub.get("name") or sub.get("teamName") or sub.get("clubName") or sub.get("shortName")
                    add_team(stid, sname, obj.get("points") or obj.get("pts"))

            for v in obj.values():
                scan(v)

        elif isinstance(obj, list):
            for it in obj:
                scan(it)

    scan(payload)

    seen = set()
    uniq = []
    for t in teams:
        if t["team_id"] in seen:
            continue
        seen.add(t["team_id"])
        uniq.append(t)
    return uniq


def normalize_players(data: Any) -> List[Dict[str, Any]]:
    items = []
    if isinstance(data, dict):
        for k in ("items", "data", "result", "players"):
            if isinstance(data.get(k), list):
                items = data[k]
                break
    elif isinstance(data, list):
        items = data

    out = []
    for it in items:
        if not isinstance(it, dict):
            continue
        pid = it.get("id") or it.get("playerId")
        out.append(
            {
                "player_id": pid,
                "firstname": it.get("firstName") or it.get("firstname") or "",
                "lastname": it.get("lastName") or it.get("lastname") or "",
                "name": (it.get("name") or "").strip() or None,
                "number": it.get("number") or it.get("shirtNumber"),
                "position": it.get("position") or it.get("pos"),
                "club": it.get("clubName") or it.get("teamName") or None,
            }
        )
    return out


# ---------- FastAPI ----------
app = FastAPI(title="LNP Scraper Service")

tp = TokenProvider()
api = ApiClient(tp)


@app.exception_handler(RuntimeError)
async def runtime_error_handler(_: Request, exc: RuntimeError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.on_event("startup")
async def _startup():
    await tp.start()
    await api.start()


@app.on_event("shutdown")
async def _shutdown():
    await api.stop()
    await tp.stop()


@app.get("/health")
async def health():
    return {
        "ok": True,
        "headless": HEADLESS,
        "interactive": LNP_INTERACTIVE,
        "debug": DEBUG,
        "token_ttl_ms": TOKEN_TTL_MS,
        "capture_wait_ms": CAPTURE_WAIT_MS,
        "capture_retries": CAPTURE_RETRIES,
        "profile_dir": LNP_USER_DATA_DIR,
    }


@app.get("/seasons")
async def seasons(sex: str = Query("Male", pattern="^(Male|Female)$")):
    data = await api.get_json(sex, "/seasons/dictionaries")
    return normalize_seasons(data)


@app.get("/leagues")
async def leagues(sex: str = Query("Male", pattern="^(Male|Female)$"), seasonId: str = ""):
    if not is_uuid(seasonId):
        raise HTTPException(status_code=400, detail="Invalid seasonId")
    data = await api.get_json(sex, f"/leagues/seasons/{seasonId}/sexes/{sex}/league-groups")
    return normalize_league_groups(data)


@app.get("/plays")
async def plays(
    sex: str = Query("Male", pattern="^(Male|Female)$"),
    seasonId: str = "",
    leagueId: str = "",
):
    if not is_uuid(seasonId):
        raise HTTPException(status_code=400, detail="Invalid seasonId")
    if not is_uuid(leagueId):
        raise HTTPException(status_code=400, detail="Invalid leagueId")
    data = await api.get_json(sex, f"/leagues/{leagueId}/seasons/{seasonId}/play-dictionaries")
    return normalize_play_dictionaries(data)


async def _teams_autodiscovery(sex: str, play_id: str) -> List[Dict[str, Any]]:
    payload = await api.get_json(sex, f"/plays/{play_id}/tables")
    teams = extract_teams(payload)
    if teams:
        return teams

    # fallback: try queues
    try:
        q = await api.get_json(sex, f"/plays/{play_id}/queues")
        qids: List[str] = []

        def scan(x):
            if isinstance(x, dict):
                for k, v in x.items():
                    if is_uuid(v) and ("queue" in k.lower() or k.lower() == "id"):
                        qids.append(v)
                    scan(v)
            elif isinstance(x, list):
                for it in x:
                    scan(it)

        scan(q)
        qids = list(dict.fromkeys(qids))[:6]
        for qid in qids:
            payload = await api.get_json(sex, f"/plays/{play_id}/tables?queue={qid}")
            teams = extract_teams(payload)
            if teams:
                return teams
    except Exception:
        pass

    raise HTTPException(status_code=404, detail="Cannot discover teams table for this play")


@app.get("/teams")
async def teams(
    sex: str = Query("Male", pattern="^(Male|Female)$"),
    seasonId: str = "",
    leagueId: str = "",
    playId: str = "",
):
    if not is_uuid(playId):
        raise HTTPException(status_code=400, detail="Invalid playId")
    return await _teams_autodiscovery(sex, playId)


@app.get("/players")
async def players(teamId: str, sex: str = Query("Male", pattern="^(Male|Female)$")):
    if not is_uuid(teamId):
        raise HTTPException(status_code=400, detail="Invalid teamId")
    data = await api.get_json(sex, f"/teams/{teamId}/players")
    return normalize_players(data)


@app.get("/players/{playerId}/seasons/{seasonId}/leagues/{leagueId}/stats")
async def player_stats(
    playerId: str,
    seasonId: str,
    leagueId: str,
    sex: str = Query("Male", pattern="^(Male|Female)$"),
):
    if not is_uuid(playerId):
        raise HTTPException(status_code=400, detail="Invalid playerId")
    if not is_uuid(seasonId):
        raise HTTPException(status_code=400, detail="Invalid seasonId")
    if not is_uuid(leagueId):
        raise HTTPException(status_code=400, detail="Invalid leagueId")
    return await api.get_json(sex, f"/players/{playerId}/seasons/{seasonId}/leagues/{leagueId}/stats")


class StatsBatchBody(BaseModel):
    seasonId: str
    leagueId: str
    players: List[str]


@app.post("/player-stats/batch")
async def player_stats_batch(body: StatsBatchBody, sex: str = Query("Male", pattern="^(Male|Female)$")):
    if not is_uuid(body.seasonId):
        raise HTTPException(status_code=400, detail="Invalid seasonId")
    if not is_uuid(body.leagueId):
        raise HTTPException(status_code=400, detail="Invalid leagueId")

    pids = [p for p in body.players if is_uuid(p)]
    if not pids:
        return {}

    sem = asyncio.Semaphore(int(os.getenv("STATS_CONCURRENCY", "6")))

    async def one(pid: str):
        async with sem:
            try:
                stats = await api.get_json(sex, f"/players/{pid}/seasons/{body.seasonId}/leagues/{body.leagueId}/stats")
                return pid, {"stats": stats, "leagueId": body.leagueId}
            except Exception:
                return pid, {"stats": None, "leagueId": body.leagueId}

    pairs = await asyncio.gather(*(one(pid) for pid in pids))
    return {k: v for (k, v) in pairs}
