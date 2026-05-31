// Visual-identity "vibes" the Design agent can start a brand kit from.
// Each pairs a generated mood board with a precise palette + type pairing
// that the UI overlays crisply on top of the image.

export interface Vibe {
  id: string;
  name: string;
  tagline: string;
  tags: string[];
  board: string; // generated brand-mood board (in /public/vibes)
  palette: string[]; // swatch hexes (left → right)
  ink: string; // legible text color for the board name overlay
  onImageDark: boolean; // true if the board image is dark (use light overlay text)
  type: { display: string; body: string };
}

export const VIBES: Vibe[] = [
  {
    id: "editorial-mint",
    name: "Editorial Mint",
    tagline: "Refined, calm, editorial.",
    tags: ["Serif display", "Sage & cream", "Whitespace"],
    board: "/vibes/editorial-mint.jpg",
    palette: ["#f4f6f2", "#8fb9a3", "#d8e3d0", "#c9a86a", "#1f2a24"],
    ink: "#1f2a24",
    onImageDark: false,
    type: { display: "Fraunces", body: "Inter" },
  },
  {
    id: "saturated-tech",
    name: "Saturated Tech",
    tagline: "Bold, neon, futuristic.",
    tags: ["Geometric sans", "Electric", "Dark mode"],
    board: "/vibes/saturated-tech.jpg",
    palette: ["#0e1116", "#4f7cff", "#00d3a7", "#ff4d8d", "#e8edf2"],
    ink: "#ffffff",
    onImageDark: true,
    type: { display: "Space Grotesk", body: "IBM Plex Sans" },
  },
  {
    id: "soft-pop",
    name: "Soft Pop",
    tagline: "Playful, warm, friendly.",
    tags: ["Rounded sans", "Pastel", "Bubbly"],
    board: "/vibes/soft-pop.jpg",
    palette: ["#fff5f0", "#ff8fab", "#ffd166", "#8ecae6", "#3a2b2b"],
    ink: "#3a2b2b",
    onImageDark: false,
    type: { display: "Poppins", body: "Nunito" },
  },
  {
    id: "brutalist-grid",
    name: "Brutalist Grid",
    tagline: "Stark, raw, high-contrast.",
    tags: ["Mono", "Black / red", "Rigid grid"],
    board: "/vibes/brutalist-grid.jpg",
    palette: ["#ffffff", "#111111", "#ff3b30", "#d6d6d6", "#111111"],
    ink: "#111111",
    onImageDark: false,
    type: { display: "Archivo", body: "JetBrains Mono" },
  },
  {
    id: "pastel-utility",
    name: "Pastel Utility",
    tagline: "Muted, functional, tasteful.",
    tags: ["Neutral sans", "Muted", "Utilitarian"],
    board: "/vibes/pastel-utility.jpg",
    palette: ["#eef0ef", "#9aa7b1", "#b7c4b0", "#c8a99a", "#2b2f33"],
    ink: "#2b2f33",
    onImageDark: false,
    type: { display: "Geist", body: "Geist" },
  },
  {
    id: "house-of-glass",
    name: "House of Glass",
    tagline: "Translucent, cool, luminous.",
    tags: ["Light sans", "Glass", "Periwinkle"],
    board: "/vibes/house-of-glass.jpg",
    palette: ["#eef2fb", "#9bb0ff", "#bfe0ff", "#c6bfff", "#20283a"],
    ink: "#20283a",
    onImageDark: false,
    type: { display: "General Sans", body: "Inter" },
  },
];

export function vibeById(id: string | null | undefined): Vibe | null {
  return VIBES.find((v) => v.id === id) ?? null;
}

/** Steps in the brand-kit "painting" animation. */
export const PAINT_STEPS = ["Composing board", "Balancing palette", "Setting type"];

/** The Design Roadmap shown during the visual-identity step. */
export const DESIGN_ROADMAP: { title: string; detail: string; locked: boolean }[] = [
  { title: "Brand kit", detail: "Choose a vibe, add references, review the first board.", locked: false },
  { title: "Design logo", detail: "Unlocked after brand approval.", locked: true },
  { title: "Create pitch deck", detail: "Business context plus brand kit.", locked: true },
  { title: "Landing page", detail: "Brand-true marketing site.", locked: true },
  { title: "Component library", detail: "Reusable UI from the kit.", locked: true },
];
