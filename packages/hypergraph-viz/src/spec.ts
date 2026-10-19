import type { EdgeData, GraphOptions, ID, NodeData } from '@antv/g6';
import { HOVER_BUBBLE_SETS } from './hover-bubble-sets';
import { HYPERGRAPH_LAYOUT } from './register';
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
 * <zh/> 布局设置。超图模式默认 'hypergraph'；'force' 为改造前的力导 + 主超边聚类；图模式下 'hypergraph' 按 'force' 处理
 *
 * <en/> Layout settings. Hyper mode defaults to 'hypergraph'; 'force' is the former force layout clustered by primary hyperedge;
 * in graph mode 'hypergraph' falls back to 'force'
 */
export interface LayoutSettings {
  type?: 'hypergraph' | 'force' | 'force-atlas2' | 'circular';
  /** 节点间距（超图布局），默认 50 / node spacing of the hypergraph layout, defaults to 50 */
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
   * 图模式下 3 个及以上成员的超边：'binary' 丢弃（并去掉没有连线的顶点），'clique' 拆成两两连线
   * In graph mode, hyperedges with 3+ members are dropped ('binary', isolated vertices removed too) or expanded into pairwise lines ('clique')
   */
  graphEdges?: 'binary' | 'clique';
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
  /** 节点大小：固定（默认），或按所属超边数 / fixed node size (default) or scaled by degree */
  nodeSizeBy?: 'fixed' | 'degree';
  layout?: LayoutSettings;
}

export type HypergraphSpec = Required<Pick<GraphOptions, 'data' | 'node' | 'edge' | 'layout' | 'plugins'>> & {
  /** 超边 id → 超边（含 2 元超边）/ hyperedge id → hyperedge, 2-member ones included */
  hyperedges: Map<ID, HyperedgeItem & { id: ID }>;
  /** 连线 id → 产生它的超边 id / line id → ids of the hyperedges it comes from */
  lineHyperedges: Map<ID, ID[]>;
};

// 2 元超边 / 拆出的连线的 id：两端按字典序拼接
const PAIR_SEP = '|#|';
export const pairId = (a: ID, b: ID) => (a < b ? `${a}${PAIR_SEP}${b}` : `${b}${PAIR_SEP}${a}`);

/** 3 个及以上成员的超边对应的轮廓插件 key / key of the contour plugin of a hyperedge with 3+ members */
export const bubbleKeyOf = (id: ID) => `bubble-sets-${id}`;

/**
 * <zh/> 把超图转为 G6 配置：data、node、edge、layout、plugins
 *
 * <en/> Convert a hypergraph into G6 options
 */
