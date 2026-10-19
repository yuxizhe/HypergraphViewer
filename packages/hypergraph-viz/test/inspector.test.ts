/**
 * 右侧面板用到的纯函数：统计、隐藏过滤、颜色按 id 固定、选择状态、样式与布局选项
 */
import { describe, expect, it } from 'vitest';
import {
  EMPTY_SELECTION,
  filterHypergraph,
  hyperedgeColorsOf,
  hypergraphStats,
  nextSelection,
  selectionStyles,
  toG6Spec,
} from '../src';
import type { HypergraphData } from '../src';

// hub 在 6 条超边中的 5 条；x、y 与其余部分不连通
const data: HypergraphData = {
  vertices: {
    hub: { entity_type: 'A' },
    a: { entity_type: 'A' },
    b: { entity_type: 'B' },
    c: { entity_type: 'B' },
    d: { entity_type: 'B' },
    x: {},
    y: {},
  },
  hyperedges: [
    { id: 'e1', members: ['hub', 'a', 'b'] },
    { id: 'e2', members: ['hub', 'b', 'c'] },
    { id: 'e3', members: ['hub', 'c', 'd'] },
    { id: 'e4', members: ['hub', 'a'] },
    { id: 'e5', members: ['hub', 'd', 'a', 'b'] },
    { id: 'e6', members: ['x', 'y'] },
  ],
};

describe('hypergraphStats', () => {
  const s = hypergraphStats(data);

  it('counts vertices, hyperedges, lines and sizes', () => {
    expect([s.vertexCount, s.hyperedgeCount, s.lineCount, s.maxSize]).toEqual([7, 4, 2, 4]);
    expect(Object.fromEntries(s.sizes)).toEqual({ 2: 2, 3: 3, 4: 1 });
    expect(s.degree.get('hub')).toBe(5);
    expect(s.avgDegree).toBeCloseTo(17 / 7);
  });

  it('finds types, components and hubs', () => {
    expect(s.types).toEqual([
      { type: 'B', count: 3 },
      { type: 'A', count: 2 },
      { type: null, count: 2 },
    ]);
    expect(s.components).toEqual([5, 2]);
    expect(s.hubs).toEqual(['hub', 'a', 'b']);
    expect(hypergraphStats(data, { hubRatio: 0.8 }).hubs).toEqual(['hub']);
  });

  it('reports no hubs in small graphs', () => {
    expect(hypergraphStats(data, { hubMinEdges: 7 }).hubs).toEqual([]);
  });
});

describe('filterHypergraph', () => {
  it('removes hidden members and drops hyperedges left with fewer than 2', () => {
    const out = filterHypergraph(data, { nodes: ['hub'], hyperedges: ['e6'] });
    expect(Object.keys(out.vertices)).not.toContain('hub');
    expect(out.hyperedges.map((h) => [h.id, h.members])).toEqual([
      ['e1', ['a', 'b']],
      ['e2', ['b', 'c']],
      ['e3', ['c', 'd']],
      ['e5', ['d', 'a', 'b']],
    ]);
  });

  it('keeps the original id of hyperedges without one', () => {
    const out = filterHypergraph({ vertices: data.vertices, hyperedges: [{ members: ['a', 'b', 'c'] }] }, { nodes: ['c'] });
    expect(out.hyperedges[0].id).toBe('a|#|b|#|c');
  });

  it('returns the input when nothing is hidden', () => {
    expect(filterHypergraph(data, {})).toBe(data);
  });
});

describe('hyperedge colors', () => {
  it('stay the same after hiding hyperedges', () => {
    const colors = hyperedgeColorsOf(data);
    const fill = (d: HypergraphData) =>
      Object.fromEntries((toG6Spec(d, { hyperedgeColors: colors }).plugins as any[]).map((p) => [p.hyperedge.id, p.fill]));
    const all = fill(data);
    const hidden = fill(filterHypergraph(data, { hyperedges: ['e1', 'e2'] }));
    expect(hidden.e3).toBe(all.e3);
    expect(hidden.e5).toBe(all.e5);
  });

  it('default to the order in the data', () => {
    const spec = toG6Spec(data);
    const colors = hyperedgeColorsOf(data);
    (spec.plugins as any[]).forEach((p) => expect(p.fill).toBe(colors[p.hyperedge.id]));
  });
});

