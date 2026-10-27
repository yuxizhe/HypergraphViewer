/**
 * Node 端无头渲染：需要已构建的 dist（hypergraph-viz.global.js）与可启动的浏览器，缺一则跳过
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { datas } from './fixtures/neurology-data.js';
import { fromKeyedEdges } from '../src';
import type { HeadlessRenderer } from '../src/node';
import { createHeadlessRenderer, createSVGRenderer } from '../src/node';

const built = existsSync(join(__dirname, '..', 'dist', 'hypergraph-viz.global.js'));
const center = Object.keys(datas.graphs)[0];
const data = fromKeyedEdges(datas.graphs[center]);
// PNG 文件头 / PNG signature
const isPng = (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

describe.skipIf(!built)('headless rendering', () => {
  let renderer: HeadlessRenderer | null = null;
  beforeAll(async () => {
    renderer = await createHeadlessRenderer().catch(() => null);
  }, 60_000);
  afterAll(() => renderer?.close());

  // 浏览器启动不了时不判失败（提示一下）/ no browser: warn instead of failing
  const ready = () => renderer || (console.warn('[node-render] no browser, skipped'), false);

  it.each(['canvas', 'matrix', 'dual'] as const)('renders %s as a PNG with the mapping table', async (layout) => {
    if (!ready()) return;
    const result = await renderer!.render({ data, centerNode: center, layout });
    expect(isPng(result.png)).toBe(true);
    expect(result.width).toBe(layout === 'dual' ? 1536 : 1024);
    expect(result.labelPx).toBeGreaterThan(0);
    expect(result.table).toContain('| e1 |');
    expect(result.key?.vertices.size).toBe(Object.keys(data.vertices).length);
  }, 60_000);

  it('shuffles positions by seed and takes hyperedge colors', async () => {
    if (!ready()) return;
    const he = data.hyperedges.find((h) => new Set(h.members).size > 2)!;
    const id = he.id ?? he.members.join('|#|');
    const base = { data, centerNode: center, layout: 'canvas' as const };
    const plain = await renderer!.render(base);
    const a = await renderer!.render({ ...base, shuffleSeed: 5, hyperedgeColors: { [id]: '#000000' } });
    const b = await renderer!.render({ ...base, shuffleSeed: 5, hyperedgeColors: { [id]: '#000000' } });
    expect(a.png.equals(b.png)).toBe(true);
    expect(a.png.equals(plain.png)).toBe(false);
    expect([...a.key!.hyperedges]).toEqual([...plain.key!.hyperedges]);
  }, 60_000);

  it.each(['star', 'clique'] as const)('renders graph mode (%s) the same every time', async (graphEdges) => {
    if (!ready()) return;
    const job = { data, centerNode: center, layout: 'canvas' as const, mode: 'graph' as const, graphEdges };
    const a = await renderer!.render(job);
    const b = await renderer!.render(job);
    expect(a.height).toBe(b.height);
    expect(a.png.equals(b.png)).toBe(true);
  }, 60_000);

  it('removes hidden types and fades the given vertices', async () => {
    if (!ready()) return;
    // 选一个与中心不同的类型，免得中心本身被去掉
    const centerType = data.vertices[center].entity_type;
    const typed = Object.keys(data.vertices).find((id) => data.vertices[id].entity_type && data.vertices[id].entity_type !== centerType)!;
    const type = data.vertices[typed].entity_type;
    const result = await renderer!.render({ data, centerNode: center, fade: [center], hideTypes: [type] });
    expect(result.fadedNodes).toEqual([center]);
    expect(result.key!.vertices.has(typed)).toBe(false);
    expect(result.legend[0]).toContain('(not drawn)');
  }, 60_000);
});

describe('SVG renderer (no browser)', () => {
  it.each(['canvas', 'matrix', 'dual'] as const)('renders %s as a PNG and an SVG', async (layout) => {
    const renderer = await createSVGRenderer();
    const result = await renderer.render({ data, centerNode: center, layout });
    expect(isPng(result.png)).toBe(true);
    expect(result.svg.startsWith('<svg')).toBe(true);
    expect(result.width).toBe(layout === 'dual' ? 1536 : 1024);
    // PNG 尺寸与 SVG 相同 / PNG matches the SVG size
    expect(result.png.readUInt32BE(16)).toBe(result.width);
    expect(result.png.readUInt32BE(20)).toBe(result.height);
    expect(result.table).toContain('| e1 |');
  }, 60_000);

  it('can skip the PNG', async () => {
    const renderer = await createSVGRenderer({ png: false });
    const result = await renderer.render({ data, centerNode: center });
    expect(result.png.length).toBe(0);
    expect(result.geometry?.nodes.length).toBeGreaterThan(0);
  });
});
