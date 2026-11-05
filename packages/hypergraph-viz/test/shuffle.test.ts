/**
 * 打乱布局：同一种子结果相同、不同种子不同，节点与标签互不重叠；toG6Spec 中 shuffleSeed 取代布局，画法不变
 */
import { describe, expect, it } from 'vitest';
import { datas } from './fixtures/neurology-data.js';
import { charWidth, fromKeyedEdges, ShuffleLayout, toG6Spec } from '../src';

const center = Object.keys(datas.graphs)[0];
const graph = fromKeyedEdges(datas.graphs[center]);

const run = async (seed: number) => {
  const spec = toG6Spec(graph, { centerNode: center, modelReadable: true, layout: { shuffleSeed: seed } });
  const out = await new ShuffleLayout({} as any, spec.layout as any).execute(structuredClone({ nodes: spec.data.nodes, edges: spec.data.edges }));
  return { spec, pos: new Map(out.nodes!.map((n: any) => [n.id, [n.style.x, n.style.y] as [number, number]])) };
};

describe('shuffle layout', () => {
  it('is deterministic per seed and differs across seeds', async () => {
    const a = await run(7);
    const b = await run(7);
    const c = await run(8);
    expect([...a.pos]).toEqual([...b.pos]);
    expect([...a.pos].some(([id, p]) => p[0] !== c.pos.get(id)![0] || p[1] !== c.pos.get(id)![1])).toBe(true);
  });

  it('keeps nodes and their labels apart', async () => {
    const { spec, pos } = await run(3);
    const style = spec.node.style as any;
    const boxes = spec.data.nodes!.map((d) => {
      const [x, y] = pos.get(d.id)!;
      const text = style.labelText(d);
      const w = [...text].reduce((s: number, ch: string) => s + 12 * charWidth(ch), 0);
      const r = 10;
      return [Math.min(x - r, x - w / 2), y - r, Math.max(x + r, x + w / 2), y + r + 12 * 1.3];
    });
    const hit = (a: number[], b: number[]) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => expect(hit(a, b)).toBe(false)));
  });

  it('replaces the layout but keeps contours and codes', async () => {
    const { spec } = await run(1);
    const plain = toG6Spec(graph, { centerNode: center, modelReadable: true });
    expect((spec.layout as any).type).toBe('shuffle');
    expect((spec.plugins as any[]).map((p) => p.key)).toEqual((plain.plugins as any[]).map((p) => p.key));
    expect([...spec.modelReadable!.key.hyperedges]).toEqual([...plain.modelReadable!.key.hyperedges]);
  });
});
