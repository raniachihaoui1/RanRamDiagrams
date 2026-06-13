/**
 * Vector stamp symbols for the canvas "Stamp" tool — architectural scale
 * figures, trees, and isometric arrows. Each symbol draws into a normalised
 * 100×100 box; the canvas scales/positions it per placement. Drawing is pure
 * Canvas2D so stamps replay exactly like strokes (no external assets).
 */

export type StampCategory = "people" | "trees" | "arrows";

export interface StampSymbol {
  id: string;
  label: string;
  category: StampCategory;
  /** Draw inside a 0..100 box using the given primary color. */
  draw: (ctx: CanvasRenderingContext2D, color: string) => void;
}

// --- helpers ---------------------------------------------------------------

/** Darken a hex color by `amt` (0..1) for isometric side faces / trunks. */
function darken(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amt)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amt)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amt)));
  return `rgb(${r},${g},${b})`;
}

function poly(ctx: CanvasRenderingContext2D, pts: number[][], fill: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Extruded (isometric) solid: side faces darker, front face on top. */
function extrude(
  ctx: CanvasRenderingContext2D,
  pts: number[][],
  dx: number,
  dy: number,
  color: string
) {
  const back = pts.map(([x, y]) => [x + dx, y + dy]);
  const side = darken(color, 0.32);
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    poly(ctx, [pts[i], pts[j], back[j], back[i]], side);
  }
  poly(ctx, pts, color);
}

// --- people (architectural scale figures) ----------------------------------

const humanStanding: StampSymbol = {
  id: "human-standing",
  label: "Person",
  category: "people",
  draw(ctx, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(50, 14, 8, 0, Math.PI * 2);
    ctx.fill();
    poly(
      ctx,
      [
        [50, 23], [42, 24], [40, 31], [43, 54], [37, 86], [45, 87],
        [50, 60], [55, 87], [63, 86], [57, 54], [60, 31], [58, 24],
      ],
      color
    );
  },
};

const humanWalking: StampSymbol = {
  id: "human-walking",
  label: "Walking",
  category: "people",
  draw(ctx, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(53, 14, 8, 0, Math.PI * 2);
    ctx.fill();
    poly(
      ctx,
      [
        [53, 23], [45, 24], [42, 31], [40, 52], [32, 80], [39, 83],
        [48, 56], [53, 66], [61, 87], [68, 83], [58, 53], [61, 31], [60, 24],
      ],
      color
    );
  },
};

const humanCouple: StampSymbol = {
  id: "human-couple",
  label: "Couple",
  category: "people",
  draw(ctx, color) {
    const figure = (ox: number) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ox, 22, 6, 0, Math.PI * 2);
      ctx.fill();
      poly(
        ctx,
        [
          [ox, 29], [ox - 6, 30], [ox - 7.5, 35], [ox - 5, 54], [ox - 9, 84],
          [ox - 3, 85], [ox, 60], [ox + 3, 85], [ox + 9, 84], [ox + 5, 54],
          [ox + 7.5, 35], [ox + 6, 30],
        ],
        color
      );
    };
    figure(35);
    figure(65);
  },
};

// --- trees ------------------------------------------------------------------

const treeRound: StampSymbol = {
  id: "tree-round",
  label: "Tree",
  category: "trees",
  draw(ctx, color) {
    ctx.fillStyle = darken(color, 0.45);
    ctx.fillRect(46, 56, 8, 36);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(50, 38, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = darken(color, 0.18);
    ctx.beginPath();
    ctx.arc(58, 44, 9, 0, Math.PI * 2);
    ctx.arc(42, 32, 7, 0, Math.PI * 2);
    ctx.fill();
  },
};

const treeConifer: StampSymbol = {
  id: "tree-conifer",
  label: "Conifer",
  category: "trees",
  draw(ctx, color) {
    ctx.fillStyle = darken(color, 0.45);
    ctx.fillRect(47, 78, 6, 16);
    ctx.fillStyle = color;
    poly(ctx, [[50, 8], [70, 42], [30, 42]], color);
    poly(ctx, [[50, 28], [74, 60], [26, 60]], color);
    poly(ctx, [[50, 48], [78, 82], [22, 82]], color);
  },
};

const treePlan: StampSymbol = {
  id: "tree-plan",
  label: "Tree (plan)",
  category: "trees",
  draw(ctx, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(50, 50, 38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      ctx.beginPath();
      ctx.moveTo(50, 50);
      ctx.lineTo(50 + Math.cos(a) * 36, 50 + Math.sin(a) * 36);
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(50, 50, 5, 0, Math.PI * 2);
    ctx.fill();
  },
};

// --- isometric arrows -------------------------------------------------------

const arrowIsoUp: StampSymbol = {
  id: "arrow-iso-up",
  label: "Iso up",
  category: "arrows",
  draw(ctx, color) {
    const pts = [
      [50, 8], [74, 34], [61, 34], [61, 84], [39, 84], [39, 34], [26, 34],
    ];
    extrude(ctx, pts, 11, -7, color);
  },
};

const arrowIsoFlow: StampSymbol = {
  id: "arrow-iso-flow",
  label: "Iso flow",
  category: "arrows",
  draw(ctx, color) {
    // Block arrow lying on the isometric ground plane, pointing up-right.
    const pts = [
      [18, 64], [50, 46], [50, 38], [84, 50], [56, 70], [56, 62], [26, 76],
    ];
    extrude(ctx, pts, 0, 8, color);
  },
};

const arrowRotate: StampSymbol = {
  id: "arrow-rotate",
  label: "Rotate",
  category: "arrows",
  draw(ctx, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(50, 52, 30, Math.PI * 0.85, Math.PI * 2.15);
    ctx.stroke();
    // arrowhead at the arc end
    const a = Math.PI * 2.15;
    const ex = 50 + Math.cos(a) * 30;
    const ey = 52 + Math.sin(a) * 30;
    const t = a + Math.PI / 2;
    poly(
      ctx,
      [
        [ex + Math.cos(t) * 14, ey + Math.sin(t) * 14],
        [ex - Math.cos(t) * 14, ey - Math.sin(t) * 14],
        [ex + Math.cos(a) * 20, ey + Math.sin(a) * 20],
      ],
      color
    );
  },
};

// --- registry ---------------------------------------------------------------

export const STAMPS: StampSymbol[] = [
  humanStanding,
  humanWalking,
  humanCouple,
  treeRound,
  treeConifer,
  treePlan,
  arrowIsoUp,
  arrowIsoFlow,
  arrowRotate,
];

export const STAMP_MAP: Record<string, StampSymbol> = Object.fromEntries(
  STAMPS.map((s) => [s.id, s])
);

export const STAMP_CATEGORIES: { id: StampCategory; label: string }[] = [
  { id: "people", label: "People" },
  { id: "trees", label: "Trees" },
  { id: "arrows", label: "Arrows" },
];
