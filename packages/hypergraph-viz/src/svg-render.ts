/**
 * 纯 SVG 渲染 / Pure SVG rendering
 *
 * 不用 G6、不用 DOM，把超图直接画成 SVG 字符串，Node 与浏览器中都可用（批量出图不再需要无头浏览器）。
 * 各部分与画布一致：样式、颜色、编号、标签来自 toG6Spec；布局用同一个 HypergraphLayout / PolygonLayout / ShuffleLayout
 * （确定性，同样输入得到同样坐标）；轮廓照搬 G6 bubble-sets 插件的计算（bubblesets-js，成员取节点圆的包围盒，
 * sample(8) → bSplines → 闭合样条）；节点标签、连线标签、编号标签按 G6 主题的默认位置与留白。
 * 与画布不同之处：标签宽度按字符估算（与布局的标签防重叠相同）；图模式不用力导，顶点沿用超图布局的坐标，
 * 超边节点放在成员质心附近（同一份坐标只换编码，见 4.7 §5.2 的控制变量）。
 *
 * Draws a hypergraph straight to an SVG string without G6 or a DOM, in Node and browsers alike. Styles, colors, codes and
 * labels come from toG6Spec; layouts are the same deterministic classes; contours follow G6's bubble-sets plugin
 * (bubblesets-js on node key bounds, sample(8) → bSplines → closed spline). Differences from the canvas: label widths are
 * estimated per character, and graph mode keeps the hypergraph layout's vertex coordinates (no force layout) with
 * hyperedge nodes near their members' centroid, so encodings differ on the same coordinates
 */
import type { EdgeData, ID, NodeData } from '@antv/g6';
import { BubbleSets, defaultOptions as bubbleDefaults, Line, Rectangle } from 'bubblesets-js';
import { HOVER_BUBBLE_SETS } from './hover-bubble-sets';
import { kelpAnchor, kelpFusion, kelpPathString } from './kelp';
import { charWidth, HypergraphLayout } from './layout';
import { placeTags, tagSize } from './model-readable';
import { PolygonLayout, polygonOrder } from './polygon-layout';
import { HYPERGRAPH_LAYOUT, POLYGON_LAYOUT, SHUFFLE_LAYOUT } from './register';
import { ShuffleLayout } from './shuffle-layout';
import type { HypergraphData, SpecOptions } from './spec';
import { themeOf, toG6Spec } from './spec';

export interface HypergraphSVGOptions extends SpecOptions {
  /** 四周留白（画布坐标），默认 16 / padding around the drawing */
  padding?: number;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * <zh/> 渲染结果：SVG 与尺寸（画布坐标，1 单位 = 1 像素），fontSize 为实体标签字号；
 * 另给出几何（节点、标签框、编号标签框、轮廓路径），用于计算可读性指标
 *
 * <en/> Result: the SVG and its size in canvas units, the vertex label font size, and the geometry (nodes, label boxes,
 * tag boxes, contour paths) for readability metrics
 */
export interface HypergraphSVG {
  svg: string;
  width: number;
  height: number;
  fontSize: number;
  /** viewBox 的左上角（画布坐标）/ top-left of the viewBox in canvas coordinates */
  origin: [number, number];
  nodes: { id: ID; x: number; y: number; r: number; label: Box | null; hyperedge?: ID }[];
  tags: { id: ID; code: string; box: Box }[];
  contours: { id: ID; d: string; points: [number, number][] }[];
}

/** SVG 中的字体：系统中第一个可用的 / fonts used in the SVG, first available wins */
export const SVG_FONT_FAMILY = `-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", sans-serif`;

export const escapeXML = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attr = (s: string) => escapeXML(s);
const n2 = (x: number) => String(Math.round(x * 100) / 100);
/** 估算文字宽度（与布局的标签防重叠相同）/ estimated text width, as in the layout */
export const textWidth = (text: string, fontSize: number) => [...text].reduce((w, ch) => w + fontSize * charWidth(ch), 0);
// G 的 textBaseline: 'top' 换成 SVG 的基线：上沿 + 0.85 em / baseline for a text whose top is at y
const BASELINE = 0.85;
// 文字框高度（G 的 Label 背景以行高计）/ text box height
const LINE = 1.25;

/**
 * <zh/> 闭合样条（同 G6 的 getClosedSpline）/ closed spline, as G6's getClosedSpline
 */
export const closedSpline = (input: [number, number][]) => {
  if (input.length < 2) return 'M0,0L0,0';
  const points = [...input];
  const first = points[0];
  const second = points[1];
  const last = points[points.length - 1];
  const lastSecond = points[points.length - 2];
  points.unshift(lastSecond, last);
  points.push(first, second);
  let d = `M${n2(last[0])},${n2(last[1])}`;
  for (let i = 1; i < points.length - 2; i += 1) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const [x3, y3] = i !== points.length - 2 ? points[i + 2] : [x2, y2];
    d += `C${n2(x1 + (x2 - x0) / 6)},${n2(y1 + (y2 - y0) / 6)},${n2(x2 - (x3 - x1) / 6)},${n2(y2 - (y3 - y1) / 6)},${n2(x2)},${n2(y2)}`;
  }
  return d;
};

