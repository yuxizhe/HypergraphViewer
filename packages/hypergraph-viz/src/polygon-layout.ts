/**
 * 多边形布局 / Polygon layout
 *
 * 配合多边形画法（HGPolyVis：Oliver, Zhang & Zhang, "Scalable Hypergraph Visualization", IEEE VIS 2023；
 * Qu et al., TVCG 2022）：每条超边画成多边形，成员正好在角上，n 个成员即 n 边形，2 个成员为线段。
 * 先用超图布局得到花瓣状的初始位置，再用迭代力近似论文的能量优化（论文用 L-BFGS 与多尺度，这里未实现）：
 *   1. 规则度：成员拉向同一超边的最佳拟合正多边形；2 元超边拉向边长；
 *   2. 间距：节点互斥；
 *   3. 非成员推出：落在多边形内的非成员推出去，成员反向退让；
 *   4. 多边形分开：不共享成员的两个多边形外接圆相交时推开。
 * Pairs with the polygon drawing (HGPolyVis): each hyperedge is a polygon with its members exactly at the corners.
 * Starts from the hypergraph layout, then approximates the paper's energy optimization with iterative forces
 * (regularity, node spacing, non-members pushed out, disjoint polygons pushed apart). No L-BFGS or multiscale.
 *
 * 用法 / Usage:
 *   registerHypergraph(); // 注册为 'polygon' 布局 / registers the 'polygon' layout
 *   layout: { type: 'polygon', hyperedges, centerNode }
 */
import type { GraphData, ID, NodeData, Size } from '@antv/g6';
import { BaseLayout } from '@antv/g6';
import type { HypergraphLayoutOptions } from './layout';
import { HypergraphLayout } from './layout';

export interface PolygonLayoutOptions extends HypergraphLayoutOptions {
  /**
   * <zh/> 正多边形的目标边长，默认为节点直径 + 节点间距
   *
   * <en/> Target side length of the regular polygons, defaults to node diameter + node spacing
   */
  polygonSide?: number;
  /**
   * <zh/> 多边形优化的迭代次数
   *
   * <en/> Iterations of the polygon optimization
   * @defaultValue 400
   */
  polygonIterations?: number;
}

type Point = [number, number];

/**
 * <zh/> 按绕质心的角度排序：连成的多边形为星形（可为凹多边形），每个点都在角上
 *
 * <en/> Order points by angle around their centroid: the resulting polygon is star-shaped (possibly concave), every point a corner
 */
export const polygonOrder = <T>(items: T[], pointOf: (item: T) => Point): T[] => {
  let cx = 0;
  let cy = 0;
  items.forEach((item) => {
    const [x, y] = pointOf(item);
    cx += x;
    cy += y;
  });
  cx /= items.length || 1;
  cy /= items.length || 1;
  const angle = (item: T) => {
    const [x, y] = pointOf(item);
    return Math.atan2(y - cy, x - cx);
  };
  return [...items].sort((a, b) => angle(a) - angle(b));
};

const inPolygon = (x: number, y: number, xs: number[], ys: number[]) => {
  let inside = false;
  for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) {
    if (ys[i] > y !== ys[j] > y && x < ((xs[j] - xs[i]) * (y - ys[i])) / (ys[j] - ys[i]) + xs[i]) inside = !inside;
  }
  return inside;
};

const radiusOf = (size: Size = 0) => (typeof size === 'number' ? size : Math.max(...size)) / 2;

/**
 * <zh/> 多边形布局：超图布局 + 多边形优化
 *
 * <en/> Polygon layout: the hypergraph layout followed by polygon optimization
 */
// G6 只把直接继承 BaseLayout 的类当作自有布局（否则按 @antv/layout 的布局适配），因此组合而非继承 HypergraphLayout
// G6 treats only direct subclasses of BaseLayout as native layouts (others go through the @antv/layout adapter), hence composition
export class PolygonLayout extends BaseLayout<PolygonLayoutOptions> {
  public id = 'polygon';

