import type { EdgeData, GraphOptions, ID, NodeData } from '@antv/g6';
import { HOVER_BUBBLE_SETS } from './hover-bubble-sets';
import { HYPERGRAPH_LAYOUT, POLYGON_LAYOUT } from './register';
import type { HypergraphTheme } from './theme';
import { resolveTheme, typeColorsOf } from './theme';
import { hyperedgeIdOf } from './analysis';

/**
 * <zh/> 超边：成员 + 任意属性（keywords、summary、type 等）
 *
 * <en/> Hyperedge: members plus arbitrary attributes
 */
export interface HyperedgeItem {
  id?: ID;
  members: ID[];
  weight?: number;
  [key: string]: any;
}

/**
 * <zh/> 渲染输入：顶点 id → 属性，超边列表。2 个成员的超边画成连线，3 个及以上画成轮廓
 *
 * <en/> Render input: vertex id → attributes, plus hyperedges. 2-member hyperedges are drawn as lines, larger ones as contours
 */
export interface HypergraphData {
  vertices: Record<ID, Record<string, any>>;
  hyperedges: HyperedgeItem[];
}

export type HypergraphMode = 'hyper' | 'graph';

/**
 * <zh/> 布局设置。超图模式默认 'hypergraph'；'polygon' 为多边形画法（HGPolyVis）：超图布局 + 多边形优化，超边画成成员在角上的多边形；
 * 'force' 为改造前的力导 + 主超边聚类；图模式下 'hypergraph'、'polygon' 按 'force' 处理
 *
 * <en/> Layout settings. Hyper mode defaults to 'hypergraph'; 'polygon' is the polygon drawing (HGPolyVis): the hypergraph layout
 * plus polygon optimization, with each hyperedge drawn as a polygon whose corners are its members; 'force' is the former force
 * layout clustered by primary hyperedge; in graph mode 'hypergraph' and 'polygon' fall back to 'force'
 */
export interface LayoutSettings {
  type?: 'hypergraph' | 'polygon' | 'force' | 'force-atlas2' | 'circular';
  /** 节点间距（超图布局、多边形布局），默认 50 / node spacing of the hypergraph and polygon layouts, defaults to 50 */
  nodeSpacing?: number;
  /** 标签防重叠（超图布局），默认开 / prevent label overlap in the hypergraph layout, on by default */
  preventLabelOverlap?: boolean;
  /** 以 centerNode 为布局中心，默认开；关闭后 centerNode 只决定颜色 / place centerNode at the center, on by default */
  useCenter?: boolean;
}