const RING_SEGMENTS = 12;
// 嵌套轮廓的外扩圆环（同 KeyBoundsBubbleSets）/ padding ring for nested contours, as in KeyBoundsBubbleSets
const ring = (cx: number, cy: number, r: number) =>
  Array.from({ length: RING_SEGMENTS }, (_, i) => {
    const a = (i / RING_SEGMENTS) * Math.PI * 2;
    const b = ((i + 1) / RING_SEGMENTS) * Math.PI * 2;
    return Line.from({ x1: cx + r * Math.cos(a), y1: cy + r * Math.sin(a), x2: cx + r * Math.cos(b), y2: cy + r * Math.sin(b) });
  });

/**
 * <zh/> 轮廓路径：照搬 G6 bubble-sets 插件（成员为节点的包围盒，不考虑非成员），返回路径与采样点
 *
 * <en/> Contour path as G6's bubble-sets plugin computes it (members as node bounds, no non-members)
 */
export const bubblePath = (
  members: Box[],
  options: Record<string, unknown>,
  padding: { cx: number; cy: number; pad: number }[] = [],
): { d: string; points: [number, number][] } => {
  const bubbleOptions = Object.fromEntries(Object.entries(options).filter(([k]) => k in bubbleDefaults));
  const bubbleSets = new BubbleSets(bubbleOptions);
  members.forEach((b) => bubbleSets.pushMember(new Rectangle(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0)));
  padding.forEach(({ cx, cy, pad }) => bubbleSets.pushEdge(...ring(cx, cy, pad)));
  const clean = bubbleSets.compute().sample(8).simplify(0).bSplines().simplify(0);
  const points = clean.points.map((p: { x: number; y: number }) => [p.x, p.y] as [number, number]);
  return { d: closedSpline(points), points };
};

// 按螺线为占位框找第一个不与障碍重叠的位置（超边节点）；框相对锚点为 box(x, y) / spiral to the first free spot for a box
const placeBox = (anchor: { x: number; y: number }, boxAt: (x: number, y: number) => Box, obstacles: Box[], step: number) => {
  const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  for (let ring = 0; ring <= 30; ring++) {
    const r = ring * step;
    const n = ring ? Math.max(8, Math.round((2 * Math.PI * r) / step)) : 1;
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * k) / n;
      const x = anchor.x + r * Math.cos(a);
      const y = anchor.y + r * Math.sin(a);
      if (!obstacles.some((b) => hit(b, boxAt(x, y)))) return { x, y };
    }
  }
  return anchor;
};

const value = (v: any, d: any) => (typeof v === 'function' ? v(d) : v);
const sizeOf = (v: any) => (Array.isArray(v) ? Math.max(...v) : Number(v) || 0);

const LAYOUTS: Record<string, any> = {
  [HYPERGRAPH_LAYOUT]: HypergraphLayout,
  [POLYGON_LAYOUT]: PolygonLayout,
  [SHUFFLE_LAYOUT]: ShuffleLayout,
};

