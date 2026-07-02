// Generates ALL of the site's decorative + card artwork as ORIGINAL SVGs.
//
// Every asset under public/ that used to be a raster mirrored from the live site
// is replaced by a vector authored here — so the repo ships nothing copyrighted,
// and the art is reproducible + tiny. Run: `npm run art:gen`.
//
// Design language: the app's warm "paper" palette (cream grounds, ink text) with
// a per-subject accent hue, soft layered gradients, and a faint grain filter for
// a printed feel. Deterministic — no randomness — so reruns are byte-stable.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = join(process.cwd(), "public");
const write = (rel, svg) => {
  const p = join(ROOT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, svg.trim() + "\n");
  return rel;
};

// ---- shared building blocks ------------------------------------------------

const PAPER = "#f6f1e7";
const INK = "#1a1712";

/** A reusable grain + soft-shadow defs block, id-namespaced so multiple inline
 *  SVGs on one page don't collide. */
const defs = (id, stops, angle = 135) => `
  <defs>
    <linearGradient id="g-${id}" gradientTransform="rotate(${angle} .5 .5)">
      ${stops.map((s, i) => `<stop offset="${(i / (stops.length - 1)) * 100}%" stop-color="${s}"/>`).join("")}
    </linearGradient>
    <filter id="grain-${id}"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.05"/></feComponentTransfer><feComposite operator="over" in2="SourceGraphic"/></filter>
  </defs>`;

// ---- department cards (8) — accent hue per function ------------------------

const DEPTS = {
  engineering: ["#e8eef7", "#b9c9e8", "#6f86c9"],
  sales: ["#f3ece0", "#e6c79b", "#c08a3e"],
  marketing: ["#f7e9ee", "#e9b7cb", "#c96f97"],
  design: ["#efeaf7", "#cfc0ec", "#9a80d6"],
  support: ["#e6f2ee", "#a9d6c6", "#5aa98d"],
  operations: ["#eef0ec", "#c7cdbd", "#8a927a"],
  finance: ["#e9f1ec", "#b3d6bf", "#5f9e77"],
  legal: ["#eeecef", "#c6c0cc", "#8a8296"],
};

function deptCard(name, [a, b, c]) {
  return `
<svg viewBox="0 0 480 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${name} department">
  ${defs(name, [a, b, c], 120)}
  <rect width="480" height="320" fill="url(#g-${name})"/>
  <g fill="none" stroke="${c}" stroke-opacity="0.5" stroke-width="1.5">
    <circle cx="360" cy="90" r="70"/><circle cx="360" cy="90" r="46"/><circle cx="360" cy="90" r="22"/>
  </g>
  <g fill="${INK}" fill-opacity="0.9">
    <rect x="40" y="212" width="150" height="9" rx="4.5"/>
    <rect x="40" y="234" width="96" height="9" rx="4.5" fill-opacity="0.45"/>
  </g>
  <rect x="40" y="70" width="46" height="46" rx="12" fill="${c}"/>
  <rect width="480" height="320" filter="url(#grain-${name})" opacity="0.6"/>
</svg>`;
}

// ---- brand-vibe swatches (6) — each expresses its named aesthetic ----------