export interface SpecOptions {
  /** 'hyper'：超图布局 + 超边轮廓；'graph'：只画连线、力导布局 / hypergraph layout with contours, or lines with force layout */
  mode?: HypergraphMode;
  /** 布局中心、着中心色的实体 / node placed at the center and painted with centerColor */
  centerNode?: ID;
  /** 顶点上表示类型的字段，用于着色 / vertex field holding its type, used for coloring */
  typeField?: string;
  /** 类型 → 颜色；不传时按本图中出现的类型从 theme.typePalette 依次取色 / type → color */
  typeColors?: Record<string, string>;
  /**
   * 图模式下 3 个及以上成员的超边：'binary' 丢弃（并去掉没有连线的顶点），'clique' 拆成两两连线，
   * 'star' 画成一个超边节点、连向各成员（二部图 / 关联图）
   * In graph mode, hyperedges with 3+ members are dropped ('binary', isolated vertices removed too), expanded into pairwise lines ('clique'),
   * or drawn as a hyperedge node linked to each member ('star', the bipartite incidence graph)
   */
  graphEdges?: 'binary' | 'clique' | 'star';
  /** 节点标签，默认为 id / node label, defaults to the id */
  labelText?: (node: NodeData) => string;
  theme?: Partial<HypergraphTheme>;
  /** 单个实体的颜色，优先于类型颜色 / per-vertex colors, overriding type colors */
  nodeColors?: Record<ID, string>;
  /** 超边 id → 轮廓颜色；不传时按超边在 data 中的顺序循环取色（见 hyperedgeColorsOf）/ hyperedge id → contour color */
  hyperedgeColors?: Record<ID, string>;
  /** 是否画超边轮廓，默认 true；关闭后仍按超边布局 / draw hyperedge contours (default true); the layout still uses hyperedges */
  contours?: boolean;
  /** 轮廓范围：'key' 只圈节点（默认），'render' 连标签一起圈 / contour bounds: node shapes only ('key', default) or with labels */
  contourBounds?: 'key' | 'render';
  /**
   * 嵌套轮廓（仿 DHG）：对每个节点，所属超边按成员数从小到大排，小超边在内、大超边在外，
   * 节点每被包一层，外层轮廓在它周围多外扩 theme.contourNestStep，共享枢纽周围因此是一圈圈同心轮廓
   * Nested contours (after DHG): for each node, its hyperedges are ordered by size, smaller inside and larger outside;
   * each level a node is already wrapped in grows the next contour around it by theme.contourNestStep, so shared hubs get
   * concentric contours
   */
  contourNesting?: boolean;
  /** 节点大小：固定（默认），或按所属超边数 / fixed node size (default) or scaled by degree */
  nodeSizeBy?: 'fixed' | 'degree';
  /**
   * 标签：统一字号（默认），或按子图内度数分级——度数越大字号越大（基础字号 -2 到 +2）、颜色越深（theme.labelDegreeFill），中心加粗
   * Uniform labels (default), or graded by degree in the subgraph: larger (base font size -2 to +2) and darker (theme.labelDegreeFill), the center in bold
   */
  labelBy?: 'uniform' | 'degree';
  /**
   * 标签避让：布局完成后，与更重要的标签（中心、度数高的）重叠的标签不显示，悬停、选中时显示。
   * 通常与 layout.preventLabelOverlap: false 一起用（布局不为标签让位，超边更紧凑）
   * Hide labels overlapping more important ones (center, higher degree) after layout; shown on hover and selection.
   * Usually paired with layout.preventLabelOverlap: false
   */
  hideOverlappingLabels?: boolean;
  /**
   * 淡出的实体（如枢纽）：不参与布局、不显示，超边去掉它们后照常画出。去掉它们后只剩一个成员的超边不画；
   * 悬停该成员时，淡出的实体在关联实体的中心附近淡入，以虚线连到它（悬停命中带上这些超边）
   * Faded vertices (e.g. hubs): left out of the layout and not drawn; hyperedges are drawn without them. A hyperedge left with
   * one member is not drawn; hovering that member fades in the faded vertex near the center of its neighbors with a dashed
   * link (the hover hit carries those hyperedges)
   */
  fadedNodes?: ID[];
  layout?: LayoutSettings;
}

/**
 * <zh/> 淡出实体与只剩一个成员的超边的成员之间的一条虚线：hyperedges 为产生它的、只剩一个成员的超边
 *
 * <en/> Dashed link between a faded vertex and a drawn one; hyperedges are the ones it comes from
 */
export interface FadedLink {
  id: ID;
  source: ID;
  target: ID;
  hyperedges: ID[];
}

export type HypergraphSpec = Required<Pick<GraphOptions, 'data' | 'node' | 'edge' | 'layout' | 'plugins'>> & {
  /** 超边 id → 超边（含 2 元超边）/ hyperedge id → hyperedge, 2-member ones included */
  hyperedges: Map<ID, HyperedgeItem & { id: ID }>;
  /** 连线 id → 产生它的超边 id / line id → ids of the hyperedges it comes from */
  lineHyperedges: Map<ID, ID[]>;
  /**
   * 淡出的实体（未定位，布局后再放置）、它们的虚线、超边 id → 其中淡出的成员、
   * 实体 → 只剩它一个成员的超边（完整成员）
   * Faded vertices (placed after layout), their dashed links, hyperedge id → its faded members,
   * vertex → the hyperedges it is the only drawn member of (full members)
   */
  faded: { nodes: NodeData[]; links: FadedLink[]; members: Map<ID, ID[]>; dropped: Map<ID, HyperedgeItem[]> };
  /** 超边节点 id → 超边 id（graphEdges: 'star'）/ hyperedge node id → hyperedge id, with graphEdges: 'star' */
  hyperedgeNodes: Map<ID, ID>;
};

