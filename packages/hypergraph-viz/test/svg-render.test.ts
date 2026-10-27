/**
 * 纯 SVG 渲染：不需要浏览器。坐标与超图布局一致、结果确定；轮廓、编号、标签都画出；图模式沿用同一份坐标；拼图与图例
 */
import { describe, expect, it } from 'vitest';
import { datas } from './fixtures/neurology-data.js';
import { closedSpline, composeSVG, fromKeyedEdges, HypergraphLayout, renderHypergraphSVG, renderJobSVG, toG6Spec } from '../src';

const center = Object.keys(datas.graphs)[0];
const graph = fromKeyedEdges(datas.graphs[center]);
const count = (s: string, sub: string) => s.split(sub).length - 1;

describe('renderHypergraphSVG', () => {
  it('places vertices exactly where the hypergraph layout does', async () => {
    const options = { centerNode: center, modelReadable: true };
    const svg = await renderHypergraphSVG(graph, options);
    const spec = toG6Spec(graph, options);
    const laid = await new HypergraphLayout({} as any, spec.layout as any).execute(structuredClone({ nodes: spec.data.nodes, edges: spec.data.edges }));
    const expected = new Map(laid.nodes!.map((n: any) => [n.id, [n.style.x, n.style.y]]));
    svg.nodes.forEach((n) => expect([n.x, n.y]).toEqual(expected.get(n.id)));
  });

  it('is deterministic and draws every contour, code tag and label', async () => {
    const a = await renderHypergraphSVG(graph, { centerNode: center, modelReadable: true });
    const b = await renderHypergraphSVG(graph, { centerNode: center, modelReadable: true });
    expect(a.svg).toBe(b.svg);
    const spec = toG6Spec(graph, { centerNode: center, modelReadable: true });
    expect(a.contours).toHaveLength((spec.plugins as any[]).length);
    a.contours.forEach((c) => expect(c.d).toMatch(/^M[-\d.]+,[-\d.]+C/));
    spec.modelReadable!.tags.forEach((t) => expect(a.svg).toContain(`>${t.code}</text>`));
    expect(a.tags).toHaveLength(spec.modelReadable!.tags.length);
    // 每个实体一个圆和一个编号开头的标签 / one circle and one coded label per vertex
    expect(count(a.svg, '<circle')).toBe(spec.data.nodes!.length);
    spec.data.nodes!.forEach((n) => expect(a.svg).toContain(`>${spec.modelReadable!.key.vertices.get(n.id)} `));
    // MR：只描边 / outlines only
    expect(a.svg).not.toMatch(/<path d="M[^"]*" fill="#[0-9a-fA-F]+" fill-opacity="0\.[1-9]/);
  });

  it('keeps the coordinates in graph mode and draws hyperedge nodes as diamonds', async () => {
    const hyper = await renderHypergraphSVG(graph, { centerNode: center, modelReadable: true });
    const star = await renderHypergraphSVG(graph, { centerNode: center, modelReadable: true, mode: 'graph', graphEdges: 'star' });
    const at = new Map(hyper.nodes.map((n) => [n.id, [n.x, n.y]]));
    const vertices = star.nodes.filter((n) => n.hyperedge === undefined);
    vertices.forEach((n) => expect([n.x, n.y]).toEqual(at.get(n.id)));
    const diamonds = star.nodes.filter((n) => n.hyperedge !== undefined);
    expect(diamonds).toHaveLength(hyper.contours.length);
    expect(star.contours).toHaveLength(0);
    // 菱形与实体及其标签不重叠 / diamonds clear of vertices and their labels
    const hit = (a: any, b: any) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    diamonds.forEach((d) => {
      const box = { x0: d.x - d.r, y0: d.y - d.r, x1: d.x + d.r, y1: d.y + d.r };
      vertices.forEach((v) => {
        expect(hit(box, { x0: v.x - v.r, y0: v.y - v.r, x1: v.x + v.r, y1: v.y + v.r })).toBe(false);
        if (v.label) expect(hit(box, v.label)).toBe(false);
      });
    });
  });

  it('draws polygons and shuffled layouts', async () => {
    const poly = await renderHypergraphSVG(graph, { centerNode: center, modelReadable: true, layout: { type: 'polygon' } });
    poly.contours.forEach((c) => expect(c.d).toMatch(/Z$/));
    const plain = await renderHypergraphSVG(graph, { centerNode: center, modelReadable: true });
    const shuffled = await renderHypergraphSVG(graph, { centerNode: center, modelReadable: true, layout: { shuffleSeed: 3 } });
    expect(shuffled.nodes.some((n, i) => n.x !== plain.nodes[i].x)).toBe(true);
  });
});

describe('composeSVG and renderJobSVG', () => {
  it('lays panels side by side with the legend below', async () => {
    const res = await renderJobSVG({ data: graph, centerNode: center, layout: 'dual', fade: [center], locale: 'en' });
    expect(res.width).toBe(1536);
    expect(count(res.svg, '<svg')).toBe(3);
    expect(res.legend[0]).toContain('(not drawn)');
    expect(res.svg).toContain(res.legend[0].slice(0, 10));
    expect(res.labelPx).toBeGreaterThan(0);
    expect(res.table).toContain('| e1 |');
  });

  it('caps the zoom of small panels', () => {
    const tiny = { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"></svg>', width: 10, height: 10, fontSize: 12 };
    const out = composeSVG([tiny], { width: 1024, maxScale: 2 });
    expect(out.labelPx).toBe(24);
    expect(out.height).toBe(20 + 32);
  });

  it('builds a closed spline through the points', () => {
    const d = closedSpline([[0, 0], [10, 0], [10, 10], [0, 10]]);
    expect(d.startsWith('M0,10')).toBe(true);
    // 同 G6：首尾各补两点，n 个点得到 n + 1 段 / as G6: two points padded at each end, n + 1 segments
    expect(count(d, 'C')).toBe(5);
  });
});
