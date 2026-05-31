// The /app workspace renders its own full-screen split-view shell
// (radial canvas + tabbed panel), so the layout is a thin pass-through.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen w-full">{children}</div>;
}