function vibeEditorialMint() {
  return `
<svg viewBox="0 0 480 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Editorial mint">
  ${defs("vem", ["#eef6f0", "#dcefe4"], 90)}
  <rect width="480" height="320" fill="url(#g-vem)"/>
  <rect x="48" y="52" width="220" height="14" rx="7" fill="#123a2c"/>
  <rect x="48" y="80" width="150" height="14" rx="7" fill="#123a2c" fill-opacity="0.6"/>
  <line x1="48" y1="120" x2="432" y2="120" stroke="#5aa98d" stroke-width="2"/>
  <rect x="48" y="150" width="384" height="8" rx="4" fill="#1a1712" fill-opacity="0.28"/>
  <rect x="48" y="170" width="384" height="8" rx="4" fill="#1a1712" fill-opacity="0.28"/>
  <rect x="48" y="190" width="300" height="8" rx="4" fill="#1a1712" fill-opacity="0.28"/>
  <circle cx="392" cy="250" r="34" fill="#5aa98d"/>
  <rect width="480" height="320" filter="url(#grain-vem)" opacity="0.5"/>
</svg>`;
}
function vibeSaturatedTech() {
  return `
<svg viewBox="0 0 480 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Saturated tech">
  ${defs("vst", ["#1b1140", "#3b1d8a", "#7b3ff2"], 45)}
  <rect width="480" height="320" fill="url(#g-vst)"/>
  <g stroke="#b69cff" stroke-opacity="0.5" stroke-width="1">
    ${Array.from({ length: 9 }, (_, i) => `<line x1="${i * 60}" y1="0" x2="${i * 60}" y2="320"/>`).join("")}
    ${Array.from({ length: 6 }, (_, i) => `<line x1="0" y1="${i * 60}" x2="480" y2="${i * 60}"/>`).join("")}
  </g>
  <circle cx="240" cy="160" r="72" fill="none" stroke="#d8c9ff" stroke-width="3"/>
  <circle cx="240" cy="160" r="10" fill="#eee6ff"/>
  <rect width="480" height="320" filter="url(#grain-vst)" opacity="0.4"/>
</svg>`;
}
function vibeSoftPop() {
  return `
<svg viewBox="0 0 480 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Soft pop">
  ${defs("vsp", ["#fff3f8", "#ffe6d6"], 90)}
  <rect width="480" height="320" fill="url(#g-vsp)"/>
  <circle cx="150" cy="130" r="80" fill="#ff8fb1"/>
  <circle cx="300" cy="200" r="64" fill="#ffd166"/>
  <circle cx="360" cy="110" r="40" fill="#6fd6c4"/>
  <rect width="480" height="320" filter="url(#grain-vsp)" opacity="0.5"/>
</svg>`;
}
function vibeBrutalistGrid() {
  return `
<svg viewBox="0 0 480 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Brutalist grid">
  <rect width="480" height="320" fill="#eae7df"/>
  <g stroke="${INK}" stroke-width="3" fill="none">
    <rect x="24" y="24" width="432" height="272"/>
    <line x1="192" y1="24" x2="192" y2="296"/><line x1="336" y1="24" x2="336" y2="296"/>
    <line x1="24" y1="160" x2="456" y2="160"/>
  </g>
  <rect x="24" y="24" width="168" height="136" fill="${INK}"/>
  <rect x="336" y="160" width="120" height="136" fill="#d23b1f"/>
</svg>`;
}
function vibePastelUtility() {
  return `
<svg viewBox="0 0 480 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pastel utility">
  ${defs("vpu", ["#eef1f6", "#e3e8f0"], 90)}
  <rect width="480" height="320" fill="url(#g-vpu)"/>
  <rect x="40" y="48" width="180" height="224" rx="16" fill="#fff" stroke="#c9d2e0" stroke-width="1.5"/>
  <rect x="60" y="72" width="120" height="10" rx="5" fill="#8ea2c0"/>
  <rect x="60" y="96" width="90" height="10" rx="5" fill="#c2cddd"/>
  <rect x="248" y="48" width="192" height="104" rx="16" fill="#bcd3c9"/>
  <rect x="248" y="168" width="192" height="104" rx="16" fill="#e6c9b8"/>
  <rect width="480" height="320" filter="url(#grain-vpu)" opacity="0.4"/>
</svg>`;
}
function vibeHouseOfGlass() {
  return `
<svg viewBox="0 0 480 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="House of glass">
  ${defs("vhg", ["#dfe7ee", "#cdd9e6", "#b9c9dc"], 135)}
  <rect width="480" height="320" fill="url(#g-vhg)"/>
  <g fill="#ffffff" fill-opacity="0.35" stroke="#ffffff" stroke-opacity="0.6" stroke-width="1.5">
    <rect x="70" y="60" width="150" height="200" rx="18"/>
    <rect x="180" y="110" width="170" height="150" rx="18"/>
    <rect x="250" y="70" width="140" height="120" rx="18"/>
  </g>
  <rect width="480" height="320" filter="url(#grain-vhg)" opacity="0.3"/>
</svg>`;
}

// ---- chapter covers (4) — Start / Build / Sell / Scale ---------------------

