/**
 * 多边形布局（HGPolyVis）：在超图布局上优化后，多边形更接近正多边形（边长变异系数下降），中心实体不动
 */
import { describe, expect, it } from 'vitest';
import { datas } from './fixtures/neurology-data.js';
import { fromKeyedEdges, HypergraphLayout, PolygonLayout, polygonOrder, toG6Spec } from '../src';

const centers = Object.keys(datas.graphs).slice(0, 6);

const run = async (Layout: any, spec: any) => {
  const out = await new Layout({} as any, { ...spec.layout, nodeSize: 20 }).execute(
    structuredClone({ nodes: spec.data.nodes, edges: spec.data.edges }),
  );
  return new Map<string, [number, number]>(out.nodes.map((n: any) => [n.id, [n.style.x, n.style.y]]));
};

// 3 个及以上成员的多边形，边长变异系数的平均 / mean coefficient of variation of side lengths
const sideCV = (pos: Map<string, [number, number]>, sets: string[][]) => {
  const cvs = sets.map((set) => {
    const ring = polygonOrder(set, (id) => pos.get(id)!).map((id) => pos.get(id)!);
    const sides = ring.map(([x, y], i) => Math.hypot(x - ring[(i + 1) % ring.length][0], y - ring[(i + 1) % ring.length][1]));
    const mean = sides.reduce((s, l) => s + l, 0) / sides.length;
    return Math.sqrt(sides.reduce((s, l) => s + (l - mean) ** 2, 0) / sides.length) / mean;
  });
  return cvs.reduce((s, c) => s + c, 0) / cvs.length;
};

describe.each(centers)('vertex %s', (center) => {
  const graph = fromKeyedEdges(datas.graphs[center]);

  it('draws polygons and optimizes them toward regular ones', async () => {
    const hyper = toG6Spec(graph, { centerNode: center });
    const poly = toG6Spec(graph, { centerNode: center, layout: { type: 'polygon' } });
    expect((poly.layout as any).type).toBe('polygon');
    expect((poly.plugins as any[]).every((p) => p.polygon)).toBe(true);
    expect((hyper.plugins as any[]).some((p) => p.polygon)).toBe(false);

    const before = await run(HypergraphLayout, hyper);
    const after = await run(PolygonLayout, poly);
    expect([...after.values()].every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    expect(after.get(center)).toEqual(before.get(center));

    const sets = (poly.plugins as any[]).map((p) => p.members as string[]);
    if (sets.length) expect(sideCV(after, sets)).toBeLessThan(sideCV(before, sets));
  });
});
