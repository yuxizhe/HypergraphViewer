#!/usr/bin/env node
// 批量把超图渲染成给模型看的图片（无头浏览器），每张图输出 PNG + 编号映射表（Markdown），并写一份 manifest.jsonl。
// 需要先构建（npm run build）并安装 playwright。用法：
//   node scripts/render-mr.mjs --hif ../../public/datasets/nvda.hif.json --top 3 --layout canvas,matrix,dual --out out/
//   node scripts/render-mr.mjs --hif nvda.hif.json --center 范围:NVDA:超大规模云 --hide-types 财季 --layout dual --locale zh
//   node scripts/render-mr.mjs --data graph.json --center 公司:英伟达 --layout dual --locale zh
// --hif：HIF 文件，按中心实体取邻域子图（--center 可重复，或 --top N 取最大的 N 个）；--data：单个 { vertices, hyperedges }
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { fromHIF, fromKeyedEdges } from '../dist/index.js';
import { createHeadlessRenderer } from '../dist/node.js';

const { values } = parseArgs({
  options: {
    hif: { type: 'string' },
    data: { type: 'string' },
    center: { type: 'string', multiple: true },
    top: { type: 'string' },
    layout: { type: 'string', default: 'canvas' },
    mode: { type: 'string', default: 'hyper' },
    'graph-edges': { type: 'string', default: 'star' },
    polygon: { type: 'boolean', default: false },
    'shuffle-seed': { type: 'string' },
    fade: { type: 'string', default: 'overlap' },
    'hide-types': { type: 'string' },
    'no-mr': { type: 'boolean', default: false },
    'vertex-label': { type: 'string', default: 'code+name' },
    fill: { type: 'string', default: '0' },
    'matrix-order': { type: 'string', default: 'degree' },
    width: { type: 'string' },
    locale: { type: 'string', default: 'en' },
    out: { type: 'string', default: 'out' },
  },
});

if (!values.hif && !values.data) {
  console.error('需要 --hif <file> 或 --data <file> / pass --hif or --data');
  process.exit(1);
}

// 要渲染的子图：[名称, 数据, 中心]
let graphs;
if (values.data) {
  const data = JSON.parse(readFileSync(values.data, 'utf8'));
  graphs = [[values.center?.[0] ?? 'graph', data, values.center?.[0]]];
} else {
  const local = fromHIF(JSON.parse(readFileSync(values.hif, 'utf8')));
  let centers = values.center;
  if (!centers) {
    const n = Number(values.top ?? 1);
    centers = Object.keys(local.graphs)
      .sort((a, b) => Object.keys(local.graphs[b].vertices).length - Object.keys(local.graphs[a].vertices).length)
      .slice(0, n);
  }
  graphs = centers.map((c) => {
    if (!local.graphs[c]) throw new Error(`没有以 ${c} 为中心的子图 / no subgraph centered at ${c}`);
    return [c, fromKeyedEdges(local.graphs[c]), c];
  });
}

const layouts = values.layout.split(',');
const fade = values.fade === 'overlap' || values.fade === 'none' ? values.fade : values.fade.split(',');
const safe = (s) => String(s).replace(/[\\/:*?"<>|\s]+/g, '_');
mkdirSync(values.out, { recursive: true });
const manifest = join(values.out, 'manifest.jsonl');

const renderer = await createHeadlessRenderer();
try {
  for (const [name, data, centerNode] of graphs) {
    for (const layout of layouts) {
      const result = await renderer.render({
        data,
        centerNode,
        layout,
        mode: values.mode,
        graphEdges: values['graph-edges'],
        layoutType: values.polygon ? 'polygon' : 'hypergraph',
        shuffleSeed: values['shuffle-seed'] === undefined ? undefined : Number(values['shuffle-seed']),
        fade,
        hideTypes: values['hide-types']?.split(','),
        modelReadable: values['no-mr'] ? false : { vertexLabel: values['vertex-label'], fillOpacity: Number(values.fill) },
        matrixOrder: values['matrix-order'],
        width: values.width ? Number(values.width) : undefined,
        locale: values.locale,
      });
      const seed = values['shuffle-seed'] === undefined ? '' : `.shuffle${values['shuffle-seed']}`;
      const base = join(values.out, `${safe(name)}.${layout}${seed}`);
      writeFileSync(`${base}.png`, result.png);
      if (result.table) writeFileSync(`${base}.md`, result.table);
      const row = {
        name,
        layout,
        png: `${base}.png`,
        table: result.table ? `${base}.md` : null,
        width: result.width,
        height: result.height,
        labelPx: result.labelPx,
        vertices: result.key?.vertices.size ?? Object.keys(data.vertices).length,
        hyperedges: result.key?.hyperedges.size ?? data.hyperedges.length,
        faded: result.fadedNodes,
        ms: result.ms,
      };
      appendFileSync(manifest, `${JSON.stringify(row)}\n`);
      console.log(`${row.png}  ${row.width}×${row.height}  label ${row.labelPx}px  ${row.ms}ms`);
    }
  }
} finally {
  await renderer.close();
}