function chapter(id, label, stops, motif) {
  return `
<svg viewBox="0 0 360 480" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">
  ${defs(id, stops, 160)}
  <rect width="360" height="480" fill="url(#g-${id})"/>
  <rect x="22" y="22" width="316" height="436" rx="10" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="1.5"/>
  ${motif}
  <text x="40" y="430" font-family="Georgia, 'Times New Roman', serif" font-size="34" fill="#fff" letter-spacing="1">${label}</text>
  <rect width="360" height="480" filter="url(#grain-${id})" opacity="0.5"/>
</svg>`;
}
const chapters = {
  start: chapter("cs", "Start", ["#2a2350", "#4a3a86"], `<circle cx="180" cy="190" r="70" fill="none" stroke="#e9deff" stroke-width="3"/><circle cx="180" cy="190" r="12" fill="#e9deff"/>`),
  build: chapter("cb", "Build", ["#123a3a", "#1f6a5e"], `<g fill="none" stroke="#d6f5ec" stroke-width="3"><rect x="120" y="140" width="120" height="120"/><line x1="120" y1="200" x2="240" y2="200"/><line x1="180" y1="140" x2="180" y2="260"/></g>`),
  sell: chapter("cse", "Sell", ["#5a2a1f", "#a5502f"], `<path d="M110 250 L180 130 L250 250 Z" fill="none" stroke="#ffe6d2" stroke-width="3"/><circle cx="180" cy="250" r="8" fill="#ffe6d2"/>`),
  scale: chapter("csc", "Scale", ["#1f2f5a", "#3f68b0"], `<g fill="#dbe6ff"><rect x="110" y="220" width="30" height="40"/><rect x="150" y="190" width="30" height="70"/><rect x="190" y="160" width="30" height="100"/><rect x="230" y="130" width="30" height="130"/></g>`),
};

// ---- hero (beacon), home banner, decorative bits --------------------------

const hero = `
<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Helm beacon">
  ${defs("hero", ["#221a44", "#3a2c74", "#6b53c6"], 160)}
  <rect width="1280" height="720" fill="url(#g-hero)"/>
  <!-- beacon light sweep -->
  <path d="M760 250 L1240 90 L1240 250 Z" fill="#ffe9b0" opacity="0.28"/>
  <path d="M760 250 L1240 250 L1240 430 Z" fill="#ffe9b0" opacity="0.16"/>
  <!-- horizon + water -->
  <rect y="470" width="1280" height="250" fill="#171232" opacity="0.55"/>
  <g stroke="#9d86e6" stroke-opacity="0.35" stroke-width="2">
    ${Array.from({ length: 6 }, (_, i) => `<line x1="0" y1="${500 + i * 34}" x2="1280" y2="${500 + i * 34}"/>`).join("")}
  </g>
  <!-- lighthouse (original geometric) -->
  <g transform="translate(720 210)">
    <rect x="26" y="40" width="28" height="230" fill="#efe8ff"/>
    <path d="M26 40 L54 40 L60 270 L20 270 Z" fill="#efe8ff"/>
    <rect x="14" y="90" width="52" height="26" fill="#c9502f"/>
    <rect x="14" y="150" width="52" height="26" fill="#c9502f"/>
    <rect x="20" y="10" width="40" height="34" rx="4" fill="#ffe9b0"/>
    <circle cx="40" cy="27" r="9" fill="#fff6dc"/>
  </g>
  <rect width="1280" height="720" filter="url(#grain-hero)" opacity="0.35"/>
</svg>`;

const homeBanner = `
<svg viewBox="0 0 1200 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="">
  ${defs("hb", ["#efe7d7", "#e7d9c2", "#d8c4a2"], 120)}
  <rect width="1200" height="400" fill="url(#g-hb)"/>
  <g fill="none" stroke="#b79b6e" stroke-opacity="0.5" stroke-width="2">
    <circle cx="980" cy="120" r="120"/><circle cx="980" cy="120" r="80"/><circle cx="980" cy="120" r="40"/>
  </g>
  <rect x="80" y="150" width="360" height="16" rx="8" fill="${INK}" fill-opacity="0.8"/>
  <rect x="80" y="184" width="240" height="16" rx="8" fill="${INK}" fill-opacity="0.4"/>
  <rect width="1200" height="400" filter="url(#grain-hb)" opacity="0.5"/>
</svg>`;

const cloud = (id, flip) => `
<svg viewBox="0 0 420 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label=""${flip ? ' transform="scale(-1,1)"' : ""}>
  <defs><linearGradient id="cl-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#e9e0ff"/></linearGradient></defs>
  <g fill="url(#cl-${id})">
    <ellipse cx="150" cy="140" rx="130" ry="60"/>
    <ellipse cx="250" cy="120" rx="110" ry="70"/>
    <ellipse cx="330" cy="150" rx="80" ry="46"/>
    <ellipse cx="90" cy="150" rx="70" ry="42"/>
  </g>
</svg>`;