export const toG6Spec = (graph: HypergraphData, options: SpecOptions = {}): HypergraphSpec => {
  const {
    mode = 'hyper',
    centerNode,
    typeField = 'entity_type',
    graphEdges = 'binary',
    labelText = (d: NodeData) => String(d.id),
    contours = true,
    contourBounds = 'key',
    nodeSizeBy = 'fixed',
    layout: layoutSettings = {},
  } = options;
  const theme = resolveTheme(options.theme);
  const isGraph = mode === 'graph';

  let nodes: NodeData[] = Object.entries(graph.vertices).map(([id, value]) => ({ ...value, id, label: id }));
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
  const layoutHyperedges: { id: ID; weight: number; members: ID[] }[] = [];
  const plugins: { type: string; key: string; [key: string]: any }[] = [];

  graph.hyperedges.forEach((he, i) => {
    const members = [...new Set(he.members)];
    if (members.length < 2) return;
    const id = hyperedgeIdOf(he);
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
      hyperedge: item,
      fill: color,
      stroke: color,
      ...theme.bubbleOptions,
      ...theme.bubble.normal,
    });
    layoutHyperedges.push({ id, weight: he.weight || members.length, members });
  });

  if (isGraph && graphEdges === 'binary') {
    const connected = new Set<ID>();
    edges.forEach((e) => {
      connected.add(e.source);
      connected.add(e.target);
    });
    nodes = nodes.filter((n) => connected.has(n.id));
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

  const typeColors = options.typeColors ?? typeColorsOf(nodes, typeField, theme.typePalette);
  const nodeColors = options.nodeColors ?? {};
  const large = nodes.length > theme.largeGraphThreshold;
  const hasCenter = centerNode !== undefined && nodes.some((n) => n.id === centerNode);
  const baseSize = large ? theme.largeNodeSize : theme.nodeSize;

  // 按度数：最大度数的节点为 1.5 倍，度数 0 的为 0.75 倍
  let sizeOf: number | ((d: NodeData) => number) = baseSize;
  if (nodeSizeBy === 'degree') {
    const degree = new Map<ID, number>();
    hyperedges.forEach((he) => he.members.forEach((m) => degree.set(m, (degree.get(m) || 0) + 1)));
    const max = Math.max(1, ...degree.values());
    sizeOf = (d: NodeData) => Math.round(baseSize * (0.75 + 0.75 * Math.sqrt((degree.get(d.id) || 0) / max)));
  }

  const layoutType = layoutSettings.type ?? (isGraph ? 'force' : HYPERGRAPH_LAYOUT);
  const layoutCenter = hasCenter && layoutSettings.useCenter !== false ? centerNode : undefined;
  const sizeOption = nodeSizeBy === 'degree' ? { nodeSize: sizeOf } : {};
  let layout: Record<string, any>;
  if (layoutType === 'circular') {
    layout = { type: 'circular', ...sizeOption };
  } else if (layoutType === 'force-atlas2') {
    layout = { type: 'force-atlas2', preventOverlap: true, kr: 50, ...sizeOption };
  } else if (!isGraph && layoutType === HYPERGRAPH_LAYOUT) {
    // 超图布局，连线也作为 2 元超边参与，以中心实体为中心呈花瓣状排布
    layout = {
      type: HYPERGRAPH_LAYOUT,
      hyperedges: layoutHyperedges,
      centerNode: layoutCenter,
      nodeSpacing: layoutSettings.nodeSpacing ?? 50,
      // 标签互不重叠：与节点样式的 labelText、字号保持一致
      preventLabelOverlap: layoutSettings.preventLabelOverlap ?? true,
      labelText,
      labelFontSize: theme.labelFontSize,
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
    plugins: isGraph || !contours ? [] : plugins,
    node: {
      palette: { field: 'cluster' } as any,
      style: {
        size: sizeOf as any,
        labelText,
        labelFontSize: theme.labelFontSize,
        fill: (d: NodeData) =>
          nodeColors[d.id] ??
          (hasCenter && d.id === centerNode ? theme.centerColor : typeColors[(d as any)[typeField]] || theme.nodeColor),
        // 显式写出被状态覆盖的样式：G6 移除状态时只回到这里的值，不写就会保留状态样式
        opacity: 1,
        lineWidth: 0,
        labelFontWeight: 'normal',
        halo: false,
      },
      // 选中：选中实体 / 选中超边的成员 highlight，无关的 inactive；表格行悬停：active
      state: {
        highlight: { stroke: theme.highlightColor, lineWidth: 3, labelFontWeight: 'bold' },
        inactive: { opacity: theme.inactiveNodeOpacity },
        active: { opacity: 1, halo: true, haloStroke: theme.highlightColor, haloLineWidth: 12, haloStrokeOpacity: 0.3 },
      },
    },
    edge: {
      style: { size: isGraph ? 3 : 2, stroke: theme.edgeColor, lineWidth: 1, opacity: 1 } as any,
      state: {
        highlight: { stroke: theme.highlightColor, lineWidth: 3 },
        inactive: { opacity: theme.inactiveEdgeOpacity },
        active: { stroke: theme.highlightColor, lineWidth: 3, opacity: 1 },
      },
    },
    layout: layout as NonNullable<GraphOptions['layout']>,
  };
};
