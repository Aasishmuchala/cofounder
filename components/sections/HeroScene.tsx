/**
 * Original animated pixel-art landscape hero — fully ours (no borrowed assets).
 * Static scene in SVG (sky, sun, mountains, hills, lighthouse, trees, flowers);
 * pixel clouds + birds drift and bob across as CSS-animated layers. Pure CSS
 * motion, no scripts, respects prefers-reduced-motion. The lighthouse is a small
 * nod to the brand: it guides the ships while you stay at the helm.
 */

const PixelCloud = ({ w = 130 }: { w?: number }) => (
  <svg width={w} viewBox="0 0 56 24" shapeRendering="crispEdges" aria-hidden>
    <g fill="#cfe6f5">
      <rect x="6" y="16" width="46" height="5" />
    </g>
    <g fill="#ffffff">
      <rect x="16" y="5" width="16" height="8" />
      <rect x="28" y="7" width="16" height="7" />
      <rect x="9" y="10" width="40" height="7" />
      <rect x="5" y="13" width="48" height="5" />
    </g>
    <g fill="#ffffff" opacity="0.85">
      <rect x="16" y="5" width="9" height="3" />
    </g>
  </svg>
);

const Bird = () => (
  <svg width="22" viewBox="0 0 16 8" shapeRendering="crispEdges" aria-hidden>
    <g fill="#3c4a55">
      <rect x="1" y="3" width="3" height="1" />
      <rect x="3" y="2" width="2" height="1" />
      <rect x="5" y="1" width="2" height="1" />
      <rect x="7" y="2" width="2" height="1" />
      <rect x="9" y="1" width="2" height="1" />
      <rect x="11" y="2" width="2" height="1" />
      <rect x="13" y="3" width="3" height="1" />
    </g>
  </svg>
);

const RoundTree = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} shapeRendering="crispEdges">
    <rect x="-1.6" y="4" width="3.2" height="9" fill="#6b4a2e" />
    <rect x="-1.6" y="4" width="1.3" height="9" fill="#553a23" />
    <g fill="#2f8f4e">
      <rect x="-11" y="-1" width="22" height="5" />
      <rect x="-9" y="-3" width="18" height="9" />
      <rect x="-7" y="-7" width="14" height="6" />
      <rect x="-4" y="-10" width="8" height="4" />
    </g>
    <g fill="#49b369">
      <rect x="-9" y="-3" width="8" height="4" />
      <rect x="-7" y="-7" width="6" height="3" />
      <rect x="-4" y="-10" width="4" height="2" />
    </g>
    <g fill="#22703b">
      <rect x="-11" y="3" width="22" height="2" />
      <rect x="2" y="-1" width="9" height="4" />
    </g>
  </g>
);

const PineTree = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} shapeRendering="crispEdges">
    <rect x="-1.4" y="6" width="2.8" height="7" fill="#6b4a2e" />
    <g fill="#2c834a">
      <rect x="-1.5" y="-12" width="3" height="3" />
      <rect x="-3" y="-10" width="6" height="3" />
      <rect x="-4.5" y="-7" width="9" height="3" />
      <rect x="-6" y="-4" width="12" height="3" />
      <rect x="-7.5" y="-1" width="15" height="3" />
    </g>
    <g fill="#3aa05a">
      <rect x="-3" y="-10" width="2" height="3" />
      <rect x="-4.5" y="-7" width="2.5" height="3" />
      <rect x="-6" y="-4" width="3" height="3" />
      <rect x="-7.5" y="-1" width="3.5" height="3" />
    </g>
  </g>
);

const Lighthouse = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} shapeRendering="crispEdges">
    <circle cx="0" cy="-20" r="11" fill="#ffe07a" opacity="0.16" />
    <g fill="#3c8d51">
      <rect x="-6" y="0" width="12" height="4" />
      <rect x="-4" y="-1" width="8" height="2" />
    </g>
    <g fill="#f1f1ee">
      <rect x="-4" y="-6" width="8" height="6" />
      <rect x="-3.5" y="-12" width="7" height="6" />
      <rect x="-3" y="-17" width="6" height="5" />
    </g>
    <g fill="#e0584f">
      <rect x="-4" y="-8" width="8" height="2" />
      <rect x="-3.3" y="-14" width="6.6" height="2" />
    </g>
    <rect x="-4.6" y="-18.5" width="9.2" height="1.6" fill="#2b3640" />
    <rect x="-2.6" y="-22.5" width="5.2" height="4" fill="#ffe07a" />
    <g fill="#2b3640">
      <rect x="-3" y="-24.5" width="6" height="2" />
      <rect x="-1.5" y="-26.5" width="3" height="2" />
    </g>
  </g>
);