const carouselTop = `
<svg viewBox="0 0 1440 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" role="img" aria-label="">
  <defs><linearGradient id="ct" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#efe7d7"/><stop offset="100%" stop-color="#efe7d7" stop-opacity="0"/></linearGradient></defs>
  <path d="M0 0 H1440 V60 Q720 120 0 60 Z" fill="url(#ct)"/>
</svg>`;

const footerPattern = `
<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="">
  <rect width="80" height="80" fill="none"/>
  <g fill="#ffffff" fill-opacity="0.05"><circle cx="20" cy="20" r="2"/><circle cx="60" cy="20" r="2"/><circle cx="40" cy="40" r="2"/><circle cx="20" cy="60" r="2"/><circle cx="60" cy="60" r="2"/></g>
</svg>`;

// ---- product-flow icons (8) — simple original line glyphs ------------------

const ICON_BG = "#efe9dc";
const icon = (id, body) => `
<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${id}">
  <rect width="48" height="48" rx="12" fill="${ICON_BG}"/>
  <g fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</g>
</svg>`;
const ICONS = {
  "idea-new": `<path d="M24 12a9 9 0 0 0-5 16.5V32h10v-3.5A9 9 0 0 0 24 12Z"/><path d="M20 36h8M21 39h6"/>`,
  "company-name": `<rect x="12" y="14" width="24" height="20" rx="2"/><path d="M17 20h14M17 25h14M17 30h8"/>`,
  codebase: `<path d="M19 19l-6 5 6 5M29 19l6 5-6 5M26 16l-4 16"/>`,
  llc: `<path d="M24 12l10 5v8c0 6-4 9-10 11-6-2-10-5-10-11v-8Z"/><path d="M20 24l3 3 6-6"/>`,
  "social-presence": `<circle cx="17" cy="18" r="3"/><circle cx="31" cy="18" r="3"/><circle cx="24" cy="31" r="3"/><path d="M19.5 20l3 8M28.5 20l-3 8"/>`,
  "buy-domain": `<circle cx="24" cy="24" r="11"/><path d="M13 24h22M24 13c4 3 4 19 0 22M24 13c-4 3-4 19 0 22"/>`,
  "brand-spec": `<path d="M18 14h9l5 5v15a1 1 0 0 1-1 1H18a1 1 0 0 1-1-1V15a1 1 0 0 1 1-1Z"/><path d="M27 14v5h5M21 27l2 2 4-4"/>`,
  bank: `<path d="M14 21l10-7 10 7M16 21v10M22 21v10M26 21v10M32 21v10M13 34h22"/>`,
};

// ---- emit ------------------------------------------------------------------

const out = [];
for (const [name, palette] of Object.entries(DEPTS)) out.push(write(`depts/${name}.svg`, deptCard(name, palette)));
out.push(write("vibes/editorial-mint.svg", vibeEditorialMint()));
out.push(write("vibes/saturated-tech.svg", vibeSaturatedTech()));
out.push(write("vibes/soft-pop.svg", vibeSoftPop()));
out.push(write("vibes/brutalist-grid.svg", vibeBrutalistGrid()));
out.push(write("vibes/pastel-utility.svg", vibePastelUtility()));
out.push(write("vibes/house-of-glass.svg", vibeHouseOfGlass()));
for (const [id, svg] of Object.entries(chapters)) out.push(write(`chapters/${id}.svg`, svg));
out.push(write("hero-lighthouse.svg", hero));
out.push(write("home-banner.svg", homeBanner));
out.push(write("build-ui-bits/clouds-left.svg", cloud("l", false)));
out.push(write("build-ui-bits/clouds-right.svg", cloud("r", true)));
out.push(write("build-ui-bits/carousel-top.svg", carouselTop));
out.push(write("footer/bg-footer-pattern.svg", footerPattern));
for (const [id, body] of Object.entries(ICONS)) out.push(write(`homepage/product-ui-1/icon-${id}.svg`, icon(id, body)));

console.log(`generated ${out.length} original SVG assets:\n${out.map((r) => "  public/" + r).join("\n")}`);
