// src/shared/playerProfileProgress.ts

/**
 * Wspólny licznik „wypełnienia profilu” – używany:
 *  - w tabeli MyPlayersFeature (kolumna „Wypełnienie profilu”)
 *  - w headerze PlayerEditorPage („Postęp profilu”)
 *
 * Opiera się na tym samym podziale co w edytorze:
 *  - Krok 1: dane bazowe
 *  - Krok 2: rozszerzone
 *  - Krok 3: ocena
 */
export function computePlayerProfileProgress(player: any): number {
  const meta = player?.meta ?? {};
  const basic = meta.basic ?? {};
  const ext = meta.extended ?? {};
  const ratings = meta.ratings ?? {};
  const notes = meta.notes ?? "";
  const unknownNote = meta.unknownNote ?? "";

  const toStr = (v: any): string =>
    v == null ? "" : typeof v === "string" ? v : String(v);

  // ====== podstawowe pola (jak w PlayerEditorPage) ======
  const firstName = toStr(basic.firstName ?? player.firstName);
  const lastName = toStr(basic.lastName ?? player.lastName);
  const birthYear = toStr(basic.birthYear ?? player.birthDate);
  const club = toStr(basic.club ?? player.club);
  const clubCountry = toStr(basic.clubCountry ?? player.nationality);
  const jerseyNumber = toStr(basic.jerseyNumber);

  // tryb profilu (known / unknown) – najpierw meta.mode, potem heurystyka
  let choice: "known" | "unknown" | null =
    meta.mode === "known" || meta.mode === "unknown" ? meta.mode : null;

  if (!choice) {
    const hasPersonal =
      firstName.trim() !== "" ||
      lastName.trim() !== "" ||
      birthYear.trim() !== "";

    const hasAnon =
      jerseyNumber.trim() !== "" ||
      toStr(unknownNote).trim() !== "" ||
      (!hasPersonal &&
        (club.trim() !== "" || clubCountry.trim() !== ""));

    if (hasPersonal && !hasAnon) choice = "known";
    else if (!hasPersonal && hasAnon) choice = "unknown";
    else if (hasPersonal && hasAnon) choice = "known";
    else choice = null;
  }

  const countTruthy = (vals: unknown[]): number =>
    vals.filter((v) => {
      if (typeof v === "number") return v > 0;
      return !!(v != null && String(v).trim() !== "");
    }).length;

  // --- KROK 1: bazowe (identyczne jak w edytorze) ---
  const cntBasicKnown = countTruthy([
    firstName,
    lastName,
    birthYear,
    club,
    clubCountry,
  ]);
  const cntBasicUnknown = countTruthy([
    jerseyNumber,
    club,
    clubCountry,
    unknownNote,
  ]);

  const badgeBasic =
    choice === "unknown"
      ? cntBasicUnknown
      : choice === "known"
      ? cntBasicKnown
      : 0;
  const basicMax = choice === "unknown" ? 4 : choice === "known" ? 5 : 0;

  // --- KROK 2: rozszerzone (profil + eligibility + stats + kontakt) ---
  const cntProfile = countTruthy([
    ext.height,
    ext.weight,
    ext.dominantFoot,
    ext.mainPos,
    Array.isArray(ext.altPositions) && ext.altPositions.length > 0 ? 1 : "",
  ]);

  const cntEligibility = countTruthy([
    ext.english === true ? "yes" : "",
    ext.euPassport === true ? "yes" : "",
    ext.birthCountry,
    ext.contractStatus,
    ext.agency,
    ext.releaseClause,
    ext.leagueLevel,
    ext.clipsLinks,
    ext.transfermarkt,
    ext.wyscout,
  ]);

  const cntStats365 = countTruthy([
    ext.injuryHistory,
    ext.minutes365,
    ext.starts365,
    ext.subs365,
    ext.goals365,
  ]);

  const cntContact = countTruthy([
    ext.phone,
    ext.email,
    ext.fb,
    ext.ig,
    ext.tiktok,
  ]);

  const totalExt = cntProfile + cntEligibility + cntStats365 + cntContact;
  const totalExtMax = 5 + 10 + 5 + 5; // jak w PlayerEditorPage

  // --- KROK 3: ocena ---
  const ratingValues = Object.values(ratings ?? {});
  const cntRatingsFilled = countTruthy(ratingValues);
  const cntGradeBadge =
    Number(Boolean(toStr(notes))) + cntRatingsFilled;

  // Tutaj nie mamy ratingConfig z frontu, więc:
  // - bierzemy liczbę slotów jako max(liczba kluczy, 6) – stabilna baza
  const ratingSlots = Math.max(
    Object.keys(ratings ?? {}).length,
    ratingValues.length,
    6
  );
  const cntGradeMax = 1 + ratingSlots; // +1 za same notatki

  // --- globalny procent ---
  let done = 0;
  let max = 0;

  if (basicMax > 0) {
    done += badgeBasic;
    max += basicMax;
  }
  if (totalExtMax > 0) {
    done += totalExt;
    max += totalExtMax;
  }
  if (cntGradeMax > 0) {
    done += cntGradeBadge;
    max += cntGradeMax;
  }

  if (!max) return 0;

  const raw = (done / max) * 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}