  async execute(model: GraphData, options?: PolygonLayoutOptions): Promise<GraphData> {
    // 初始布局一次算完，不逐帧回调 / the initial layout runs to completion without per-frame callbacks
    const opts = { ...HypergraphLayout.defaultOptions, ...this.options, ...options } as PolygonLayoutOptions;
    const initial = await new HypergraphLayout(this.context, opts).execute(model, { ...opts, onTick: undefined });
    const result = optimize(model, initial, opts);
    opts.onTick?.(result);
    return result;
  }
}

function optimize(model: GraphData, initial: GraphData, options: PolygonLayoutOptions): GraphData {
  const { nodeSize = 20, nodeSpacing = 10, centerNode, hyperedges = [], polygonIterations = 400 } = options;
  const nodes = initial.nodes || [];
  const n = nodes.length;
  const indexOf = new Map<ID, number>(nodes.map((node, i) => [node.id, i]));
  const x = Float64Array.from(nodes, (node) => node.style?.x ?? 0);
  const y = Float64Array.from(nodes, (node) => node.style?.y ?? 0);
  const sizeOf = typeof nodeSize === 'function' ? nodeSize : () => nodeSize;
  const dataOf = new Map<ID, NodeData>((model.nodes || []).map((node) => [node.id, node]));
  const radius = Float64Array.from(nodes, (node) => radiusOf(sizeOf(dataOf.get(node.id) ?? node)));
  const diameter = Math.max(0, ...radius) * 2;
  const side = options.polygonSide ?? diameter + nodeSpacing;
  const fixed = centerNode !== undefined ? (indexOf.get(centerNode) ?? -1) : -1;

  // 超边与连线（2 元超边），去重 / hyperedges and lines (2-member hyperedges), deduplicated
  const sets: number[][] = [];
  const seen = new Set<string>();
  const edges = (model.edges || []).map((edge) => ({ members: [edge.source, edge.target] }));
  [...(typeof hyperedges === 'function' ? hyperedges(model) : hyperedges), ...edges].forEach(({ members }) => {
    const set = [...new Set(members.map((id) => indexOf.get(id)).filter((i): i is number => i !== undefined))];
    if (set.length < 2) return;
    const key = [...set].sort((a, b) => a - b).join(',');
    if (seen.has(key)) return;
    seen.add(key);
    sets.push(set);
  });
  if (!sets.length) return initial;

  const degree = new Float64Array(n);
  sets.forEach((set) => set.forEach((v) => degree[v]++));
  const memberOf = sets.map((set) => new Set(set));
  // 外接圆半径：正 n 边形，或线段的一半 / circumradius of the regular polygon, or half a segment
  const circumradius = sets.map((set) => (set.length > 2 ? side / (2 * Math.sin(Math.PI / set.length)) : side / 2));
  const disjoint: [number, number][] = [];
  for (let a = 0; a < sets.length; a++) {
    for (let b = a + 1; b < sets.length; b++) if (!sets[b].some((v) => memberOf[a].has(v))) disjoint.push([a, b]);
  }

  const fx = new Float64Array(n);
  const fy = new Float64Array(n);
  const cx = new Float64Array(sets.length);
  const cy = new Float64Array(sets.length);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let it = 0; it < polygonIterations; it++) {
    fx.fill(0);
    fy.fill(0);
    const cool = 1 - it / polygonIterations;
    sets.forEach((set, s) => {
      let sx = 0;
      let sy = 0;
      set.forEach((v) => ((sx += x[v]), (sy += y[v])));
      cx[s] = sx / set.length;
      cy[s] = sy / set.length;
    });

    // 1. 规则度 / regularity
    sets.forEach((set, s) => {
      if (set.length === 2) {
        const [a, b] = set;
        const dx = x[b] - x[a];
        const dy = y[b] - y[a];
        const d = Math.hypot(dx, dy) || 1;
        const f = ((d - side) / d) * 0.15;
        fx[a] += dx * f;
        fy[a] += dy * f;
        fx[b] -= dx * f;
        fy[b] -= dy * f;
        return;
      }
      // 拟合正多边形：中心为质心，转角为各角相位的平均 / fitted regular polygon: centered on the centroid, rotated by the mean phase
      const ring = polygonOrder(set, (v) => [x[v], y[v]]);
      const k = ring.length;
      let px = 0;
      let py = 0;
      ring.forEach((v, i) => {
        const a = Math.atan2(y[v] - cy[s], x[v] - cx[s]) - (2 * Math.PI * i) / k;
        px += Math.cos(a);
        py += Math.sin(a);
      });
      const theta = Math.atan2(py, px);
      ring.forEach((v, i) => {
        const a = theta + (2 * Math.PI * i) / k;
        fx[v] += (cx[s] + circumradius[s] * Math.cos(a) - x[v]) * 0.3;
        fy[v] += (cy[s] + circumradius[s] * Math.sin(a) - y[v]) * 0.3;
      });
    });

    // 2. 节点互斥 / node repulsion
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        const min = radius[a] + radius[b] + nodeSpacing / 2;
        const dx = x[b] - x[a];
        const dy = y[b] - y[a];
        if (Math.abs(dx) >= min || Math.abs(dy) >= min) continue;
        const d = Math.hypot(dx, dy) || 0.1;
        if (d >= min) continue;
        const f = ((min - d) / d) * 0.5;
        fx[a] -= dx * f;
        fy[a] -= dy * f;
        fx[b] += dx * f;
        fy[b] += dy * f;
      }
    }

    // 3. 非成员推出多边形 / non-members pushed out of polygons
    const push = side * 0.08;
    sets.forEach((set, s) => {
      if (set.length < 3) return;
      const ring = polygonOrder(set, (v) => [x[v], y[v]]);
      xs.length = ys.length = 0;
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      ring.forEach((v) => {
        xs.push(x[v]);
        ys.push(y[v]);
        x0 = Math.min(x0, x[v]);
        x1 = Math.max(x1, x[v]);
        y0 = Math.min(y0, y[v]);
        y1 = Math.max(y1, y[v]);
      });
      for (let v = 0; v < n; v++) {
        if (x[v] < x0 || x[v] > x1 || y[v] < y0 || y[v] > y1 || memberOf[s].has(v) || !inPolygon(x[v], y[v], xs, ys)) continue;
        const dx = x[v] - cx[s];
        const dy = y[v] - cy[s];
        const d = Math.hypot(dx, dy) || 1;
        fx[v] += (dx / d) * push;
        fy[v] += (dy / d) * push;
        set.forEach((m) => ((fx[m] -= (dx / d) * push * 0.25), (fy[m] -= (dy / d) * push * 0.25)));
      }
    });

    // 4. 不共享成员的多边形推开 / disjoint polygons pushed apart
    disjoint.forEach(([a, b]) => {
      const dx = cx[b] - cx[a];
      const dy = cy[b] - cy[a];
      const d = Math.hypot(dx, dy) || 1;
      const gap = circumradius[a] + circumradius[b] + nodeSpacing / 5 - d;
      if (gap <= 0) return;
      const f = (gap / d) * 0.15;
      sets[a].forEach((v) => ((fx[v] -= dx * f), (fy[v] -= dy * f)));
      sets[b].forEach((v) => ((fx[v] += dx * f), (fy[v] += dy * f)));
    });

    // 位移按所属超边数平均（枢纽同时受很多多边形拉扯），限幅并降温；中心节点固定
    // Displacement damped by degree (hubs are pulled by many polygons), capped and cooled; the center node stays put
    const cap = side * (0.17 * cool + 0.015);
    for (let v = 0; v < n; v++) {
      if (v === fixed) continue;
      const k = 1 / Math.sqrt(degree[v] || 1);
      let dx = fx[v] * k;
      let dy = fy[v] * k;
      const l = Math.hypot(dx, dy);
      if (l > cap) {
        dx *= cap / l;
        dy *= cap / l;
      }
      x[v] += dx;
      y[v] += dy;
    }
  }
  return { nodes: nodes.map((node, i) => ({ id: node.id, style: { x: x[i], y: y[i] } })) };
}
