import type { ID } from '@antv/g6';
import { hyperedgeIdOf } from './analysis';
import { charWidth } from './layout';
import type { HypergraphData } from './spec';
import type { HypergraphTheme } from './theme';

/**
 * <zh/> 模型可读（MR）模式的选项。MR 模式给多模态模型看：每个实体、超边都有常显的短编号（v1、e1），
 * 轮廓只描边，标签不隐藏，淡出的枢纽写进图例，图上的编号与映射表一致
 *
 * <en/> Options of the model-readable (MR) mode, drawn for multimodal models: every vertex and hyperedge carries a short
 * always-visible code (v1, e1), contours are outlines only, labels are never hidden, faded hubs go to a legend, and the
 * codes match the mapping table
 */
export interface ModelReadableOptions {
  /** 实体标签：'code' 只画编号，'code+name' 编号加简称（默认）/ vertex label: code only, or code plus short name (default) */
  vertexLabel?: 'code' | 'code+name';
  /** 简称最多几个字符，默认 8 / max characters of the short name, defaults to 8 */
  nameMaxLength?: number;
  /**
   * 轮廓填充透明度，默认 0（只描边：半透明填充在重叠处叠色，颜色对不回超边）；选中时在此基础上加 0.12
   * Contour fill opacity, 0 by default (outlines only: blended fills can't be traced back to a hyperedge); +0.12 when selected
   */
  fillOpacity?: number;
}

/**
 * <zh/> 编号表：实体按 中心、度数降序、id 编为 v1…，超边按在数据中的顺序编为 e1…（只剩 1 个成员的不编号）。
 * 同一份数据总是得到同一套编号，画布、关联矩阵、映射表共用
 *
 * <en/> Codes: vertices as v1… by center first, then degree descending, then id; hyperedges as e1… in data order
 * (those with fewer than 2 members are skipped). The same data always gets the same codes
 */
export interface ModelReadableKey {
  vertices: Map<ID, string>;
  hyperedges: Map<ID, string>;
  /** 超边 id → 成员（去重）/ hyperedge id → members, deduplicated */
  members: Map<ID, ID[]>;
}

export const modelReadableKey = (data: HypergraphData, { centerNode }: { centerNode?: ID } = {}): ModelReadableKey => {
  const hyperedges = new Map<ID, string>();
  const members = new Map<ID, ID[]>();
  const degree = new Map<ID, number>();
  data.hyperedges.forEach((he) => {
    const m = [...new Set(he.members)];
    const id = hyperedgeIdOf(he);
    if (m.length < 2 || hyperedges.has(id)) return;
    hyperedges.set(id, `e${hyperedges.size + 1}`);
    members.set(id, m);
    m.forEach((v) => degree.set(v, (degree.get(v) || 0) + 1));
  });
  const rank = (id: ID) => (id === centerNode ? Infinity : degree.get(id) || 0);
  const ids = Object.keys(data.vertices).sort((a, b) => rank(b) - rank(a) || (a < b ? -1 : a > b ? 1 : 0));
  return { vertices: new Map(ids.map((id, i) => [id, `v${i + 1}`])), hyperedges, members };
};

const truncate = (text: string, max: number) => (max > 0 && [...text].length > max ? `${[...text].slice(0, max - 1).join('')}…` : text);

/** 实体在图上的标签 / on-canvas label of a vertex */
export const modelReadableLabel = (key: ModelReadableKey, id: ID, name: string, options: ModelReadableOptions = {}) => {
  const code = key.vertices.get(id) ?? String(id);
  const { vertexLabel = 'code+name', nameMaxLength = 8 } = options;
  return vertexLabel === 'code' || !name ? code : `${code} ${truncate(name, nameMaxLength)}`;
};

/**
 * <zh/> MR 模式的主题：轮廓默认只描边、不填充（叠色无法对回超边，可用 fillOpacity 打开），选中时稍加填充；多边形同样
 *
 * <en/> MR theme: contours as outlines without fill (blended fills can't be traced back to a hyperedge)
 */
