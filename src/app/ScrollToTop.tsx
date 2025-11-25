"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // jeśli chcesz bez animacji:
    window.scrollTo(0, 0);

    // albo z animacją:
    // window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [pathname]);

  return null;
}
