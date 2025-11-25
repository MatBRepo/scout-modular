"use client";
import React from "react";
import Link from "next/link";
import type { ReactNode } from "react";

type ToolbarProps = {
  title: ReactNode;          // was string
  subtitle?: ReactNode;      // was string
  right?: ReactNode;
};

export function Crumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="mb-4 text-sm text-dark dark:text-neutral-400">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1">
            {it.href ? <Link href={it.href} className="hover:underline">{it.label}</Link> : <span className="text-gray-700 dark:text-neutral-200">{it.label}</span>}
            {i < items.length - 1 ? <span>/</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}


export function Toolbar({ title, subtitle, right }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between">
      <div>
        {/* If you had <h2> here, keep it, but render the node */}
        {typeof title === "string" ? <h2 className="text-2xl font-semibold mb-2">{title}</h2> : title}
        {subtitle ? (
          typeof subtitle === "string" ? (
            <div className="text-sm text-muted-foreground">{subtitle}</div>
          ) : (
            subtitle
          )
        ) : null}
      </div>
      {right}
    </div>
  );
}

export function GrayTag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">{children}</span>;
}
