// Captured content from cofounder.co (live, May 2026)

export const NAV_LINKS = [
  { label: "Start", href: "#start" },
  { label: "Build", href: "#build" },
  { label: "Sell", href: "#sell" },
  { label: "Scale", href: "#scale" },
  { label: "Resources", href: "#resources" },
  { label: "Pricing", href: "/pricing" },
];

export const DEPARTMENTS = [
  "Engineering",
  "Sales",
  "Marketing",
  "Design",
  "Support",
  "Operations",
  "Finance",
  "Legal",
];

export const VALUE_PROPS = [
  {
    title: "Agentic departments",
    body: "Designed like a real company, with departments, managers, and shared context.",
  },
  {
    title: "Human in the loop",
    body: "Agents work alongside you, requiring approval when potentially dangerous actions are taken.",
  },
  {
    title: "Fully extensible",
    body: "Easily connect MCP, custom APIs, custom skills, or an entire custom codebase to cofounder.",
  },
];

export const CHAPTERS = [
  { num: "I", title: "Start", blurb: "Validate the idea and stand up the company." },
  { num: "II", title: "Build", blurb: "Design, build, and deploy your product." },
  { num: "III", title: "Sell", blurb: "Reach customers and run go-to-market." },
  { num: "IV", title: "Scale", blurb: "Grow revenue, analytics, and support." },
];

export type RoadmapStatus =
  | "user"
  | "agent"
  | "approval"
  | "done"
  | "available"
  | "locked";

export const ROADMAP_STAGES: {
  stage: string;
  progress: string;
  steps: { label: string; by: string; status: RoadmapStatus; icon: string }[];
}[] = [
  {
    stage: "Idea",
    progress: "1/1",
    steps: [
      { label: "Initial Idea", by: "User task", status: "done", icon: "idea-new" },
    ],
  },
  {
    stage: "Initial",
    progress: "0/3",
    steps: [
      { label: "Pick a Company Name", by: "User task", status: "user", icon: "company-name" },
      { label: "Setup Codebase", by: "Agent task", status: "agent", icon: "codebase" },
      { label: "Incorporate LLC", by: "Agent requires approval", status: "approval", icon: "llc" },
    ],
  },
  {
    stage: "Identity",
    progress: "0/4",
    steps: [
      { label: "Setup Social Presence", by: "Agent task", status: "agent", icon: "social-presence" },
      { label: "Buy Domain", by: "User task", status: "user", icon: "buy-domain" },
      { label: "Logo & Brand Spec", by: "Agent task", status: "agent", icon: "brand-spec" },
      { label: "Open Bank Account", by: "Agent requires approval", status: "approval", icon: "bank" },
    ],
  },
];

export const INDUSTRIES = [
  "Platform",
  "AI Voice Agent",
  "YouTube Channel",
  "Vibe Coding IDE",
  "AI Newsletter",
  "Recruiting Firm",
  "Content Writer",
  "Consulting",
  "Support Agent",
  "Growth Agency",
];

export const TOOLS_CAPTIONS = [
  "You stay in control, nothing ships without your approval.",
  "Run multiple tasks in the background at the same time.",
  "Customize agents with apps, skills, and schedules.",
];

export const PRICING = [
  {
    name: "Free Trial",
    price: "Free",
    cadence: "7-day, $10 usage included",
    cta: "Get started",
    highlight: false,
  },
  {
    name: "Cofounder Pro",
    price: "$20",
    cadence: "/mo, usage included",
    cta: "Get started",
    highlight: true,
  },
  {
    name: "Team Plan",
    price: "$50",
    cadence: "/mo · Coming soon",
    cta: "Join waitlist",
    highlight: false,
  },
];

export const FOOTER_COLUMNS = [
  {
    title: "How to",
    links: ["Start", "Build", "Sell", "Scale"],
  },
  {
    title: "Company",
    links: ["Homepage", "Resources", "Pricing", "Careers"],
  },
  {
    title: "Legal",
    links: ["Privacy Policy", "Terms of Service", "Docs"],
  },
];
