"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/lib/site-data";
import { LightButton } from "@/components/ui/primitives";

export default function Header() {
  const pathname = usePathname();
  // Only the home page has the dark pixel-art hero behind a transparent header.
  // Every other page has a light background, so the header must start solid/dark.
  const overHero = pathname === "/";
  // Only the hero page starts transparent and turns solid past 24px; every other
  // page is solid from the start. `scrolled` is derived (no setState-in-effect).
  const [scrolledPast, setScrolledPast] = useState(false);

  useEffect(() => {
    if (!overHero) return;
    const onScroll = () => setScrolledPast(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overHero]);

  const scrolled = !overHero || scrolledPast;

  return (
    <header
      className="fixed inset-x-0 top-0 z-[201] transition-[background,box-shadow,border-color] duration-300"
      style={
        scrolled
          ? {
              background: "rgba(245,245,242,0.82)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 1px 0 rgba(0,0,0,0.06)",
            }
          : { background: "transparent" }
      }
    >
      <div className="container-1440 flex items-center justify-between px-5 min-[476px]:px-8 pt-[22px] pb-[20px]">
        {/* Wordmark */}
        <Link href="/" className="flex items-center gap-2" aria-label="Helm home">
          <Wordmark dark={scrolled} />
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className={
                scrolled
                  ? "text-embossed font-display text-[15px] tracking-[0.15px]"
                  : "font-display text-[15px] tracking-[0.15px] text-white/85 hover:text-white transition-colors [text-shadow:0_1px_1px_rgba(0,0,0,0.18)]"
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className={
              scrolled
                ? "text-embossed font-display text-[15px] hidden sm:inline"
                : "font-display text-[15px] text-white/85 hover:text-white transition-colors hidden sm:inline [text-shadow:0_1px_1px_rgba(0,0,0,0.18)]"
            }
          >
            Log in
          </Link>
          <Link href="/app">
            <LightButton as="span" className="w-[130px]">
              Run a company
            </LightButton>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Wordmark({ dark }: { dark: boolean }) {
  const fill = dark ? "rgba(38,35,35,0.85)" : "#ffffff";
  // Rectilinear pixel-grid "Helm" mark approximation
  return (
    <span
      className="font-display font-semibold tracking-[-0.02em] text-[20px]"
      style={{ color: fill, textShadow: dark ? "none" : "0 1px 1px rgba(0,0,0,0.18)" }}
    >
      Helm
    </span>
  );
}