/**
 * <zh/> 把超图画成 SVG。支持超图模式（轮廓 / 多边形）与图模式（超边节点 / 团展开 / 只画 2 元超边），
 * 布局为 'hypergraph'（默认）、'polygon' 或 layout.shuffleSeed 打乱；淡出的实体不画
 *
 * <en/> Draw a hypergraph as SVG: hyper mode (contours or polygons) or graph mode (hyperedge nodes, clique, binary), with
 * the hypergraph or polygon layout or shuffled by layout.shuffleSeed; faded vertices are not drawn
 */
export const renderHypergraphSVG = async (data: HypergraphData, options: HypergraphSVGOptions = {}): Promise<HypergraphSVG> => {
  const { padding = 16 } = options;
  const isGraph = options.mode === 'graph';
  const spec = toG6Spec(data, options);
  const theme = themeOf(options);
  // 顶点坐标：总按超图模式布局（图模式也用同一份坐标）/ vertex coordinates always come from the hyper-mode layout
  const layoutSpec = isGraph ? toG6Spec(data, { ...options, mode: 'hyper' }) : spec;
  const layoutOptions = layoutSpec.layout as Record<string, any>;
  const Layout = LAYOUTS[layoutOptions.type];
  if (!Layout) throw new Error(`[hypergraph-viz] SVG rendering supports the hypergraph, polygon and shuffle layouts, not '${layoutOptions.type}'`);
  const laid = await new Layout({} as any, layoutOptions).execute(
    structuredClone({ nodes: layoutSpec.data.nodes, edges: layoutSpec.data.edges }),
  );
  const pos = new Map<ID, [number, number]>((laid.nodes || []).map((d: any) => [d.id, [d.style.x, d.style.y]]));

  const nodeStyle = spec.node.style as Record<string, any>;
  const edgeStyle = spec.edge.style as Record<string, any>;
  const nodes = spec.data.nodes!;
  const edges = spec.data.edges!;
  const radius = (d: NodeData) => sizeOf(value(nodeStyle.size, d)) / 2;
  const fontOf = (d: NodeData) => value(nodeStyle.labelFontSize, d) || theme.labelFontSize;

  // 节点与标签的占位框（标签在节点下方 2 处）/ box of a node with its label below
  const occupied = (d: NodeData, x: number, y: number, gap = 0): Box => {
    const r = radius(d);
    const text = String(value(nodeStyle.labelText, d) ?? '');
    const fontSize = fontOf(d);
    const w = Math.max(r * 2, text ? textWidth(text, fontSize) : 0);
    return { x0: x - w / 2 - gap, y0: y - r - gap, x1: x + w / 2 + gap, y1: y + r + 2 + (text ? fontSize * LINE : 0) + gap };
  };
  // 超边节点（graphEdges: 'star'）：成员质心附近，菱形与它的编号标签都不压实体、实体标签和已放的超边节点
  // Hyperedge nodes near their members' centroid, clear of vertices, their labels and placed hyperedge nodes
  const taken: Box[] = [];
  nodes.forEach((d) => {
    const p = pos.get(d.id);
    if (p && !spec.hyperedgeNodes.has(d.id)) taken.push(occupied(d, p[0], p[1]));
  });
  spec.hyperedgeNodes.forEach((he, nodeId) => {
    const node = nodes.find((d) => d.id === nodeId)!;
    const members = (spec.hyperedges.get(he)?.members || []).filter((m) => pos.has(m));
    const n = members.length || 1;
    const anchor = {
      x: members.reduce((s, m) => s + pos.get(m)![0], 0) / n,
      y: members.reduce((s, m) => s + pos.get(m)![1], 0) / n,
    };
    const at = placeBox(anchor, (x, y) => occupied(node, x, y, 2), taken, Math.max(4, radius(node)));
    taken.push(occupied(node, at.x, at.y, 2));
    pos.set(nodeId, [at.x, at.y]);
  });

  const out: string[] = [];
  const bounds: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const grow = (b: Box) => {
    bounds.x0 = Math.min(bounds.x0, b.x0);
    bounds.y0 = Math.min(bounds.y0, b.y0);
    bounds.x1 = Math.max(bounds.x1, b.x1);
    bounds.y1 = Math.max(bounds.y1, b.y1);
  };
  const drawn = nodes.filter((d) => pos.has(d.id));

  // 节点标签：节点下方 2 处，上沿对齐（G6 的 labelPlacement: 'bottom'、labelOffsetY: 2）/ labels below nodes
  const labels = new Map<ID, { text: string; box: Box; fontSize: number }>();
  drawn.forEach((d) => {
    const text = String(value(nodeStyle.labelText, d) ?? '');
    if (!text || nodeStyle.label === false) return;
    const [x, y] = pos.get(d.id)!;
    const fontSize = fontOf(d);
    const w = textWidth(text, fontSize);
    const top = y + radius(d) + 2;
    labels.set(d.id, { text, fontSize, box: { x0: x - w / 2, y0: top, x1: x + w / 2, y1: top + fontSize * LINE } });
  });

  // 1. 轮廓：多边形大的在下（同画布的 zIndex）/ contours, larger polygons below
  const contours: HypergraphSVG['contours'] = [];
  const plugins = (spec.plugins as any[]).filter((p) => p.type === HOVER_BUBBLE_SETS);
  const ordered = plugins.some((p) => p.polygon) ? [...plugins].sort((a, b) => (a.zIndex ?? -1) - (b.zIndex ?? -1)) : plugins;
  // KelpFusion：所有 kelp 超边一起算（共用的一段平行错开），与画布相同 / all kelp hyperedges at once, as on the canvas
  const kelpPlugins = plugins.filter((p) => p.kelp && !p.polygon);
  const kelpShapes = kelpPlugins.length
    ? kelpFusion(
        kelpPlugins.map((p) => ({ id: p.key, members: p.members })),
        (id) => pos.get(id),
        drawn.map((d) => d.id),
      )
    : null;
  ordered.forEach((p) => {
    const members = (p.members as ID[]).filter((m) => pos.has(m));
    if (members.length < 2) return;
    let shape: { d: string; points: [number, number][] };
    const kelpShape = p.kelp && !p.polygon ? kelpShapes?.get(p.key) : undefined;
    if (kelpShape) {
      const points = [...kelpShape.faces.flat(), ...kelpShape.segments.flat()];
      shape = { d: kelpPathString(kelpShape), points };
    } else if (p.polygon) {
      const ring = polygonOrder(members, (id) => pos.get(id)!).map((id) => pos.get(id)!);
      shape = { d: `${ring.map(([x, y], i) => `${i ? 'L' : 'M'}${n2(x)},${n2(y)}`).join('')}Z`, points: ring };
    } else {
      const boxes = members.map((m) => {
        const [x, y] = pos.get(m)!;
        const d = nodes.find((n) => n.id === m)!;
        const r = radius(d);
        const box = { x0: x - r, y0: y - r, x1: x + r, y1: y + r };
        // 'render'：连标签一起圈 / with the label
        const label = p.memberBoundsType === 'render' ? labels.get(m)?.box : undefined;
        return label ? { x0: Math.min(box.x0, label.x0), y0: box.y0, x1: Math.max(box.x1, label.x1), y1: label.y1 } : box;
      });
      const pads = Object.entries((p.memberPadding || {}) as Record<ID, number>)
        .filter(([m, pad]) => pad && pos.has(m))
        .map(([m, pad]) => ({ cx: pos.get(m)![0], cy: pos.get(m)![1], pad }));
      shape = bubblePath(boxes, p, pads);
    }
    contours.push({ id: p.hyperedge?.id, ...shape });
    shape.points.forEach(([x, y]) => grow({ x0: x - 2, y0: y - 2, x1: x + 2, y1: y + 2 }));
    const dash = p.lineDash ? ` stroke-dasharray="${p.lineDash.join(' ')}"` : '';
    const cap = p.lineCap ? ` stroke-linecap="${p.lineCap}"` : '';
    out.push(
      `<path d="${shape.d}" fill="${p.fill}" fill-opacity="${p.fillOpacity ?? 0.2}" stroke="${p.stroke}" ` +
        `stroke-opacity="${p.strokeOpacity ?? 1}" stroke-width="${p.lineWidth ?? 1}" stroke-linejoin="round"${cap}${dash}/>`,
    );
  });

  // 2. 连线与连线标签（中点，白底细框）/ lines and their labels at the midpoint
  const edgeLabels: string[] = [];
  edges.forEach((e: EdgeData) => {
    const a = pos.get(e.source);
    const b = pos.get(e.target);
    if (!a || !b) return;
    const stroke = value(edgeStyle.stroke, e) ?? theme.edgeColor;
    out.push(
      `<line x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(b[0])}" y2="${n2(b[1])}" stroke="${stroke}" stroke-width="${value(edgeStyle.lineWidth, e) ?? 1}"/>`,
    );
    const text = edgeStyle.labelText ? String(value(edgeStyle.labelText, e) ?? '') : '';
    if (!text) return;
    const fontSize = edgeStyle.labelFontSize ?? theme.labelFontSize;
    const [py, px] = edgeStyle.labelPadding ?? [1, 4];
    const w = textWidth(text, fontSize) + px * 2;
    const h = fontSize * LINE + py * 2;
    const cx = (a[0] + b[0]) / 2;
    const cy = (a[1] + b[1]) / 2;
    const box = { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
    grow(box);
    edgeLabels.push(
      `<rect x="${n2(box.x0)}" y="${n2(box.y0)}" width="${n2(w)}" height="${n2(h)}" rx="${edgeStyle.labelBackgroundRadius ?? 0}" ` +
        `fill="${edgeStyle.labelBackgroundFill ?? '#fff'}" fill-opacity="0.75"` +
        // G6 主题的连线标签背景描边宽度为 0，看不到描边 / G6's theme draws no outline (line width 0)
        (edgeStyle.labelBackgroundLineWidth ? ` stroke="${edgeStyle.labelBackgroundStroke}" stroke-width="${edgeStyle.labelBackgroundLineWidth}"` : '') +
        '/>',
      `<text x="${n2(cx)}" y="${n2(cy - (fontSize * LINE) / 2 + fontSize * BASELINE)}" font-size="${fontSize}" text-anchor="middle" fill="${edgeStyle.labelFill ?? '#000'}">${escapeXML(text)}</text>`,
    );
  });
  out.push(...edgeLabels);

  // 3. 节点（超边节点为菱形）/ nodes, hyperedge nodes as diamonds
  const nodeGeometry: HypergraphSVG['nodes'] = [];
  drawn.forEach((d) => {
    const [x, y] = pos.get(d.id)!;
    const r = radius(d);
    const fill = value(nodeStyle.fill, d) ?? theme.nodeColor;
    const he = spec.hyperedgeNodes.get(d.id);
    out.push(
      he !== undefined
        ? `<path d="M${n2(x)},${n2(y - r)}L${n2(x + r)},${n2(y)}L${n2(x)},${n2(y + r)}L${n2(x - r)},${n2(y)}Z" fill="${fill}"/>`
        : `<circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(r)}" fill="${fill}"/>`,
    );
    grow({ x0: x - r, y0: y - r, x1: x + r, y1: y + r });
    nodeGeometry.push({ id: d.id, x, y, r, label: labels.get(d.id)?.box ?? null, ...(he !== undefined && { hyperedge: he }) });
  });

  // 4. 节点标签（MR 下白底）/ node labels, on a white background in MR mode
  drawn.forEach((d) => {
    const label = labels.get(d.id);
    if (!label) return;
    const { text, fontSize, box } = label;
    grow(box);
    if (nodeStyle.labelBackground) {
      const [py, px] = value(nodeStyle.labelPadding, d) ?? [0, 2];
      out.push(
        `<rect x="${n2(box.x0 - px)}" y="${n2(box.y0 - py)}" width="${n2(box.x1 - box.x0 + px * 2)}" height="${n2(box.y1 - box.y0 + py * 2)}" ` +
          `fill="${nodeStyle.labelBackgroundFill ?? '#fff'}" fill-opacity="${nodeStyle.labelBackgroundOpacity ?? 0.75}"/>`,
      );
    }
    const fill = value(nodeStyle.labelFill, d) ?? '#000';
    const weight = value(nodeStyle.labelFontWeight, d);
    out.push(
      `<text x="${n2((box.x0 + box.x1) / 2)}" y="${n2(box.y0 + fontSize * BASELINE)}" font-size="${fontSize}" text-anchor="middle" ` +
        `fill="${fill}" fill-opacity="0.85"${weight && weight !== 'normal' ? ` font-weight="${weight}"` : ''}>${attr(text)}</text>`,
    );
  });

  // 5. 超边编号标签（MR，3 元及以上）：同画布的放置规则 / hyperedge code tags, placed as on the canvas
  const tagGeometry: HypergraphSVG['tags'] = [];
  const mr = spec.modelReadable;
  if (mr && mr.tags.length && options.contours !== false && !isGraph) {
    const fontSize = theme.labelFontSize;
    const obstacles: Box[] = [];
    drawn.forEach((d) => {
      const [x, y] = pos.get(d.id)!;
      const r = radius(d);
      obstacles.push({ x0: x - r, y0: y - r, x1: x + r, y1: y + r });
      const text = String(value(nodeStyle.labelText, d) ?? '');
      if (text) {
        const w = textWidth(text, fontSize);
        obstacles.push({ x0: x - w / 2 - 2, y0: y + r, x1: x + w / 2 + 2, y1: y + r + fontSize * 1.3 });
      }
    });
    const keyByHyperedge = new Map(kelpPlugins.map((p) => [p.hyperedge?.id, p.key]));
    const placed = placeTags(
      mr.tags.map(({ id, code, members }) => {
        const own = members.filter((m) => m !== options.centerNode && pos.has(m));
        const pts = (own.length ? own : members.filter((m) => pos.has(m))).map((m) => pos.get(m)!);
        const n = pts.length || 1;
        return {
          id,
          text: code,
          size: members.length,
          anchor: ((c) => {
            const shape = kelpShapes?.get(keyByHyperedge.get(id));
            return shape ? kelpAnchor(shape, c) : c;
          })({ x: pts.reduce((a, p) => a + p[0], 0) / n, y: pts.reduce((a, p) => a + p[1], 0) / n }),
        };
      }),
      obstacles,
      fontSize,
    );
    mr.tags.forEach(({ id, code, color }) => {
      const at = placed.get(id)!;
      const { width: w, height: h } = tagSize(code, fontSize);
      const box = { x0: at.x - w / 2, y0: at.y - h / 2, x1: at.x + w / 2, y1: at.y + h / 2 };
      grow(box);
      tagGeometry.push({ id, code, box });
      out.push(
        `<rect x="${n2(box.x0)}" y="${n2(box.y0)}" width="${n2(w)}" height="${n2(h)}" rx="3" fill="#fff" stroke="${color}" stroke-width="2"/>`,
        `<text x="${n2(at.x)}" y="${n2(at.y - (fontSize * LINE) / 2 + fontSize * BASELINE)}" font-size="${fontSize}" font-weight="bold" text-anchor="middle" fill="#111827">${escapeXML(code)}</text>`,
      );
    });
  }

  if (!Number.isFinite(bounds.x0)) Object.assign(bounds, { x0: 0, y0: 0, x1: 0, y1: 0 });
  const x0 = bounds.x0 - padding;
  const y0 = bounds.y0 - padding;
  const width = Math.ceil(bounds.x1 - bounds.x0 + padding * 2);
  const height = Math.ceil(bounds.y1 - bounds.y0 + padding * 2);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${n2(x0)} ${n2(y0)} ${width} ${height}" ` +
    `font-family="${attr(SVG_FONT_FAMILY)}"><rect x="${n2(x0)}" y="${n2(y0)}" width="${width}" height="${height}" fill="#fff"/>${out.join('')}</svg>`;
  return {
    svg,
    width,
    height,
    fontSize: theme.labelFontSize,
    origin: [x0, y0],
    nodes: nodeGeometry,
    tags: tagGeometry,
    contours,
  };
};

/** 拼图的一个面板：完整的 SVG 与它的尺寸、标签字号 / one panel to compose */
export interface SVGPanel {
  svg: string;
  width: number;
  height: number;
  fontSize: number;
}

/**
 * <zh/> 把若干 SVG 面板并排拼成一个 SVG（同一高度、总宽 width、白底，面板间有分隔线），图例按估算字宽折行画在下方。
 * 排版与浏览器版 composeImage 相同；labelPx 为各面板标签字号缩放后的最小值
 *
 * <en/> Lay SVG panels side by side in one SVG with the legend wrapped below, as composeImage does in the browser
 */
export const composeSVG = (
  panels: SVGPanel[],
  {
    width = 1024,
    maxHeight = width,
    padding = 16,
    maxScale = 2,
    legend = [] as string[],
  }: { width?: number; maxHeight?: number; padding?: number; maxScale?: number; legend?: string[] } = {},
): { svg: string; width: number; height: number; labelPx: number } => {
  const gap = panels.length > 1 ? padding * 2 : 0;
  const inner = width - 2 * padding - gap * (panels.length - 1);
  const aspect = panels.reduce((s, p) => s + p.width / p.height, 0);
  const h = Math.min(inner / aspect, maxHeight - 2 * padding, ...panels.map((p) => p.height * maxScale));
  const scales = panels.map((p) => h / p.height);
  const drawnWidth = panels.reduce((s, p, i) => s + p.width * scales[i], 0) + gap * (panels.length - 1);

  const legendFont = Math.round(width / 64);
  const textMax = width - 2 * padding;
  const wrapped: string[] = [];
  legend.forEach((line) => {
    let cur = '';
    for (const ch of line) {
      if (cur && textWidth(cur + ch, legendFont) > textMax) {
        wrapped.push(cur);
        cur = '  ';
      }
      cur += ch;
    }
    wrapped.push(cur);
  });
  const lineH = Math.round(legendFont * 1.4);
  const legendH = wrapped.length ? padding + wrapped.length * lineH : 0;
  const height = Math.ceil(h + 2 * padding + legendH);

  const out: string[] = [`<rect width="${width}" height="${height}" fill="#fff"/>`];
  let x = (width - drawnWidth) / 2;
  panels.forEach((p, i) => {
    const w = p.width * scales[i];
    // 面板作为嵌套的 <svg>：保留它自己的 viewBox，按位置与大小缩放 / nested <svg> keeps its own viewBox
    out.push(
      p.svg.replace(/^<svg\b([^>]*)>/, (_, attrs: string) => {
        const rest = attrs.replace(/\s(width|height|x|y)="[^"]*"/g, '');
        return `<svg x="${n2(x)}" y="${padding}" width="${n2(w)}" height="${n2(h)}"${rest}>`;
      }),
    );
    if (i < panels.length - 1) {
      const lx = n2(x + w + gap / 2);
      out.push(`<line x1="${lx}" x2="${lx}" y1="${padding}" y2="${n2(padding + h)}" stroke="#d1d5db"/>`);
    }
    x += w + gap;
  });
  if (wrapped.length) {
    const top = h + 2 * padding;
    out.push(`<line x1="${padding}" x2="${width - padding}" y1="${n2(top - padding / 2)}" y2="${n2(top - padding / 2)}" stroke="#d1d5db"/>`);
    wrapped.forEach((line, i) =>
      out.push(
        `<text x="${padding}" y="${n2(top + i * lineH + legendFont * BASELINE)}" font-size="${legendFont}" fill="#111827" xml:space="preserve">${escapeXML(line)}</text>`,
      ),
    );
  }
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${attr(SVG_FONT_FAMILY)}">${out.join('')}</svg>`,
    width,
    height,
    labelPx: Math.round(Math.min(...panels.map((p, i) => p.fontSize * scales[i])) * 10) / 10,
  };
};