describe('selectionStyles', () => {
  const spec = toG6Spec(data);

  it('is all normal without a selection', () => {
    const { states, bubbles } = selectionStyles(spec, EMPTY_SELECTION);
    expect(Object.values(states).every((s) => s.length === 0)).toBe(true);
    expect(Object.values(bubbles).every((b) => b === 'normal')).toBe(true);
  });

  it('highlights a selected hyperedge and its members', () => {
    const { states, bubbles } = selectionStyles(spec, { nodes: [], hyperedges: ['e2'] });
    expect(['hub', 'b', 'c'].map((id) => states[id])).toEqual([['highlight'], ['highlight'], ['highlight']]);
    expect(states.a).toEqual(['inactive']);
    expect(bubbles.e2).toBe('highlight');
    expect(bubbles.e1).toBe('dimmed');
  });

  it('keeps hyperedges around a selected vertex normal', () => {
    const { states, bubbles } = selectionStyles(spec, { nodes: ['c'], hyperedges: [] });
    expect(states.c).toEqual(['highlight']);
    expect(states.d).toEqual([]);
    expect(states.a).toEqual(['inactive']);
    expect([bubbles.e2, bubbles.e3, bubbles.e1]).toEqual(['normal', 'normal', 'dimmed']);
  });

  it('maps lines to their hyperedges', () => {
    const { states } = selectionStyles(spec, { nodes: [], hyperedges: ['e4'] });
    expect(states['a|#|hub']).toEqual(['highlight']);
    expect(states['x|#|y']).toEqual(['inactive']);
  });

  it('adds active for hovered elements', () => {
    const { states, bubbles } = selectionStyles(spec, EMPTY_SELECTION, { hyperedges: ['e3'] });
    expect(states.d).toEqual(['active']);
    expect(bubbles.e3).toBe('highlight');
  });

  it('ignores ids that are not drawn', () => {
    const { states } = selectionStyles(spec, { nodes: ['gone'], hyperedges: [] });
    expect(states.a).toEqual([]);
  });
});

describe('nextSelection', () => {
  const sel = { nodes: ['a'], hyperedges: [] };

  it('selects alone, toggles off, clears on blank', () => {
    expect(nextSelection(EMPTY_SELECTION, { kind: 'nodes', id: 'a' }, false)).toEqual(sel);
    expect(nextSelection(sel, { kind: 'nodes', id: 'a' }, false)).toEqual(EMPTY_SELECTION);
    expect(nextSelection(sel, { kind: 'hyperedges', id: 'e1' }, false)).toEqual({ nodes: [], hyperedges: ['e1'] });
    expect(nextSelection(sel, null, false)).toEqual(EMPTY_SELECTION);
  });

  it('adds and removes with shift', () => {
    const two = nextSelection(sel, { kind: 'hyperedges', id: 'e1' }, true);
    expect(two).toEqual({ nodes: ['a'], hyperedges: ['e1'] });
    expect(nextSelection(two, { kind: 'nodes', id: 'a' }, true)).toEqual({ nodes: [], hyperedges: ['e1'] });
    expect(nextSelection(two, null, true)).toBe(two);
  });
});

describe('spec options', () => {
  it('turns contours off but still lays out by hyperedges', () => {
    const spec = toG6Spec(data, { contours: false });
    expect(spec.plugins).toEqual([]);
    expect((spec.layout as any).hyperedges).toHaveLength(4);
  });

  it('applies per-vertex colors over type colors', () => {
    const spec = toG6Spec(data, { typeColors: { A: '#111111' }, nodeColors: { a: '#222222' } });
    const fill = (spec.node.style as any).fill;
    expect(fill({ id: 'a', entity_type: 'A' })).toBe('#222222');
    expect(fill({ id: 'hub', entity_type: 'A' })).toBe('#111111');
  });

  it('switches layouts', () => {
    expect((toG6Spec(data, { layout: { type: 'force' } }).layout as any).nodeClusterBy).toBe('cluster');
    expect((toG6Spec(data, { layout: { type: 'circular' } }).layout as any).type).toBe('circular');
    expect((toG6Spec(data, { mode: 'graph', layout: { type: 'hypergraph' } }).layout as any).type).toBe('force');
    const custom = toG6Spec(data, { centerNode: 'hub', layout: { nodeSpacing: 20, preventLabelOverlap: false, useCenter: false } });
    expect(custom.layout).toMatchObject({ type: 'hypergraph', nodeSpacing: 20, preventLabelOverlap: false, centerNode: undefined });
  });

  it('sizes nodes by degree', () => {
    const spec = toG6Spec(data, { nodeSizeBy: 'degree' });
    const size = (spec.node.style as any).size;
    expect(size({ id: 'hub' })).toBe(30);
    expect(size({ id: 'x' })).toBeLessThan(size({ id: 'hub' }));
    expect(typeof (spec.layout as any).nodeSize).toBe('function');
  });

  it('sets contour bounds', () => {
    expect((toG6Spec(data, { contourBounds: 'render' }).plugins as any[])[0].memberBoundsType).toBe('render');
  });
});
