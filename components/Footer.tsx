import Link from "next/link";
import { FOOTER_COLUMNS } from "@/lib/site-data";

export default function Footer() {
  return (
    <footer
      className="relative mt-24 border-t border-black/5 bg-cover bg-bottom"
      style={{ backgroundImage: "url(/footer/bg-footer-pattern.png)" }}
    >
      <div className="container-1440 px-5 min-[476px]:px-8 pt-16 pb-10">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="font-display text-[20px] font-semibold tracking-[-0.02em] text-[var(--text)]">
              Helm
            </div>
            <p className="mt-3 max-w-[28ch] font-display text-[14px] leading-[1.5] text-[var(--text-50)]">
              Automate with SOC&nbsp;2 compliant security.
            </p>
            <span className="mt-4 inline-flex items-center gap-2 surface-gradient-chip rounded-full px-3 py-1.5 font-mono text-[11px] text-[var(--text-70)]">
              ◆ SOC 2
            </span>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-50)]">
                {col.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <Link
                      href="#"
                      className="font-display text-[15px] text-[var(--text-70)] transition-colors hover:text-[var(--text)]"
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="divider-etched my-8" />

        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="font-display text-[13px] text-[var(--text-50)]">
            Copyright © 2026 Helm
          </p>
          <div className="flex items-center gap-5">
            <span className="font-display text-[13px] text-[var(--text-50)]">
              Design by Altalogy
            </span>
            <Link href="#" aria-label="X" className="text-[var(--text-50)] hover:text-[var(--text)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </Link>
            <Link href="#" aria-label="LinkedIn" className="text-[var(--text-50)] hover:text-[var(--text)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.555V9h3.559z" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
