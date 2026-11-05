/**
 * 模型可读（MR）模式：编号、图例、映射表、编号标签放置，以及 toG6Spec 中的 MR 配置
 */
import { describe, expect, it } from 'vitest';
import { datas } from './fixtures/neurology-data.js';
import {
  fromKeyedEdges, hyperedgeIdOf, modelReadableKey, themeOf, modelReadableLegend, modelReadableTable, placeTags, toG6Spec,
} from '../src';
import type { HypergraphData } from '../src';

const small: HypergraphData = {
  vertices: { hub: { entity_type: 'org' }, a: {}, b: {}, c: {}, d: {} },
  hyperedges: [
    { id: 'h1', members: ['hub', 'a', 'b'], description: 'first' },
    { id: 'h2', members: ['hub', 'b', 'c'] },
    { id: 'h3', members: ['hub', 'd'] },
    { id: 'h4', members: ['a', 'c', 'd'] },
    { id: 'h5', members: ['a'] },
  ],
};

describe('modelReadableKey', () => {
  it('codes the center first, then by degree, and hyperedges in data order', () => {
    const key = modelReadableKey(small, { centerNode: 'd' });
    expect(key.vertices.get('d')).toBe('v1');
    expect(key.vertices.get('hub')).toBe('v2');
    // a、b、c 度数均为 2，按 id
    expect(['a', 'b', 'c'].map((id) => key.vertices.get(id))).toEqual(['v3', 'v4', 'v5']);
    expect([...key.hyperedges.values()]).toEqual(['e1', 'e2', 'e3', 'e4']);
    expect(key.hyperedges.has('h5')).toBe(false);
  });

  it('is deterministic', () => {
    const graph = fromKeyedEdges(datas.graphs[Object.keys(datas.graphs)[0]]);
    const a = modelReadableKey(graph);
    const b = modelReadableKey(structuredClone(graph));
    expect([...a.vertices]).toEqual([...b.vertices]);
    expect([...a.hyperedges]).toEqual([...b.hyperedges]);
    expect(new Set(a.vertices.values()).size).toBe(Object.keys(graph.vertices).length);
  });
});

describe('modelReadableLegend', () => {
  it('writes faded hubs as "all except" past half, and lists undrawn hyperedges', () => {
    const key = modelReadableKey(small);
    const lines = modelReadableLegend(key, { faded: ['hub'], locale: 'en' });
    // hub 属于 e1 e2 e3，不属于 e4
    expect(lines[0]).toBe('v1 hub (not drawn) is in every hyperedge except e4');
    // h3 = {hub, d} 淡出 hub 后只剩 d
    expect(lines).toContain(`e3 = {v1, ${key.vertices.get('d')}} (not drawn)`);
    expect(lines).toHaveLength(2);
  });

  it('merges undrawn hyperedges with the same members, or the same hubs plus one vertex', () => {
    const data: HypergraphData = {
      vertices: { hub: {}, x: {}, y: {}, z: {}, w: {} },
      hyperedges: [
        { id: 'a', members: ['hub', 'x'] },
        { id: 'b', members: ['hub', 'y'] },
        { id: 'c', members: ['hub', 'z'] },
        { id: 'd', members: ['hub', 'z'] },
        { id: 'f', members: ['x', 'y', 'w'] },
      ],
    };
    const key = modelReadableKey(data);
    const code = (id: string) => key.vertices.get(id);
    const lines = modelReadableLegend(key, { faded: ['hub'], locale: 'en' });
    expect(lines).toHaveLength(3);
    expect(lines).toContain(`Not drawn, each with v1 plus: e1 ${code('x')}, e2 ${code('y')}`);
    expect(lines).toContain(`e3, e4 = {v1, ${code('z')}} (not drawn)`);
  });

  it('lists the hyperedges of a hub in at most half of them', () => {
    const key = modelReadableKey(small);
    const [line] = modelReadableLegend(key, { faded: ['d'], locale: 'zh' });
    expect(line).toBe(`${key.vertices.get('d')} d（未画出） 属于 e3、e4`);
  });

  it('is empty without faded vertices', () => {
    expect(modelReadableLegend(modelReadableKey(small))).toEqual([]);
  });
});

describe('modelReadableTable', () => {
  it('maps every code to its vertex and members', () => {
    const key = modelReadableKey(small);
    const table = modelReadableTable(small, key, { faded: ['hub'] });
    expect(table).toContain('| v1 | hub | org |');
    expect(table).toContain(`| e1 | v1, ${key.vertices.get('a')}, ${key.vertices.get('b')} | first |`);
    expect(table).toContain('## Legend');
  });
});

