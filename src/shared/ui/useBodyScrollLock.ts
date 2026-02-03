// src/shared/ui/useBodyScrollLock.ts
"use client";

import { useEffect } from "react";

let __lockCount = 0;

function isMobileViewport(maxPx = 640) {
  if (typeof window === "undefined") return false;
  return window.matchMedia(`(max-width:${maxPx - 1}px)`).matches;
}

/**
 * Solidny lock na mobile (iOS-friendly):
 * - body: position fixed + top = -scrollY
 * - ref-count: wiele overlayów naraz
 */
export function lockBodyScroll() {
  if (typeof window === "undefined") return;

  __lockCount += 1;
  if (__lockCount > 1) return;

  const body = document.body;
  const html = document.documentElement;

  const scrollY = window.scrollY || window.pageYOffset || 0;

  body.dataset.scrollLockY = String(scrollY);
  body.dataset.scrollLockOverflow = body.style.overflow || "";
  body.dataset.scrollLockPosition = body.style.position || "";
  body.dataset.scrollLockTop = body.style.top || "";
  body.dataset.scrollLockWidth = body.style.width || "";

  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.width = "100%";

  // mniej “bounce” na mobile
  html.style.overscrollBehavior = "contain";
}

export function unlockBodyScroll() {
  if (typeof window === "undefined") return;

  __lockCount = Math.max(0, __lockCount - 1);
  if (__lockCount > 0) return;

  const body = document.body;
  const html = document.documentElement;

  const y = Number(body.dataset.scrollLockY || "0") || 0;

  body.style.overflow = body.dataset.scrollLockOverflow || "";
  body.style.position = body.dataset.scrollLockPosition || "";
  body.style.top = body.dataset.scrollLockTop || "";
  body.style.width = body.dataset.scrollLockWidth || "";

  delete body.dataset.scrollLockY;
  delete body.dataset.scrollLockOverflow;
  delete body.dataset.scrollLockPosition;
  delete body.dataset.scrollLockTop;
  delete body.dataset.scrollLockWidth;

  html.style.overscrollBehavior = "";

  window.scrollTo(0, y);
}

/**
 * Hook: blokuj scroll gdy `locked === true` (opcjonalnie tylko na mobile).
 */
export function useBodyScrollLock(
  locked: boolean,
  opts?: { mobileOnly?: boolean; mobileMaxPx?: number },
) {
  const mobileOnly = opts?.mobileOnly ?? true;
  const mobileMaxPx = opts?.mobileMaxPx ?? 640;

  useEffect(() => {
    if (!locked) return;

    if (mobileOnly && !isMobileViewport(mobileMaxPx)) return;

    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [locked, mobileOnly, mobileMaxPx]);
}