/** 淡出实体虚线的 id / id of a faded vertex's dashed link */
export const fadedLinkId = (faded: ID, node: ID) => `faded:${faded}->${node}`;

// 2 元超边 / 拆出的连线的 id：两端按字典序拼接
const PAIR_SEP = '|#|';
export const pairId = (a: ID, b: ID) => (a < b ? `${a}${PAIR_SEP}${b}` : `${b}${PAIR_SEP}${a}`);

/** 超边节点的 id（graphEdges: 'star'）/ id of a hyperedge node with graphEdges: 'star' */
export const hyperedgeNodeId = (id: ID) => `hyperedge:${id}`;

// 超边节点到成员的连线 id
const starLinkId = (id: ID, member: ID) => `hyperedge:${id}->${member}`;

/** 3 个及以上成员的超边对应的轮廓插件 key / key of the contour plugin of a hyperedge with 3+ members */
export const bubbleKeyOf = (id: ID) => `bubble-sets-${id}`;

/**
 * <zh/> 把超图转为 G6 配置：data、node、edge、layout、plugins
 *
 * <en/> Convert a hypergraph into G6 options
 */
// 两个 #rrggbb 颜色按 t 线性插值
const mixColor = (a: string, b: string, t: number) => {
  const ca = parseInt(a.slice(1), 16);
  const cb = parseInt(b.slice(1), 16);
  const channel = (shift: number) => {
    const x = (ca >> shift) & 255;
    return Math.round(x + (((cb >> shift) & 255) - x) * t);
  };
  return `#${((1 << 24) | (channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).slice(1)}`;
};