describe('placeTags', () => {
  it('keeps tags off obstacles and off each other', () => {
    const obstacle = { x0: -10, y0: -10, x1: 10, y1: 10 };
    const tags = [0, 1, 2].map((i) => ({ id: `t${i}`, text: `e${i}`, anchor: { x: 0, y: 0 }, size: 3 + i }));
    const placed = placeTags(tags, [obstacle], 12);
    const boxes = [...placed.values()].map(({ x, y }) => ({ x0: x - 10, y0: y - 8, x1: x + 10, y1: y + 8 }));
    const hit = (a: any, b: any) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    boxes.forEach((b, i) => {
      expect(hit(b, obstacle)).toBe(false);
      boxes.slice(i + 1).forEach((o) => expect(hit(b, o)).toBe(false));
    });
  });
});

describe('toG6Spec with modelReadable', () => {
  const center = Object.keys(datas.graphs)[0];
  const graph = fromKeyedEdges(datas.graphs[center]);

  it('labels vertices with codes, keeps labels apart, outlines contours and tags them', () => {
    const spec = toG6Spec(graph, {
      centerNode: center,
      modelReadable: { vertexLabel: 'code' },
      labelBy: 'degree',
      layout: { preventLabelOverlap: false },
    });
    const mr = spec.modelReadable!;
    const label = (spec.node.style as any).labelText;
    spec.data.nodes!.forEach((n) => expect(label(n)).toBe(mr.key.vertices.get(n.id)));
    expect((spec.layout as any).preventLabelOverlap).toBe(true);
    expect((spec.node.style as any).labelFontSize).toBe(12);
    const plugins = spec.plugins as any[];
    expect(plugins.length).toBeGreaterThan(0);
    plugins.forEach((p) => expect(p.fillOpacity).toBe(0));
    expect(mr.tags.map((t) => t.id).sort()).toEqual(plugins.map((p) => p.hyperedge.id).sort());
    // 调色板用完一轮后，同色的超边换线型 / same color after the palette wraps: different dash
    if (plugins.length > 10) expect(plugins.some((p) => p.lineDash)).toBe(true);
  });

  it('fills contours only when fillOpacity is given', () => {
    const outline = toG6Spec(graph, { centerNode: center, modelReadable: true });
    const filled = toG6Spec(graph, { centerNode: center, modelReadable: { fillOpacity: 0.1 } });
    (outline.plugins as any[]).forEach((p) => expect(p.fillOpacity).toBe(0));
    (filled.plugins as any[]).forEach((p) => expect(p.fillOpacity).toBe(0.1));
    expect(themeOf({ modelReadable: { fillOpacity: 0.1 } }).bubble.highlight.fillOpacity).toBeCloseTo(0.22);
  });

  it('tells apart hyperedges given the same color by dash and shade', () => {
    const ids = graph.hyperedges.filter((he) => new Set(he.members).size > 2).map(hyperedgeIdOf);
    const spec = toG6Spec(graph, {
      centerNode: center,
      modelReadable: true,
      hyperedgeColors: Object.fromEntries(ids.map((id) => [id, '#1f6feb'])),
    });
    const styles = (spec.plugins as any[]).map((p) => `${p.stroke}|${p.lineDash ?? 'solid'}`);
    // 前 12 条两两不同，色相仍是蓝色系 / the first 12 are pairwise distinct
    const first = styles.slice(0, 12);
    expect(new Set(first).size).toBe(first.length);
    expect(styles[0].startsWith('#1f6feb|solid')).toBe(true);
    // 非 MR 模式照用给定的颜色 / outside MR the given color is used as is
    const plain = toG6Spec(graph, { centerNode: center, hyperedgeColors: Object.fromEntries(ids.map((id) => [id, '#1f6feb'])) });
    (plain.plugins as any[]).forEach((p) => expect(p.stroke).toBe('#1f6feb'));
  });

  it('labels lines of 2-member hyperedges with their codes', () => {
    const spec = toG6Spec(small, { modelReadable: true });
    const key = spec.modelReadable!.key;
    const edgeLabel = (spec.edge.style as any).labelText;
    const line = spec.data.edges!.find((e) => spec.lineHyperedges.get(e.id!)?.includes('h3'))!;
    expect(edgeLabel(line)).toBe(key.hyperedges.get('h3'));
    expect((spec.node.style as any).labelText({ id: 'a' })).toBe(`${key.vertices.get('a')} a`);
  });

  it('labels hyperedge nodes in star graph mode', () => {
    const spec = toG6Spec(small, { mode: 'graph', graphEdges: 'star', modelReadable: true });
    const key = spec.modelReadable!.key;
    const label = (spec.node.style as any).labelText;
    spec.hyperedgeNodes.forEach((he, nodeId) => expect(label({ id: nodeId })).toBe(key.hyperedges.get(he)));
    // 超边节点的连线不标
    const star = spec.data.edges!.find((e) => String(e.id).startsWith('hyperedge:'))!;
    expect((spec.edge.style as any).labelText(star)).toBe('');
  });

  it('leaves the default rendering unchanged', () => {
    const spec = toG6Spec(graph, { centerNode: center });
    expect(spec.modelReadable).toBeNull();
    expect((spec.edge.style as any).labelText).toBeUndefined();
    expect(graph.hyperedges.every((he) => hyperedgeIdOf(he) !== undefined)).toBe(true);
  });
});
