/**
 * KelpFusion 画法 / KelpFusion drawing
 *
 * 移植自 4.3c 的原型（hyper-master-paper `scripts/analysis/hypergraph_vis_proto/kelp.html`），是 Meulemans et al.
 * (TVCG 2013) 的简化实现，参数与原型相同：
 *   1. 每个集合在成员上建最短路径图（SPG）：边权 d^t（t = 2），两点直连就是最短路时保留这条边；
 *      线段离非成员节点小于 16px 时边权 ×4，让路由尽量绕开非成员；
 *   2. SPG 里不含非成员节点的三角形、四边形面填成区域；
 *   3. 多个集合共用同一条 SPG 边时平行错开（Kelp Diagrams 的做法）。
 * 节点坐标沿用布局结果，不重新布局。论文中的面填充准则和障碍绕行比这里复杂，此处与原型一致只做简化版。
 *
 * Port of the 4.3c prototype, a simplified KelpFusion: per set a shortest-path graph over its members (weights d^t, ×4 near
 * non-members), empty triangles and quads filled, shared edges offset in parallel. Positions come from the layout.
 */
import type { ID } from '@antv/g6';

type Point = [number, number];

export interface KelpOptions {
  /** 边权指数，越大越接近树、越小越接近凸包，默认 2 / weight exponent, default 2 */
  t?: number;
  /** 线段离非成员节点小于该距离时加罚，默认 16 / distance to a non-member that triggers the penalty */
  obstacleRadius?: number;
  /** 罚的倍数，默认 4 / penalty factor, default 4 */
  obstaclePenalty?: number;
  /** 共用边平行错开的间距，默认 4.5 / gap between parallel shared edges */
  gap?: number;
}

export interface KelpSet {
  id: ID;
  members: ID[];
}

/**
 * <zh/> 一个集合的 Kelp 形状：填充的面、要画的线段（已按共用边错开）、SPG 的边（成员 id 对）
 *
 * <en/> Kelp shape of one set: filled faces, line segments (offset where shared) and the SPG edges
 */
export interface KelpShape {
  faces: Point[][];
  segments: [Point, Point][];
  edges: [ID, ID][];
}

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const segDist = (p: Point, a: Point, b: Point) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const inTri = (p: Point, a: Point, b: Point, c: Point) => {
  const s = (u: Point, v: Point, w: Point) => (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]);
  const d1 = s(a, b, p);
  const d2 = s(b, c, p);
  const d3 = s(c, a, p);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};
const hull = (pts: Point[]): Point[] => {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const chain = (list: Point[]) => {
    const r: Point[] = [];
    for (const q of list) {
      while (r.length >= 2 && cr(r[r.length - 2], r[r.length - 1], q) <= 0) r.pop();
      r.push(q);
    }
    r.pop();
    return r;
  };
  return [...chain(p), ...chain(p.slice().reverse())];
};

/**
 * <zh/> 计算所有集合的 Kelp 形状。positionOf 给出节点坐标（没有坐标的成员忽略）；obstacles 为参与"绕开"判断的全部节点
 *
 * <en/> Kelp shapes of all sets. Members without a position are skipped; obstacles are all nodes considered for avoidance
 */
