import type { EdgeData, GraphOptions, ID, NodeData } from '@antv/g6';
import { HOVER_BUBBLE_SETS } from './hover-bubble-sets';
import { HYPERGRAPH_LAYOUT } from './register';
import type { HypergraphTheme } from './theme';
import { resolveTheme, typeColorsOf } from './theme';

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
}

export type HypergraphSpec = Required<Pick<GraphOptions, 'data' | 'node' | 'edge' | 'layout' | 'plugins'>> & {
  /** 超边 id → 超边（含 2 元超边）/ hyperedge id → hyperedge, 2-member ones included */
  hyperedges: Map<ID, HyperedgeItem & { id: ID }>;
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
  } = options;
  const theme = resolveTheme(options.theme);
  const isGraph = mode === 'graph';

  let nodes: NodeData[] = Object.entries(graph.vertices).map(([id, value]) => ({ ...value, id, label: id }));
  const edges: EdgeData[] = [];
  const lineIds = new Set<ID>();
  const pushLine = (a: ID, b: ID, attrs: Record<string, any>) => {
    const id = pairId(a, b);
    if (lineIds.has(id)) return;
    lineIds.add(id);
    edges.push({ ...attrs, id, source: a, target: b });
  };

  const hyperedges = new Map<ID, HyperedgeItem & { id: ID }>();
  const layoutHyperedges: { id: ID; weight: number; members: ID[] }[] = [];
  const plugins: { type: string; key: string; [key: string]: any }[] = [];

  graph.hyperedges.forEach((he, i) => {
    const members = [...new Set(he.members)];
    if (members.length < 2) return;
    const id = he.id ?? (members.length === 2 ? pairId(members[0], members[1]) : members.join(PAIR_SEP));
    const item = { ...he, id, members };
    hyperedges.set(id, item);
    const { members: _, id: __, ...attrs } = he;

    if (members.length === 2) {
      pushLine(members[0], members[1], attrs);
      return;
    }
    if (isGraph) {
      if (graphEdges === 'clique') {
        for (let a = 0; a < members.length; a++) {
          for (let b = a + 1; b < members.length; b++) pushLine(members[a], members[b], attrs);
        }
      }
      return;
    }
    const color = theme.hyperedgeColors[i % theme.hyperedgeColors.length];
    plugins.push({
      key: bubbleKeyOf(id),
      type: HOVER_BUBBLE_SETS,
      members,
      // 只圈节点，不包裹标签
      memberBoundsType: 'key',
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
  const large = nodes.length > theme.largeGraphThreshold;
  const hasCenter = centerNode !== undefined && nodes.some((n) => n.id === centerNode);

  return {
    data: { nodes, edges },
    hyperedges,
    plugins: isGraph ? [] : plugins,
    node: {
      palette: { field: 'cluster' } as any,
      style: {
        size: large ? theme.largeNodeSize : theme.nodeSize,
        labelText,
        fill: (d: NodeData) =>
          hasCenter && d.id === centerNode ? theme.centerColor : typeColors[(d as any)[typeField]] || theme.nodeColor,
        // 显式写出被状态覆盖的样式：G6 移除状态时只回到这里的值，不写就会保留状态样式
        opacity: 1,
        lineWidth: 0,
        labelFontWeight: 'normal',
      },
      // 点击超边高亮：成员实体 highlight，其余 inactive
      state: {
        highlight: { stroke: theme.highlightColor, lineWidth: 3, labelFontWeight: 'bold' },
        inactive: { opacity: theme.inactiveNodeOpacity },
      },
    },
    edge: {
      style: { size: isGraph ? 3 : 2, stroke: theme.edgeColor, lineWidth: 1, opacity: 1 } as any,
      state: {
        highlight: { stroke: theme.highlightColor, lineWidth: 3 },
        inactive: { opacity: theme.inactiveEdgeOpacity },
      },
    },
    // 超图模式：超图布局，连线也作为 2 元超边参与，以中心实体为中心呈花瓣状排布；
    // 图模式：力导布局
    layout: !isGraph
      ? {
          type: HYPERGRAPH_LAYOUT,
          hyperedges: layoutHyperedges,
          centerNode: hasCenter ? centerNode : undefined,
          nodeSpacing: 50,
          // 标签互不重叠：与节点样式的 labelText、字号保持一致
          preventLabelOverlap: true,
          labelText,
          labelFontSize: theme.labelFontSize,
        }
      : { type: 'force', preventOverlap: true, gravity: 50, linkDistance: 50 },
  };
};