export const toG6Spec = (graph: HypergraphData, options: SpecOptions = {}): HypergraphSpec => {
  const {
    mode = 'hyper',
    centerNode,
    typeField = 'entity_type',
    graphEdges = 'binary',
    labelText = (d: NodeData) => String(d.id),
    contours = true,
    contourBounds = 'key',
    contourNesting = false,
    nodeSizeBy = 'fixed',
    labelBy = 'uniform',
    layout: layoutSettings = {},
  } = options;
  const theme = resolveTheme(options.theme);
  const isGraph = mode === 'graph';
  // 多边形画法：超边画成成员在角上的多边形 / polygon drawing: hyperedges as polygons with members at the corners
  const polygon = !isGraph && layoutSettings.type === POLYGON_LAYOUT;

  const fadedSet = new Set((options.fadedNodes || []).filter((id) => id in graph.vertices));
  const allNodes: NodeData[] = Object.entries(graph.vertices).map(([id, value]) => ({ ...value, id, label: id }));
  let nodes = allNodes.filter((n) => !fadedSet.has(n.id));
  const fadedNodes = allNodes.filter((n) => fadedSet.has(n.id));
  const fadedLinks = new Map<ID, FadedLink>();
  const fadedMembers = new Map<ID, ID[]>();
  // 只剩一个成员的超边，按该成员记录
  const dropped = new Map<ID, HyperedgeItem[]>();
  const edges: EdgeData[] = [];
  const lineHyperedges = new Map<ID, ID[]>();
  const pushLine = (a: ID, b: ID, attrs: Record<string, any>, owner: ID) => {
    const id = pairId(a, b);
    const owners = lineHyperedges.get(id);
    if (owners) {
      if (!owners.includes(owner)) owners.push(owner);
      return;
    }
    lineHyperedges.set(id, [owner]);
    edges.push({ ...attrs, id, source: a, target: b });
  };

  const hyperedges = new Map<ID, HyperedgeItem & { id: ID }>();
  const hyperedgeNodes = new Map<ID, ID>();
  const starNodes: NodeData[] = [];
  // 超边 id → 超边节点及其连线的颜色；样式里按 id 查，只改颜色时重绘即可
  const starColors = new Map<ID, string>();
  const layoutHyperedges: { id: ID; weight: number; members: ID[] }[] = [];
  const plugins: { type: string; key: string; [key: string]: any }[] = [];

  graph.hyperedges.forEach((he, i) => {
    const allMembers = [...new Set(he.members)];
    if (allMembers.length < 2) return;
    const id = hyperedgeIdOf(he);
    // 淡出的成员不画；只剩一个成员时该超边不画，记下这个成员与淡出成员的虚线
    const members = allMembers.filter((m) => !fadedSet.has(m));
    if (members.length < allMembers.length) {
      const faded = allMembers.filter((m) => fadedSet.has(m));
      fadedMembers.set(id, faded);
      if (members.length === 1) {
        const [m] = members;
        dropped.set(m, [...(dropped.get(m) || []), { ...he, id, members: allMembers }]);
        faded.forEach((f) => {
          const linkId = fadedLinkId(f, m);
          const link = fadedLinks.get(linkId);
          if (link) link.hyperedges.push(id);
          else fadedLinks.set(linkId, { id: linkId, source: f, target: m, hyperedges: [id] });
        });
      }
      if (members.length < 2) return;
    }
    const item = { ...he, id, members };
    hyperedges.set(id, item);
    // type、style、states 是 G6 元素的保留字段（如超边的 type 会被当成连线类型），不带到连线上
    const { members: _, id: __, type: ___, style: _s, states: _st, ...attrs } = he;

    if (members.length === 2) {
      pushLine(members[0], members[1], attrs, id);
      return;
    }
    if (isGraph) {
      if (graphEdges === 'clique') {
        for (let a = 0; a < members.length; a++) {
          for (let b = a + 1; b < members.length; b++) pushLine(members[a], members[b], attrs, id);
        }
      } else if (graphEdges === 'star') {
        const nodeId = hyperedgeNodeId(id);
        hyperedgeNodes.set(nodeId, id);
        starColors.set(id, options.hyperedgeColors?.[id] ?? theme.hyperedgeColors[i % theme.hyperedgeColors.length]);
        starNodes.push({ ...attrs, id: nodeId, hyperedge: id, memberCount: members.length });
        members.forEach((m) => {
          const linkId = starLinkId(id, m);
          lineHyperedges.set(linkId, [id]);
          edges.push({ id: linkId, source: nodeId, target: m });
        });
      }
      return;
    }
    const color = options.hyperedgeColors?.[id] ?? theme.hyperedgeColors[i % theme.hyperedgeColors.length];
    plugins.push({
      key: bubbleKeyOf(id),
      type: HOVER_BUBBLE_SETS,
      members,
      // 默认只圈节点，不包裹标签
      memberBoundsType: contourBounds,
      // 悬停卡片等显示完整成员（含淡出的）
      hyperedge: { ...item, members: allMembers },
      fill: color,
      stroke: color,
      ...theme.bubbleOptions,
      ...theme.bubble.normal,
      // 大的多边形在下、小的在上 / larger polygons below smaller ones
      ...(polygon && { polygon: true, zIndex: -1 - members.length / 1000, lineJoin: 'round', ...theme.polygonStroke.normal }),
    });
    layoutHyperedges.push({ id, weight: he.weight || members.length, members });
  });

  if (contourNesting && !polygon) {
    // 每个节点的轮廓按成员数排序（同样大小按出现顺序），第 k 层外扩 k 个步长
    // Each node's contours by size (ties in order of appearance); level k grows by k steps
    const contoursOf = new Map<ID, typeof plugins>();
    plugins.forEach((p) => p.members.forEach((m: ID) => contoursOf.set(m, [...(contoursOf.get(m) || []), p])));
    plugins.forEach((p) => (p.memberPadding = {}));
    contoursOf.forEach((list, m) => {
      [...list]
        .sort((a, b) => a.members.length - b.members.length)
        .forEach((p, level) => level && (p.memberPadding[m] = level * theme.contourNestStep));
    });
  }

  if (isGraph && graphEdges === 'binary') {
    const connected = new Set<ID>();
    edges.forEach((e) => {
      connected.add(e.source);
      connected.add(e.target);
    });
    nodes = nodes.filter((n) => connected.has(n.id));
  } else if (isGraph && graphEdges === 'star') {
    nodes = [...nodes, ...starNodes];
  } else if (!isGraph) {
    // 每个顶点取所属权重最大的超边作为聚类（调色板分组）
    const clusterOf = new Map<ID, { id: ID; weight: number }>();
    layoutHyperedges.forEach((he) => {
      he.members.forEach((m) => {
        const cur = clusterOf.get(m);
        if (!cur || he.weight > cur.weight) clusterOf.set(m, { id: he.id, weight: he.weight });
      });
    });
    nodes = nodes.map((n) => {
      const c = clusterOf.get(n.id);
      return c ? { ...n, cluster: c.id } : n;
    });
  }

  const drawnIds = new Set(nodes.map((n) => n.id));
  const typeColors = options.typeColors ?? typeColorsOf(allNodes, typeField, theme.typePalette);
  const nodeColors = options.nodeColors ?? {};
  const large = nodes.length > theme.largeGraphThreshold;
  const hasCenter = centerNode !== undefined && nodes.some((n) => n.id === centerNode);
  // 淡出的中心仍着中心色
  const centerColored = hasCenter || (centerNode !== undefined && fadedSet.has(centerNode));
  const baseSize = large ? theme.largeNodeSize : theme.nodeSize;

  // 度数分级 t ∈ [0, 1]：按对数归一到除中心外的最大度数（中心出现在每条超边中，按它归一其他实体都挤在最低档），中心为 1
  const degree = new Map<ID, number>();
  hyperedges.forEach((he) => he.members.forEach((m) => degree.set(m, (degree.get(m) || 0) + 1)));
  const maxDegree = Math.max(0, ...[...degree].filter(([id]) => id !== centerNode).map(([, d]) => d));
  const levelOf = (id: ID) =>
    id === centerNode || fadedSet.has(id) ? 1 : maxDegree ? Math.min(1, Math.log1p(degree.get(id) || 0) / Math.log1p(maxDegree)) : 0;

  // 按度数：0.7 倍到 1.5 倍
  let sizeOf: number | ((d: NodeData) => number) = baseSize;
  if (nodeSizeBy === 'degree') sizeOf = (d: NodeData) => Math.round(baseSize * (0.7 + 0.8 * levelOf(d.id)));
  // 超边节点（graphEdges: 'star'）：菱形，边长与成员数成正比（3 个成员与实体节点一样大），最大为实体节点的 3 倍；
  // 不带标签（悬停卡片显示超边属性）
  const isHyperedgeNode = (d: NodeData) => hyperedgeNodes.has(d.id);
  const hasStar = hyperedgeNodes.size > 0;
  if (hasStar) {
    const vertexSize = sizeOf;
    sizeOf = (d: NodeData) =>
      isHyperedgeNode(d)
        ? Math.round(baseSize * Math.min(3, (d.memberCount as number) / 3))
        : typeof vertexSize === 'function'
          ? vertexSize(d)
          : vertexSize;
  }

  // 标签按度数：字号 基础 -2 到 +2，颜色由浅灰到近黑；只有中心加粗（子图小时最高一档的实体很多，都加粗太重）
  const byDegree = labelBy === 'degree';
  const labelFontSizeOf: number | ((d: NodeData) => number) = byDegree
    ? (d: NodeData) => Math.round(theme.labelFontSize - 2 + 4 * levelOf(d.id))
    : theme.labelFontSize;
  const nodeLabelText = hasStar ? (d: NodeData) => (isHyperedgeNode(d) ? '' : labelText(d)) : labelText;
  const [lowFill, highFill] = theme.labelDegreeFill;
  const labelStyle = byDegree
    ? {
        labelFill: (d: NodeData) => mixColor(lowFill, highFill, levelOf(d.id)),
        labelFontWeight: (d: NodeData) => (d.id === centerNode ? 'bold' : 'normal'),
      }
    : { labelFontWeight: 'normal' };

  const layoutType = layoutSettings.type ?? (isGraph ? 'force' : HYPERGRAPH_LAYOUT);
  const layoutCenter = hasCenter && layoutSettings.useCenter !== false ? centerNode : undefined;
  // 节点大小不一时布局按各自大小防重叠
  const sizeOption = nodeSizeBy === 'degree' || hasStar ? { nodeSize: sizeOf } : {};
  let layout: Record<string, any>;
  if (layoutType === 'circular') {
    layout = { type: 'circular', ...sizeOption };
  } else if (layoutType === 'force-atlas2') {
    layout = { type: 'force-atlas2', preventOverlap: true, kr: 50, ...sizeOption };
  } else if (!isGraph && (layoutType === HYPERGRAPH_LAYOUT || layoutType === POLYGON_LAYOUT)) {
    // 超图布局，连线也作为 2 元超边参与，以中心实体为中心呈花瓣状排布；多边形布局在此基础上再做多边形优化
    layout = {
      type: layoutType,
      hyperedges: layoutHyperedges,
      centerNode: layoutCenter,
      nodeSpacing: layoutSettings.nodeSpacing ?? 50,
      // 标签互不重叠：与节点样式的 labelText、字号保持一致
      preventLabelOverlap: layoutSettings.preventLabelOverlap ?? true,
      labelText,
      labelFontSize: labelFontSizeOf,
      ...sizeOption,
    };
  } else if (!isGraph) {
    // 改造前的做法：力导 + 按主超边聚类
    layout = {
      type: 'force',
      clustering: true,
      nodeClusterBy: 'cluster',
      preventOverlap: true,
      gravity: 50,
      linkDistance: 50,
      ...sizeOption,
    };
  } else {
    layout = { type: 'force', preventOverlap: true, gravity: 50, linkDistance: 50, ...sizeOption };
  }

  return {
    data: { nodes, edges },
    hyperedges,
    lineHyperedges,
    hyperedgeNodes,
    // 图模式 binary 去掉了没有连线的实体，连向它们的虚线一并去掉
    faded: { nodes: fadedNodes, links: [...fadedLinks.values()].filter((l) => drawnIds.has(l.target)), members: fadedMembers, dropped },
    plugins: isGraph || !contours ? [] : plugins,
    node: {
      palette: { field: 'cluster' } as any,
      // 超边节点画成菱形
      ...(hasStar && { type: (d: NodeData) => (isHyperedgeNode(d) ? 'diamond' : 'circle') }),
      style: {
        size: sizeOf as any,
        labelText: nodeLabelText,
        labelFontSize: labelFontSizeOf as any,
        fill: (d: NodeData) =>
          (hasStar ? starColors.get(hyperedgeNodes.get(d.id)!) : undefined) ??
          nodeColors[d.id] ??
          (centerColored && d.id === centerNode ? theme.centerColor : typeColors[(d as any)[typeField]] || theme.nodeColor),
        // 显式写出被状态覆盖的样式：G6 移除状态时只回到这里的值，不写就会保留状态样式
        opacity: 1,
        lineWidth: 0,
        ...(labelStyle as any),
        halo: false,
        label: true,
        // 标签不接收指针事件：悬停、点击穿透到下面的轮廓或空白处
        labelPointerEvents: 'none',
        visibility: 'visible',
      },
      // 选中：选中实体 / 选中超边的成员 highlight，无关的 inactive；表格行悬停：active
      state: {
        highlight: { stroke: theme.highlightColor, lineWidth: 3, labelFontWeight: 'bold' },
        inactive: { opacity: theme.inactiveNodeOpacity },
        active: { opacity: 1, halo: true, haloStroke: theme.highlightColor, haloLineWidth: 12, haloStrokeOpacity: 0.3 },
        // 标签避让中被隐藏的标签（hideOverlappingLabels）
        labelHidden: { label: false },
        // 淡出实体：平时不显示，相关元素悬停、选中时以虚线描边显示
        faded: { visibility: 'hidden' },
        fadedShown: { opacity: 0.9, stroke: theme.fadedColor, lineWidth: 2, lineDash: [3, 2] },
      },
    },
    edge: {
      style: {
        size: isGraph ? 3 : 2,
        // 超边节点的连线用该超边的颜色
        stroke: hasStar
          ? (d: EdgeData) => starColors.get(lineHyperedges.get(d.id!)?.[0] as ID) ?? theme.edgeColor
          : theme.edgeColor,
        lineWidth: 1,
        opacity: 1,
        visibility: 'visible',
      } as any,
      state: {
        faded: { visibility: 'hidden' },
        fadedShown: { stroke: theme.fadedColor, lineWidth: 1.5, opacity: 0.8 },
        highlight: { stroke: theme.highlightColor, lineWidth: 3 },
        inactive: { opacity: theme.inactiveEdgeOpacity },
        active: { stroke: theme.highlightColor, lineWidth: 3, opacity: 1 },
      },
    },
    layout: layout as NonNullable<GraphOptions['layout']>,
  };
};