export const modelReadableTheme = (theme: HypergraphTheme, { fillOpacity = 0 }: ModelReadableOptions = {}): HypergraphTheme => ({
  ...theme,
  labelFontSize: Math.max(theme.labelFontSize, 12),
  bubble: {
    normal: { fillOpacity, strokeOpacity: 1, lineWidth: 2 },
    highlight: { fillOpacity: Math.min(1, fillOpacity + 0.12), strokeOpacity: 1, lineWidth: 3.5 },
    dimmed: { fillOpacity: fillOpacity * 0.2, strokeOpacity: 0.15, lineWidth: 1.5 },
  },
  polygonStroke: {
    normal: { strokeOpacity: 1, lineWidth: 2 },
    highlight: { strokeOpacity: 1, lineWidth: 3.5 },
    dimmed: { strokeOpacity: 0.15, lineWidth: 1.5 },
  },
  kelpStroke: {
    normal: { strokeOpacity: 1, lineWidth: 3 },
    highlight: { strokeOpacity: 1, lineWidth: 4 },
    dimmed: { strokeOpacity: 0.15, lineWidth: 1.5 },
  },
});

// #rrggbb 向黑（t < 0）或向白（t > 0）混合；其他写法原样返回 / mix a #rrggbb color toward black (t < 0) or white (t > 0)
export const shadeColor = (color: string, t: number) => {
  if (!t || !/^#[0-9a-f]{6}$/i.test(color)) return color;
  const target = t < 0 ? 0 : 255;
  const channel = (shift: number) => {
    const x = (parseInt(color.slice(1), 16) >> shift) & 255;
    return Math.round(x + (target - x) * Math.abs(t));
  };
  return `#${((1 << 24) | (channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).slice(1)}`;
};

const DASHES: (number[] | undefined)[] = [undefined, [8, 4], [2, 3]];
const SHADES = [0, -0.35, 0.3, -0.6];

/**
 * <zh/> 同色超边的区分：颜色相同的超边（调色板循环用完一轮，或调用方按公司等分组着色）按出现顺序的第 rank 条，
 * 轮换线型（实线、虚线、点线）与深浅（原色、加深、变浅、更深），色相不变，前 12 条两两不同
 *
 * <en/> Telling apart hyperedges of the same color (palette wrap-around, or colors grouped by the caller, e.g. by
 * company): the rank-th one cycles line dash and shade while keeping the hue; the first 12 are all distinct
 */
export const modelReadableVariant = (color: string, rank: number): { color: string; lineDash?: number[] } => ({
  color: shadeColor(color, SHADES[rank % SHADES.length]),
  lineDash: DASHES[rank % DASHES.length],
});

type Locale = 'en' | 'zh';

const TEXT = {
  zh: {
    hidden: '（未画出）',
    all: '属于全部超边',
    except: (list: string) => `属于除 ${list} 外的全部超边`,
    in: (list: string) => `属于 ${list}`,
    undrawn: (codes: string, list: string) => `${codes} = {${list}}（未画出）`,
    undrawnEach: (hubs: string, list: string) => `未画出的超边，都含 ${hubs}，各自另含：${list}`,
    sep: '、',
    vertexHead: '| 编号 | 实体 | 类型 |',
    hyperedgeHead: '| 编号 | 成员 | 描述 |',
    legend: '图例',
    vertices: '实体',
    hyperedges: '超边',
  },
  en: {
    hidden: ' (not drawn)',
    all: 'is in every hyperedge',
    except: (list: string) => `is in every hyperedge except ${list}`,
    in: (list: string) => `is in ${list}`,
    undrawn: (codes: string, list: string) => `${codes} = {${list}} (not drawn)`,
    undrawnEach: (hubs: string, list: string) => `Not drawn, each with ${hubs} plus: ${list}`,
    sep: ', ',
    vertexHead: '| Code | Vertex | Type |',
    hyperedgeHead: '| Code | Members | Description |',
    legend: 'Legend',
    vertices: 'Vertices',
    hyperedges: 'Hyperedges',
  },
};

/**
 * <zh/> 图例：画布上不画的信息逐条写出，不丢信息（P4）——
 * 淡出的枢纽属于哪些超边（超过一半时写成“除 … 外的全部超边”），以及淡出后只剩一个成员、因而没画出的超边
 *
 * <en/> Legend lines for what the canvas leaves out: the hyperedges each faded hub belongs to (written as "every hyperedge
 * except …" past half), and hyperedges not drawn because only one member is left after fading
 */
export const modelReadableLegend = (
  key: ModelReadableKey,
  { faded = [], locale = 'en', name = (id: ID) => String(id) }: { faded?: ID[]; locale?: Locale; name?: (id: ID) => string } = {},
): string[] => {
  const t = TEXT[locale];
  const fadedSet = new Set(faded);
  const codeOf = (id: ID) => key.vertices.get(id) ?? String(id);
  // 按编号排序：v2 在 v10 前 / by code, v2 before v10
  const num = (id: ID) => Number(codeOf(id).slice(1)) || 0;
  const byCode = (ids: ID[]) => [...ids].sort((a, b) => num(a) - num(b));
  const all = [...key.hyperedges.keys()];
  const lines: string[] = [];
  byCode(faded).forEach((v) => {
    if (!key.vertices.has(v)) return;
    const inside = all.filter((he) => key.members.get(he)!.includes(v));
    const outside = all.filter((he) => !key.members.get(he)!.includes(v));
    const list = (ids: ID[]) => ids.map((he) => key.hyperedges.get(he)).join(t.sep);
    const where = !outside.length ? t.all : inside.length > all.length / 2 ? t.except(list(outside)) : t.in(list(inside));
    lines.push(`${codeOf(v)} ${name(v)}${t.hidden} ${where}`);
  });
  // 未画出的超边：成员相同的合成一行；含同一组枢纽、另外只剩一个成员的（如中心与各实体的 2 元超边）合成一句
  const sameMembers = new Map<string, { codes: string[]; members: ID[] }>();
  all.forEach((he) => {
    const m = key.members.get(he)!;
    if (m.filter((v) => !fadedSet.has(v)).length >= 2 || !m.some((v) => fadedSet.has(v))) return;
    const k = [...m].sort().join('\u0000');
    const group = sameMembers.get(k) ?? { codes: [], members: m };
    group.codes.push(key.hyperedges.get(he)!);
    sameMembers.set(k, group);
  });
  const byHubs = new Map<string, { hubs: ID[]; items: { codes: string[]; other: ID }[] }>();
  const single: { codes: string[]; members: ID[] }[] = [];
  sameMembers.forEach((group) => {
    const hubs = byCode(group.members.filter((v) => fadedSet.has(v)));
    const rest = group.members.filter((v) => !fadedSet.has(v));
    if (group.codes.length > 1 || rest.length !== 1) return single.push(group);
    const k = hubs.join('\u0000');
    const entry = byHubs.get(k) ?? { hubs, items: [] };
    entry.items.push({ codes: group.codes, other: rest[0] });
    byHubs.set(k, entry);
  });
  byHubs.forEach(({ hubs, items }) => {
    if (items.length === 1) return single.push({ codes: items[0].codes, members: [...hubs, items[0].other] });
    const list = items.map(({ codes, other }) => `${codes.join(t.sep)} ${codeOf(other)}`).join(t.sep);
    lines.push(t.undrawnEach(hubs.map(codeOf).join(t.sep), list));
  });
  single.forEach(({ codes, members }) => lines.push(t.undrawn(codes.join(t.sep), byCode(members).map(codeOf).join(t.sep))));
  return lines;
};

const cell = (text: unknown) =>
  String(Array.isArray(text) ? text.join(', ') : (text ?? ''))
    .replace(/<SEP>/g, '; ')
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ');

/**
 * <zh/> 映射表（Markdown）：图例、实体表（编号 → 全名、类型）、超边表（编号 → 成员编号、描述），作为提示的文本部分（P7 图文同号）
 *
 * <en/> Mapping table in Markdown: legend, vertices (code → full name, type) and hyperedges (code → member codes,
 * description), for the text part of the prompt
 */
export const modelReadableTable = (
  data: HypergraphData,
  key: ModelReadableKey,
  { faded = [], locale = 'en', typeField = 'entity_type' }: { faded?: ID[]; locale?: Locale; typeField?: string } = {},
): string => {
  const t = TEXT[locale];
  const byId = new Map(data.hyperedges.map((he) => [hyperedgeIdOf(he), he]));
  const legend = modelReadableLegend(key, { faded, locale });
  const out: string[] = [];
  if (legend.length) out.push(`## ${t.legend}`, '', ...legend.map((l) => `- ${l}`), '');
  out.push(`## ${t.vertices}`, '', t.vertexHead, '| --- | --- | --- |');
  key.vertices.forEach((code, id) => out.push(`| ${code} | ${cell(id)} | ${cell(data.vertices[id]?.[typeField])} |`));
  out.push('', `## ${t.hyperedges}`, '', t.hyperedgeHead, '| --- | --- | --- |');
  key.hyperedges.forEach((code, id) => {
    const he = byId.get(id);
    const members = key.members.get(id)!.map((v) => key.vertices.get(v)).join(', ');
    out.push(`| ${code} | ${members} | ${cell(he?.description || he?.summary || he?.type || he?.keywords)} |`);
  });
  return `${out.join('\n')}\n`;
};

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** 编号标签的尺寸（画布坐标），与 G6 Label 的 padding 一致 / size of a code tag in canvas units */
export const tagSize = (text: string, fontSize: number, padding = [1, 4]) => {
  let width = 0;
  for (const ch of text) width += fontSize * charWidth(ch);
  return { width: width + padding[1] * 2, height: fontSize * 1.25 + padding[0] * 2 };
};

/**
 * <zh/> 放置超边编号标签：从锚点（成员质心，不含中心实体）出发按螺线找第一个不压节点、节点标签、已放标签的位置；
 * 小超边先放（它们的轮廓小，离开锚点就容易落到别的轮廓里）。找不到时放在锚点
 *
 * <en/> Place hyperedge code tags: spiral out from the anchor (members' centroid without the center) to the first spot
 * clear of nodes, node labels and placed tags; smaller hyperedges go first. Falls back to the anchor
 */
export const placeTags = (
  tags: { id: ID; text: string; anchor: { x: number; y: number }; size: number }[],
  obstacles: Box[],
  fontSize: number,
): Map<ID, { x: number; y: number }> => {
  const placed: Box[] = [...obstacles];
  const result = new Map<ID, { x: number; y: number }>();
  const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  const step = fontSize * 0.5;
  [...tags]
    .sort((a, b) => a.size - b.size)
    .forEach(({ id, text, anchor }) => {
      const { width, height } = tagSize(text, fontSize);
      const boxAt = (x: number, y: number) => ({ x0: x - width / 2, y0: y - height / 2, x1: x + width / 2, y1: y + height / 2 });
      let at = { x: anchor.x, y: anchor.y };
      search: for (let ring = 0; ring <= 24; ring++) {
        const r = ring * step;
        const n = ring ? Math.max(8, Math.round((2 * Math.PI * r) / step)) : 1;
        for (let k = 0; k < n; k++) {
          const a = (2 * Math.PI * k) / n;
          const x = anchor.x + r * Math.cos(a);
          const y = anchor.y + r * Math.sin(a);
          if (!placed.some((b) => hit(b, boxAt(x, y)))) {
            at = { x, y };
            break search;
          }
        }
      }
      placed.push(boxAt(at.x, at.y));
      result.set(id, at);
    });
  return result;
};
