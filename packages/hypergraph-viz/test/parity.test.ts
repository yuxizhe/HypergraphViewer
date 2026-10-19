/**
 * 与迁移前的实现（test/legacy，来自 HypergraphViewer a898e07 的 dataProcessor.processGraphData、layouts/hypergraphLayout.js）对照：
 * 在同样输入下，toG6Spec 与 HypergraphLayout 的输出必须一致
 */
import { describe, expect, it } from 'vitest';
import { HypergraphLayout as LegacyLayout } from './legacy/layouts/hypergraphLayout.js';
import { processGraphData } from './legacy/dataProcessor.js';
import { generateEntityTypeColors } from './legacy/constants.js';
// 旧版内置的神经学数据（原 src/data.js），作为固定输入
import { datas } from './fixtures/neurology-data.js';
import { DEFAULT_THEME, fromKeyedEdges, HypergraphLayout, toG6Spec, typeColorsOf } from '../src';

const centers = Object.keys(datas.graphs).slice(0, 6);
const typeColors = generateEntityTypeColors(datas.vertices);
const pair = (a: string, b: string) => [a, b].sort().join('|');

const positions = async (Layout: any, data: any, options: any) => {
  const out = await new Layout({} as any, options).execute(structuredClone(data));
  return out.nodes.map((n: any) => [n.id, n.style?.x ?? n.data?.x, n.style?.y ?? n.data?.y]);
};

describe.each(centers)('vertex %s', (center) => {
  const graph = datas.graphs[center];

  it('type colors match generateEntityTypeColors', () => {
    // 调色板已扩到 12 色，按原 6 色调色板对照
    expect(typeColorsOf(datas.vertices, 'entity_type', DEFAULT_THEME.typePalette.slice(0, 6))).toEqual(typeColors);
  });

  it.each(['hyper', 'graph'] as const)('%s mode matches processGraphData', (mode) => {
    const legacy = processGraphData(graph, center, mode, typeColors);
    const spec = toG6Spec(fromKeyedEdges(graph), { mode, centerNode: center, typeColors });

    expect(spec.data.nodes).toEqual(legacy.data.nodes);
    const lines = (edges: any[]) =>
      edges.map(({ id: _, source, target, ...rest }) => ({ pair: pair(source, target), ...rest }));
    expect(lines(spec.data.edges!)).toEqual(lines(legacy.data.edges));

    const bubbles = (plugins: any[]) =>
      plugins.map(({ key, members, fill, stroke, fillOpacity, nodeR1 }) => ({ key, members, fill, stroke, fillOpacity, nodeR1 }));
    expect(bubbles(spec.plugins as any[])).toEqual(bubbles(legacy.plugins));

    const { hyperedges, labelText: _a, ...layout } = spec.layout as any;
    const { hyperedges: legacyHyperedges, labelText: _b, ...legacyLayout } = legacy.layout;
    expect(layout).toEqual(legacyLayout);
    expect(hyperedges?.map((h: any) => [h.id, h.members])).toEqual(legacyHyperedges?.map((h: any) => [h.id, h.members]));

    const nodeFill = (n: any) => (spec.node.style as any).fill(n);
    const legacyFill = (n: any) => legacy.node.style.fill(n);
    spec.data.nodes!.forEach((n) => expect(nodeFill(n)).toBe(legacyFill(n)));
  });

  it('layout positions match the legacy layout', async () => {
    const spec = toG6Spec(fromKeyedEdges(graph), { centerNode: center, typeColors });
    const options = { ...spec.layout, nodeSize: 20 };
    const data = { nodes: spec.data.nodes, edges: spec.data.edges };
    const result = await positions(HypergraphLayout, data, options);
    expect(result.every(([, x, y]: number[]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    expect(result).toEqual(await positions(LegacyLayout, data, options));
  });
});