const clouds = [
  { top: "6%", w: 150, dur: 120, delay: -10, bob: 8 },
  { top: "15%", w: 96, dur: 165, delay: -70, bob: 7 },
  { top: "24%", w: 124, dur: 96, delay: -40, bob: 9 },
  { top: "34%", w: 78, dur: 140, delay: -110, bob: 6 },
  { top: "11%", w: 112, dur: 150, delay: -125, bob: 8 },
];
const birds = [
  { top: "20%", dur: 60, delay: -20 },
  { top: "23%", dur: 60, delay: -16 },
  { top: "17%", dur: 78, delay: -50 },
];

export default function HeroScene() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <style>{`
        @keyframes hs-drift{from{transform:translate3d(-24vw,0,0)}to{transform:translate3d(124vw,0,0)}}
        @keyframes hs-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(5px)}}
        @keyframes hs-pulse{0%,100%{opacity:.78}50%{opacity:1}}
        .hs-move{position:absolute;left:0;will-change:transform;animation:hs-drift linear infinite}
        .hs-bob{animation:hs-bob ease-in-out infinite}
        .hs-pulse{animation:hs-pulse 7s ease-in-out infinite;transform-origin:center}
        @media (prefers-reduced-motion: reduce){.hs-move,.hs-bob,.hs-pulse{animation:none}}
      `}</style>

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 320 180"
        preserveAspectRatio="xMidYMid slice"
        shapeRendering="crispEdges"
      >
        <defs>
          <linearGradient id="hs-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#57a7eb" />
            <stop offset="0.55" stopColor="#9bd2f3" />
            <stop offset="1" stopColor="#dcf0fb" />
          </linearGradient>
          <radialGradient id="hs-sun" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff6d6" />
            <stop offset="0.5" stopColor="#ffe39a" />
            <stop offset="1" stopColor="#ffe39a" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="320" height="180" fill="url(#hs-sky)" />

        {/* Sun: soft pulsing glow + crisp core */}
        <circle className="hs-pulse" cx="252" cy="40" r="42" fill="url(#hs-sun)" />
        <circle cx="252" cy="40" r="15" fill="#ffe89c" />

        {/* Hazy distant mountains for depth */}
        <polygon points="0,118 36,103 64,114 96,100 130,112 164,101 198,113 232,102 268,112 300,104 320,110 320,138 0,138" fill="#a9c6d4" />
        <polygon points="0,124 50,114 100,122 150,112 200,122 260,113 320,120 320,142 0,142" fill="#8fb9a8" opacity="0.85" />

        {/* Rolling hills (back → front) */}
        <polygon points="0,120 44,112 92,118 150,109 210,116 268,108 320,114 320,180 0,180" fill="#8ccf90" />
        <polygon points="0,134 60,126 124,133 196,124 262,131 320,125 320,180 0,180" fill="#5fb873" />
        {/* Lighthouse sits on the mid hill */}
        <Lighthouse x={158} y={129} s={1} />
        <polygon points="0,151 84,143 168,151 244,143 320,150 320,180 0,180" fill="#46a25d" />
        <rect x="0" y="165" width="320" height="15" fill="#3a8a51" />

        {/* Foreground bushes */}
        <g fill="#327c47" shapeRendering="crispEdges">
          <rect x="40" y="170" width="14" height="6" />
          <rect x="44" y="167" width="7" height="4" />
          <rect x="300" y="171" width="16" height="6" />
          <rect x="305" y="168" width="8" height="4" />
        </g>

        {/* Trees */}
        <RoundTree x={236} y={140} s={1.1} />
        <PineTree x={288} y={150} s={1.25} />
        <RoundTree x={210} y={151} s={0.85} />

        {/* Flowers */}
        <g shapeRendering="crispEdges">
          {[
            [24, 172, "#ff7aa8"], [44, 176, "#ffd54a"], [72, 171, "#ffffff"],
            [120, 175, "#ff7aa8"], [150, 172, "#ffd54a"], [190, 176, "#ffffff"],
            [266, 173, "#ffd54a"], [304, 175, "#ff7aa8"],
          ].map(([fx, fy, c], i) => (
            <g key={i}>
              <rect x={fx as number} y={(fy as number) - 3} width="1.6" height="3" fill="#2f7a45" />
              <rect x={(fx as number) - 1.4} y={fy as number} width="4.4" height="3" fill={c as string} />
            </g>
          ))}
        </g>
      </svg>

      {/* Drifting + bobbing pixel clouds */}
      {clouds.map((c, i) => (
        <div
          key={i}
          className="hs-move"
          style={{ top: c.top, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}
        >
          <div className="hs-bob" style={{ animationDuration: `${c.bob}s` }}>
            <PixelCloud w={c.w} />
          </div>
        </div>
      ))}

      {/* Birds */}
      {birds.map((b, i) => (
        <div key={i} className="hs-move" style={{ top: b.top, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }}>
          <Bird />
        </div>
      ))}

      {/* Left/bottom darkening so the white headline stays legible */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(98deg, rgba(8,18,38,0.44), rgba(8,18,38,0.12) 42%, rgba(8,18,38,0) 66%), linear-gradient(to top, rgba(8,18,38,0.26), transparent 38%)",
        }}
      />
    </div>
  );
}
