import type { ID } from '@antv/g6';
import { charWidth } from './layout';
import type { MatrixOrder } from './matrix';
import { incidenceMatrix } from './matrix';
import type { ModelReadableOptions } from './model-readable';
import { modelReadableKey, modelReadableLabel } from './model-readable';
import type { HyperedgeItem, HypergraphData } from './spec';
import type { HypergraphTheme } from './theme';
import { resolveTheme, typeColorsOf } from './theme';

export interface MatrixSVGOptions {
  order?: MatrixOrder;
  typeField?: string;
  centerNode?: ID;
  typeColors?: Record<string, string>;
  nodeColors?: Record<ID, string>;
  hyperedgeColors?: Record<ID, string>;
  /** 枢纽（如画布上淡出的），行首虚线圈 / hubs, drawn with a dashed ring */
  hubNodes?: ID[];
  /** 实体名，默认为 id；MR 模式下前面加编号 / vertex name, defaults to the id; prefixed with its code in MR mode */
  labelText?: (id: ID) => string;
  /** 列标签；MR 模式下默认为 e 编号，否则为超边的 description 等（截断）/ column label; the e code in MR mode */
  columnLabel?: (item: HyperedgeItem & { id: ID }) => string;
  /** MR 模式：行、列用与画布相同的编号 / MR mode: rows and columns carry the same codes as the canvas */
  modelReadable?: boolean | ModelReadableOptions;
  /** 行尾显示度数，默认 MR 模式下不显示（会直接给出“顶点度”题的答案）/ degree at the row end; off in MR mode by default */
  showDegree?: boolean;
  /** 字号，默认 12 / font size */
  fontSize?: number;
  /** 单元格边长，默认 字号 × 1.4 / cell size */
  cellSize?: number;
  /** 列标签的最大字符数（非 MR），默认 16 / max characters of column labels outside MR mode */
  columnLabelMaxLength?: number;
  theme?: Partial<HypergraphTheme>;
}

