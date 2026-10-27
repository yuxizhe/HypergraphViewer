/**
 * KelpFusion：最短路径图、绕开非成员、空面填充、共用边平行错开；toG6Spec 与 SVG 渲染器中的 kelp 画法
 */
import { describe, expect, it } from 'vitest';
import { datas } from './fixtures/neurology-data.js';
import { fromKeyedEdges, kelpFusion, kelpPathString, renderHypergraphSVG, toG6Spec } from '../src';

const P: Record<string, [number, number]> = { a: [0, 0], b: [100, 0], c: [200, 0], d: [100, 80], x: [50, 40] };
const at = (id: string) => P[id];

describe('kelpFusion', () => {
  it('keeps only edges that are shortest paths (a chain, not a triangle)', () => {
    const shape = kelpFusion([{ id: 's', members: ['a', 'b', 'c'] }], at, ['a', 'b', 'c']).get('s')!;
    // d^2：a–c 直连 40000 > a–b–c 20000，不保留 / a–c is not a shortest path
    expect(shape.edges.map((e) => e.join('-')).sort()).toEqual(['a-b', 'b-c']);
    expect(shape.faces).toHaveLength(0);
  });

  it('fills empty triangles but not those containing a non-member', () => {
    const empty = kelpFusion([{ id: 's', members: ['a', 'b', 'd'] }], at, ['a', 'b', 'd']).get('s')!;
    expect(empty.faces).toHaveLength(1);
    const blocked = kelpFusion([{ id: 's', members: ['a', 'b', 'd'] }], at, ['a', 'b', 'd', 'x']).get('s')!;
    expect(blocked.faces).toHaveLength(0);
  });

  it('offsets shared edges in parallel, symmetric around the edge', () => {
    const shapes = kelpFusion(
      [
        { id: 's1', members: ['a', 'b', 'c'] },
        { id: 's2', members: ['a', 'b', 'c'] },
      ],
      at,
      ['a', 'b', 'c'],
      { gap: 6 },
    );
    const y1 = shapes.get('s1')!.segments[0][0][1];
    const y2 = shapes.get('s2')!.segments[0][0][1];
    expect(y1).toBeCloseTo(-y2);
    expect(Math.abs(y1 - y2)).toBeCloseTo(6);
  });

  it('builds a path with closed faces and open segments', () => {
    const shape = kelpFusion([{ id: 's', members: ['a', 'b', 'd'] }], at, ['a', 'b', 'd']).get('s')!;
    const d = kelpPathString(shape);
    expect(d.match(/Z/g)).toHaveLength(shape.faces.length);
    expect(d.match(/M/g)).toHaveLength(shape.faces.length + shape.segments.length);
  });
});

describe('kelp drawing', () => {
  const center = Object.keys(datas.graphs)[0];
  const graph = fromKeyedEdges(datas.graphs[center]);

  it('flags contours as kelp only with the kelp layout', () => {
    const kelp = toG6Spec(graph, { centerNode: center, layout: { type: 'kelp' } }).plugins as any[];
    expect(kelp.every((p) => p.kelp === true && p.lineCap === 'round')).toBe(true);
    const bubble = toG6Spec(graph, { centerNode: center }).plugins as any[];
    expect(bubble.every((p) => p.kelp === false)).toBe(true);
    // 坐标与超图布局相同：布局类型换回 hypergraph / the layout itself is the hypergraph layout
    expect((toG6Spec(graph, { centerNode: center, layout: { type: 'kelp' } }).layout as any).type).toBe('hypergraph');
    // 图模式下不生效 / no kelp in graph mode
    const graphMode = toG6Spec(graph, { centerNode: center, mode: 'graph', layout: { type: 'kelp' } });
    expect((graphMode.layout as any).type).toBe('force');
  });

  it('renders kelp paths in SVG on the same coordinates as the contours', async () => {
    const bubble = await renderHypergraphSVG(graph, { centerNode: center, modelReadable: true });
    const kelp = await renderHypergraphSVG(graph, { centerNode: center, modelReadable: true, layout: { type: 'kelp' } });
    expect(kelp.nodes.map((n) => [n.x, n.y])).toEqual(bubble.nodes.map((n) => [n.x, n.y]));
    expect(kelp.contours).toHaveLength(bubble.contours.length);
    kelp.contours.forEach((c) => expect(c.d).not.toContain('C'));
    expect(kelp.svg).toContain('stroke-linecap="round"');
    expect(kelp.tags).toHaveLength(bubble.tags.length);
  });
});
