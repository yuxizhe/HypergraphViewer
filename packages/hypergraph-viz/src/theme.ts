/**
 * <zh/> 超边轮廓的透明度与线宽
 *
 * <en/> Opacity and line width of a hyperedge contour
 */
export interface BubbleState {
  fillOpacity: number;
  strokeOpacity: number;
  lineWidth: number;
}

export interface HypergraphTheme {
  /** 超边轮廓按出现顺序循环取色 / hyperedge contours cycle through these colors */
  hyperedgeColors: string[];
  /** 实体类型按出现顺序循环取色 / entity types cycle through these colors */
  typePalette: string[];
  /** 没有类型颜色时的节点颜色 / node color when its type has no color */
  nodeColor: string;
  /** 中心实体的颜色 / color of the center node */
  centerColor: string;
  /** 点击选中时的描边颜色 / stroke color of selected elements */
  highlightColor: string;
  /** 淡出实体（fadedNodes）的描边与虚线颜色 / color of faded vertices' outline and links */
  fadedColor: string;
  /** 连线（2 元超边）颜色 / color of lines (2-member hyperedges) */
  edgeColor: string;
  nodeSize: number;
  /** 节点数超过 largeGraphThreshold 时的节点尺寸 / node size once the node count exceeds largeGraphThreshold */
  largeNodeSize: number;
  largeGraphThreshold: number;
  labelFontSize: number;
  /** 标签按度数分级（labelBy: 'degree'）时，度数最小、最大的标签颜色 / label colors of the lowest and highest degree with labelBy: 'degree' */
  labelDegreeFill: [string, string];
  /** 超边轮廓：常态 / 点击选中 / 其他超边被选中时变淡 / contour: normal, selected, another one selected */
  bubble: { normal: BubbleState; highlight: BubbleState; dimmed: BubbleState };
  /** 多边形画法（layout.type: 'polygon'）在 bubble 各档之上的描边：边要看得清，才分得开叠在一起的多边形 / polygon outlines over the bubble levels */
  polygonStroke: Record<'normal' | 'highlight' | 'dimmed', Pick<BubbleState, 'strokeOpacity' | 'lineWidth'>>;
  /** bubble-sets 的路由与轮廓参数，默认贴紧节点（nodeR0 1 / nodeR1 5）/ bubble-sets routing and contour options */
  bubbleOptions: Record<string, unknown>;
  /** 嵌套轮廓（contourNesting）中节点每被包一层，轮廓外扩的距离 / how far a contour grows per nesting level with contourNesting */
  contourNestStep: number;
  /** 其他元素被选中时，节点、连线的透明度 / opacity of nodes and lines while something else is selected */
  inactiveNodeOpacity: number;
  inactiveEdgeOpacity: number;
}

export const DEFAULT_THEME: HypergraphTheme = {
  hyperedgeColors: [
    '#F6BD16',
    '#00C9C9',
    '#F08F56',
    '#D580FF',
    '#FF3D00',
    '#16f69c',
    '#004ac9',
    '#f056d1',
    '#a680ff',
    '#c8ff00',
  ],
  // 前 6 色为原调色板；后 6 色在类型多时使用，与前面的颜色区分开
  typePalette: [
    '#00C9C9',
    '#a68fff',
    '#F08F56',
    '#0d7c4f',
    '#004ac9',
    '#f056d1',
    '#F6BD16',
    '#c0392b',
    '#8c564b',
    '#93c90e',
    '#6b4c9a',
    '#5fa8d3',
  ],
  nodeColor: '#8b5cf6',
  centerColor: '#6d28d9',
  highlightColor: '#6d28d9',
  fadedColor: '#7c3aed',
  edgeColor: '#a68fff',
  nodeSize: 20,
  largeNodeSize: 15,
  largeGraphThreshold: 100,
  labelFontSize: 12,
  labelDegreeFill: ['#9ca3af', '#111827'],
  bubble: {
    normal: { fillOpacity: 0.2, strokeOpacity: 0.2, lineWidth: 1 },
    highlight: { fillOpacity: 0.45, strokeOpacity: 1, lineWidth: 3 },
    dimmed: { fillOpacity: 0.03, strokeOpacity: 0.05, lineWidth: 1 },
  },
  polygonStroke: {
    normal: { strokeOpacity: 0.8, lineWidth: 2 },
    highlight: { strokeOpacity: 1, lineWidth: 3 },
    dimmed: { strokeOpacity: 0.08, lineWidth: 1 },
  },
  bubbleOptions: {
    maxRoutingIterations: 100,
    maxMarchingIterations: 20,
    pixelGroup: 4,
    edgeR0: 30,
    edgeR1: 50,
    nodeR0: 1,
    nodeR1: 5,
    morphBuffer: 10,
    threshold: 4,
    memberInfluenceFactor: 1,
    edgeInfluenceFactor: 4,
    nonMemberInfluenceFactor: -0.8,
    virtualEdges: true,
  },
  contourNestStep: 3,
  inactiveNodeOpacity: 0.15,
  inactiveEdgeOpacity: 0.1,
};

export const resolveTheme = (theme?: Partial<HypergraphTheme>): HypergraphTheme => ({
  ...DEFAULT_THEME,
  ...theme,
  bubble: { ...DEFAULT_THEME.bubble, ...theme?.bubble },
  polygonStroke: { ...DEFAULT_THEME.polygonStroke, ...theme?.polygonStroke },
  bubbleOptions: { ...DEFAULT_THEME.bubbleOptions, ...theme?.bubbleOptions },
});

/**
 * <zh/> 按出现顺序给实体类型分配颜色。传入全图顶点可让各个子图里同一类型颜色一致
 *
 * <en/> Assign colors to entity types in order of appearance. Pass all vertices to keep colors stable across subgraphs
 */
export const typeColorsOf = (
  vertices: Iterable<Record<string, any>>,
  typeField = 'entity_type',
  palette = DEFAULT_THEME.typePalette,
): Record<string, string> => {
  const colors: Record<string, string> = {};
  let i = 0;
  for (const v of vertices) {
    const type = v?.[typeField];
    if (!type || type in colors) continue;
    colors[type] = palette[i++ % palette.length];
  }
  return colors;
};