export interface MatrixSVG {
  svg: string;
  width: number;
  height: number;
  fontSize: number;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const textWidth = (s: string, size: number) => [...s].reduce((w, ch) => w + size * charWidth(ch), 0);
const cut = (s: string, max: number) => ([...s].length > max ? `${[...s].slice(0, max - 1).join('')}…` : s);

const FONT = '-apple-system, BlinkMacSystemFont, &quot;PingFang SC&quot;, &quot;Microsoft YaHei&quot;, &quot;Noto Sans CJK SC&quot;, sans-serif';

/**
 * <zh/> 关联矩阵画成独立的 SVG（不依赖 DOM，Node 中也可用）：一行一个实体，一列一条超边，成员处画点并用竖线连起。
 * 与 IncidenceMatrixView 同一套排序与颜色；列标签在上下各画一遍、行编号在右侧再画一遍，矩阵大时查找不必回到对边（P2）。
 * 用于导出给模型看的图片（V-mat、V-dual）
 *
 * <en/> The incidence matrix as a standalone SVG (no DOM, usable in Node), with the same order and colors as
 * IncidenceMatrixView. Column labels are repeated below and row codes on the right so lookups stay local in large matrices.
 * Used to export images for models (V-mat, V-dual)
 */
export const incidenceMatrixSVG = (data: HypergraphData, options: MatrixSVGOptions = {}): MatrixSVG => {
  const { order = 'degree', typeField = 'entity_type', centerNode, nodeColors = {}, hyperedgeColors, columnLabelMaxLength = 16 } = options;
  const theme = resolveTheme(options.theme);
  const mrOptions = options.modelReadable ? (options.modelReadable === true ? {} : options.modelReadable) : null;
  const key = mrOptions ? modelReadableKey(data, { centerNode }) : null;
  const fontSize = options.fontSize ?? 12;
  const cell = options.cellSize ?? Math.round(fontSize * 1.4);
  const showDegree = options.showDegree ?? !key;
  const typeColors = options.typeColors ?? typeColorsOf(Object.values(data.vertices), typeField, theme.typePalette);
  const hubs = new Set(options.hubNodes || []);
  const name = options.labelText ?? ((id: ID) => String(id));

  const matrix = incidenceMatrix(data, { order, typeField, centerNode });
  const { rows, columns } = matrix;
  const rowLabel = (id: ID) => (key ? modelReadableLabel(key, id, name(id), mrOptions!) : name(id));
  const columnLabel =
    options.columnLabel ??
    ((he: HyperedgeItem & { id: ID }) =>
      key
        ? (key.hyperedges.get(he.id) ?? String(he.id))
        : cut(String(he.description || he.summary || he.type || he.id).replace(/<SEP>/g, ', '), columnLabelMaxLength));
  const rowCode = (id: ID) => key?.vertices.get(id);

  const rowLabels = rows.map(rowLabel);
  const colLabels = columns.map((c) => columnLabel(c.item));
  const dot = 16;
  const degreeW = showDegree ? fontSize * 2.4 : 0;
  const RW = Math.ceil(dot + Math.max(0, ...rowLabels.map((s) => textWidth(s, fontSize))) + 8 + degreeW);
  const CH = Math.ceil(Math.max(0, ...colLabels.map((s) => textWidth(s, fontSize))) + 10);
  const RC = key ? Math.ceil(Math.max(0, ...rows.map((id) => textWidth(rowCode(id) ?? '', fontSize))) + 10) : 0;
  const pad = 8;
  const W = columns.length * cell;
  const H = rows.length * cell;
  const x0 = pad + RW;
  const y0 = pad + CH;
  const width = x0 + W + RC + pad;
  const height = y0 + H + CH + pad;

  const colorOf = (id: ID, j: number) => hyperedgeColors?.[id] ?? theme.hyperedgeColors[j % theme.hyperedgeColors.length];
  const nodeColorOf = (id: ID) =>
    nodeColors[id] ?? (id === centerNode ? theme.centerColor : typeColors[data.vertices[id]?.[typeField]] || theme.nodeColor);

  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}" font-size="${fontSize}">`,
    `<rect width="${width}" height="${height}" fill="#fff"/>`,
  );
  // 隔行底色、每列一条浅色参考线 / zebra rows and a faint guide per column
  rows.forEach((_, i) => i % 2 && out.push(`<rect x="${x0}" y="${y0 + i * cell}" width="${W}" height="${cell}" fill="#f3f4f6"/>`));
  columns.forEach((_, j) => {
    const x = x0 + (j + 0.5) * cell;
    out.push(`<line x1="${x}" x2="${x}" y1="${y0}" y2="${y0 + H}" stroke="#e5e7eb" stroke-width="1"/>`);
  });
  matrix.rowGroups.slice(1).forEach((g) => {
    const y = y0 + g.start * cell;
    out.push(`<line x1="${pad}" x2="${x0 + W}" y1="${y}" y2="${y}" stroke="#9ca3af"/>`);
  });
  matrix.columnGroups.slice(1).forEach((g) => {
    const x = x0 + g.start * cell;
    out.push(`<line x1="${x}" x2="${x}" y1="${pad}" y2="${y0 + H}" stroke="#9ca3af"/>`);
  });
  // 行标题：类型色点（枢纽为虚线圈）、标签、度数；右侧再标一次编号
  rows.forEach((id, i) => {
    const y = y0 + (i + 0.5) * cell;
    const color = nodeColorOf(id);
    const r = Math.min(5, cell / 3);
    out.push(
      hubs.has(id)
        ? `<circle cx="${pad + 6}" cy="${y}" r="${r}" fill="#fff" stroke="${color}" stroke-width="1.5" stroke-dasharray="2 1.5"/>`
        : `<circle cx="${pad + 6}" cy="${y}" r="${r}" fill="${color}"/>`,
      `<text x="${pad + dot}" y="${y}" dy="0.35em" fill="#111827"${id === centerNode ? ' font-weight="bold"' : ''}>${esc(rowLabels[i])}</text>`,
    );
    if (showDegree) {
      out.push(`<text x="${x0 - 6}" y="${y}" dy="0.35em" fill="#6b7280" text-anchor="end">${matrix.degree.get(id)}</text>`);
    }
    if (key) out.push(`<text x="${x0 + W + 6}" y="${y}" dy="0.35em" fill="#111827">${esc(rowCode(id) ?? '')}</text>`);
  });
  // 列标签：上方自下而上，下方自上而下 / column labels, above reading upward and below reading downward
  columns.forEach((c, j) => {
    const x = x0 + (j + 0.5) * cell;
    const label = esc(colLabels[j]);
    out.push(
      `<text transform="translate(${x} ${y0 - 5}) rotate(-90)" dy="0.35em" fill="#111827">${label}</text>`,
      `<text transform="translate(${x} ${y0 + H + 5}) rotate(90)" dy="0.35em" fill="#111827">${label}</text>`,
    );
  });
  // 成员点与竖线 / member dots joined by a vertical line
  columns.forEach((c, j) => {
    const color = colorOf(c.id, j);
    const x = x0 + (j + 0.5) * cell;
    const top = y0 + (c.rows[0] + 0.5) * cell;
    const bottom = y0 + (c.rows[c.rows.length - 1] + 0.5) * cell;
    out.push(`<line x1="${x}" x2="${x}" y1="${top}" y2="${bottom}" stroke="${color}" stroke-width="${Math.max(1.5, cell / 8)}"/>`);
    c.rows.forEach((i) =>
      out.push(`<circle cx="${x}" cy="${y0 + (i + 0.5) * cell}" r="${Math.min(7, cell * 0.3)}" fill="${color}" stroke="#fff" stroke-width="1"/>`),
    );
  });
  out.push('</svg>');
  return { svg: out.join(''), width, height, fontSize };
};