export const kelpFusion = (
  sets: KelpSet[],
  positionOf: (id: ID) => Point | undefined,
  obstacles: ID[],
  options: KelpOptions = {},
): Map<ID, KelpShape> => {
  const { t: T = 2, obstacleRadius = 16, obstaclePenalty = 4, gap = 4.5 } = options;
  const P = new Map<ID, Point>();
  obstacles.forEach((id) => {
    const p = positionOf(id);
    if (p) P.set(id, p);
  });
  sets.forEach((s) =>
    s.members.forEach((id) => {
      const p = positionOf(id);
      if (p && !P.has(id)) P.set(id, p);
    }),
  );
  const placed = [...P.keys()];

  const shapes = new Map<ID, KelpShape>();
  sets.forEach(({ id, members }) => {
    const S = [...new Set(members)].filter((m) => P.has(m));
    const pts = S.map((m) => P.get(m)!);
    const n = S.length;
    const inSet = new Set(S);
    const non = placed.filter((m) => !inSet.has(m));
    const w = (i: number, j: number) => {
      const base = Math.pow(dist(pts[i], pts[j]), T);
      const hit = non.some((m) => segDist(P.get(m)!, pts[i], pts[j]) < obstacleRadius);
      return base * (hit ? obstaclePenalty : 1);
    };
    const D = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : w(i, j))));
    const SP = D.map((r) => [...r]);
    for (let m = 0; m < n; m++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (SP[i][m] + SP[m][j] < SP[i][j]) SP[i][j] = SP[i][m] + SP[m][j];
    const edges: [ID, ID][] = [];
    const adj = Array.from({ length: n }, () => new Set<number>());
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (D[i][j] <= SP[i][j] + 1e-6) {
          edges.push([S[i], S[j]]);
          adj[i].add(j);
          adj[j].add(i);
        }
    const empty = (poly: Point[]) =>
      !non.some((m) => {
        const p = P.get(m)!;
        for (let k = 1; k + 1 < poly.length; k++) if (inTri(p, poly[0], poly[k], poly[k + 1])) return true;
        return false;
      });
    const faces: Point[][] = [];
    for (let a = 0; a < n; a++)
      for (const b of adj[a])
        if (b > a)
          for (const c of adj[b])
            if (c > b && adj[c].has(a)) {
              const poly = [pts[a], pts[b], pts[c]];
              if (empty(poly)) faces.push(poly);
            }
    // 四边形面：a-b-c-e-a 且没有对角线（否则已被三角形覆盖），凸且为空 / quads without diagonals, convex and empty
    for (let a = 0; a < n; a++)
      for (const b of adj[a])
        for (const c of adj[b])
          for (const e of adj[c]) {
            if (!(a < b && a < c && a < e && b < e && c !== a && e !== b && adj[e].has(a)) || adj[a].has(c) || adj[b].has(e)) continue;
            const poly = hull([pts[a], pts[b], pts[c], pts[e]]);
            if (poly.length === 4 && empty(poly)) faces.push(poly);
          }
    shapes.set(id, { faces, segments: [], edges });
  });

  // 共用边平行错开：按集合顺序排开，居中对称 / shared edges side by side, centered, in set order
  const shared = new Map<string, ID[]>();
  const keyOf = (a: ID, b: ID) => (String(a) < String(b) ? `${a}\u0000${b}` : `${b}\u0000${a}`);
  sets.forEach(({ id }) => shapes.get(id)!.edges.forEach(([a, b]) => {
    const k = keyOf(a, b);
    shared.set(k, [...(shared.get(k) || []), id]);
  }));
  sets.forEach(({ id }) => {
    const shape = shapes.get(id)!;
    shape.segments = shape.edges.map(([a, b]) => {
      const [u, v] = String(a) < String(b) ? [a, b] : [b, a];
      const pa = P.get(u)!;
      const pb = P.get(v)!;
      const list = shared.get(keyOf(a, b))!;
      const L = dist(pa, pb) || 1;
      const nx = -(pb[1] - pa[1]) / L;
      const ny = (pb[0] - pa[0]) / L;
      const o = (list.indexOf(id) - (list.length - 1) / 2) * gap;
      return [
        [pa[0] + nx * o, pa[1] + ny * o],
        [pb[0] + nx * o, pb[1] + ny * o],
      ];
    });
  });
  return shapes;
};

/**
 * <zh/> Kelp 形状的路径命令（G6 / G 的 path 数组）：面是闭合子路径（填充），线段是开放子路径（只描边）
 *
 * <en/> Path commands of a Kelp shape: faces as closed subpaths (filled), segments as open subpaths (stroked)
 */
export const kelpPathArray = (shape: KelpShape): (string | number)[][] => [
  ...shape.faces.flatMap((f) => [...f.map(([x, y], i) => [i ? 'L' : 'M', x, y]), ['Z']]),
  ...shape.segments.flatMap(([[x1, y1], [x2, y2]]) => [
    ['M', x1, y1],
    ['L', x2, y2],
  ]),
];

const n2 = (x: number) => String(Math.round(x * 100) / 100);

/** SVG 的 d 字符串 / the SVG d string */
export const kelpPathString = (shape: KelpShape) =>
  kelpPathArray(shape)
    .map(([cmd, ...xy]) => `${cmd}${(xy as number[]).map(n2).join(',')}`)
    .join('');

/**
 * <zh/> 编号标签的锚点：点落在某个填充面内时不变，否则移到离它最近的线段上（Kelp 可能只有线、没有面，成员质心会悬空）
 *
 * <en/> Anchor for a code tag: kept when inside a filled face, otherwise moved to the nearest point on a segment (a Kelp
 * shape may be lines only, leaving the members' centroid in empty space)
 */
export const kelpAnchor = (shape: KelpShape, p: { x: number; y: number }): { x: number; y: number } => {
  const q: Point = [p.x, p.y];
  if (shape.faces.some((f) => f.slice(1, -1).some((_, k) => inTri(q, f[0], f[k + 1], f[k + 2])))) return p;
  let best = p;
  let bestD = Infinity;
  shape.segments.forEach(([a, b]) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    const x = a[0] + t * dx;
    const y = a[1] + t * dy;
    const d = Math.hypot(q[0] - x, q[1] - y);
    if (d < bestD) {
      bestD = d;
      best = { x, y };
    }
  });
  return best;
};
