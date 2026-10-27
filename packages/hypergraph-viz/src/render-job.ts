/**
 * 出图任务 / Render jobs
 *
 * 一张图的描述（RenderJob）、两种渲染器共用的预处理（去掉隐藏类型、挑出淡出的枢纽），以及纯 SVG 渲染（renderJobSVG，
 * 不需要浏览器）。无头浏览器版见 node.ts 的 createHeadlessRenderer
 *
 * A job describes one image; prepareJob is shared by both renderers; renderJobSVG renders without a browser
 */
import type { ID } from '@antv/g6';
import { filterHypergraph, hyperedgeColorsOf, overlapHubs } from './analysis';
import type { MatrixOrder } from './matrix';
import { incidenceMatrixSVG } from './matrix-svg';
import type { ModelReadableKey, ModelReadableOptions } from './model-readable';
import { modelReadableKey, modelReadableLegend, modelReadableTable } from './model-readable';
import type { HypergraphData, SpecOptions } from './spec';
import { themeOf } from './spec';
import type { HypergraphSVG } from './svg-render';
import { composeSVG, renderHypergraphSVG } from './svg-render';

/**
 * <zh/> 一张图：数据与画法。layout：'canvas' 画布（超图 / 图模式），'matrix' 关联矩阵（V-mat），'dual' 画布与矩阵并排（V-dual）
 *
 * <en/> One image: data and drawing. layout: the canvas, the incidence matrix (V-mat) or both side by side (V-dual)
 */
export interface RenderJob {
  data: HypergraphData;
  centerNode?: ID;
  layout?: 'canvas' | 'matrix' | 'dual';
  /** 'hyper' 超图（默认），'graph' 图模式 / hypergraph (default) or graph mode */
  mode?: 'hyper' | 'graph';
  /** 图模式下 3 元及以上超边的画法，默认 'star'（V-star）；'clique' 为团展开（V-clique）/ default 'star' */
  graphEdges?: 'star' | 'clique' | 'binary';
  /** 超图模式的布局与画法：'hypergraph' 轮廓（V-set，默认），'polygon' 多边形（V-poly），'kelp' KelpFusion（V-kelp）/ contours (default), polygons or KelpFusion */
  layoutType?: 'hypergraph' | 'polygon' | 'kelp';
  nodeSpacing?: number;
  /** 打乱布局的种子：成员关系不变、位置按种子随机（见 LayoutSettings.shuffleSeed）/ shuffle positions by seed */
  shuffleSeed?: number;
  /** 超边 id → 颜色，覆盖默认的按顺序取色（如按公司着色）/ hyperedge id → color, over the default cycling */
  hyperedgeColors?: Record<ID, string>;
  /** 实体类型 → 颜色 / vertex type → color */
  typeColors?: Record<string, string>;
  /** 单个实体的颜色，优先于类型颜色 / per-vertex colors */
  nodeColors?: Record<ID, string>;
  /**
   * 淡出的实体（不画，写进图例）：'overlap' 按注定重叠挑出隐含枢纽（默认，与超图浏览器一致），'none' 不淡出，或直接给出 id
   * Faded vertices: implicit hubs by forced overlaps (default, as in the explorer), none, or explicit ids
   */
  fade?: 'overlap' | 'none' | ID[];
  /** 彻底去掉的实体类型（如金融数据的“财季”），先于挑枢纽去掉，与超图浏览器的 hiddenTypes 相同 / vertex types removed entirely */
  hideTypes?: string[];
  /** 模型可读模式，默认开 / model-readable mode, on by default */
  modelReadable?: boolean | ModelReadableOptions;
  /** 标签去掉最后一个冒号及之前的部分，默认开（与超图浏览器一致）/ strip the type prefix from labels, on by default */
  stripPrefix?: boolean;
  matrixOrder?: MatrixOrder;
  typeField?: string;
  nodeSizeBy?: 'fixed' | 'degree';
  /** 图片宽度，默认 'dual' 1536、其余 1024 / image width, 1536 for 'dual' and 1024 otherwise */
  width?: number;
  maxHeight?: number;
  padding?: number;
  /** 图例与映射表的语言，默认 'en' / language of the legend and table */
  locale?: 'en' | 'zh';
}

/**
 * <zh/> 两种渲染器共用的预处理：去掉隐藏类型的实体，挑出淡出的实体，补全默认值
 *
 * <en/> Shared preprocessing: drop hidden types, pick faded vertices, fill in defaults
 */
export const prepareJob = (job: RenderJob) => {
  const { fade = 'overlap', modelReadable = true, typeField = 'entity_type', layout = 'canvas' } = job;
  const types = new Set(job.hideTypes || []);
  const typed = Object.keys(job.data.vertices).filter((id) => types.has(job.data.vertices[id]?.[typeField]));
  const data = typed.length ? filterHypergraph(job.data, { nodes: typed }) : job.data;
  const fadedNodes = fade === 'none' ? [] : fade === 'overlap' ? overlapHubs(data).hubs : fade.filter((id) => id in data.vertices);
  return { data, fadedNodes, layout, modelReadable, typeField, width: job.width ?? (layout === 'dual' ? 1536 : 1024) };
};

// 与超图浏览器相同：去掉最后一个冒号（半角或全角）及之前的部分 / as in the explorer: strip up to the last colon
const stripPrefix = (id: string) => {
  const i = Math.max(id.lastIndexOf(':'), id.lastIndexOf('：'));
  return i >= 0 && i < id.length - 1 ? id.slice(i + 1) : id;
};

export interface SVGRenderResult {
  svg: string;
  width: number;
  height: number;
  /** 标签在图片中的字号（像素，多个面板取最小）/ label font size in the image, smallest panel */
  labelPx: number;
  legend: string[];
  /** MR 模式下的编号映射表（Markdown），否则为 null / mapping table in MR mode */
  table: string | null;
  key: ModelReadableKey | null;
  fadedNodes: ID[];
  /** 画布面板的几何（画布坐标，矩阵时为 null），用于计算可读性指标 / canvas geometry for readability metrics */
  geometry: HypergraphSVG | null;
}

/**
 * <zh/> 把一张图渲染成 SVG（纯函数，不需要浏览器）。参数与 createHeadlessRenderer 的 render 相同
 *
 * <en/> Render one job to SVG without a browser; same job as the headless renderer
 */
export const renderJobSVG = async (job: RenderJob): Promise<SVGRenderResult> => {
  const { data, fadedNodes, layout, modelReadable, typeField, width } = prepareJob(job);
  const { centerNode, locale = 'en' } = job;
  const labelText = job.stripPrefix === false ? undefined : (d: { id: ID }) => stripPrefix(String(d.id));
  const hyperedgeColors = { ...hyperedgeColorsOf(data), ...job.hyperedgeColors };
  const viewOptions: SpecOptions = {
    centerNode,
    mode: job.mode ?? 'hyper',
    graphEdges: job.graphEdges ?? 'star',
    typeField,
    fadedNodes,
    modelReadable,
    labelText: labelText as SpecOptions['labelText'],
    hyperedgeColors,
    typeColors: job.typeColors,
    nodeColors: job.nodeColors,
    nodeSizeBy: job.nodeSizeBy ?? 'degree',
    layout: { type: job.layoutType ?? 'hypergraph', nodeSpacing: job.nodeSpacing ?? 50, shuffleSeed: job.shuffleSeed },
  };
  const matrixPanel = () => {
    const m = incidenceMatrixSVG(data, {
      order: job.matrixOrder ?? 'degree',
      typeField,
      centerNode,
      hyperedgeColors,
      typeColors: job.typeColors,
      nodeColors: job.nodeColors,
      hubNodes: fadedNodes,
      labelText: labelText && ((id: ID) => labelText({ id })),
      modelReadable,
      fontSize: layout === 'matrix' ? 12 : themeOf(viewOptions).labelFontSize,
    });
    return { svg: m.svg, width: m.width, height: m.height, fontSize: m.fontSize };
  };
  const key = modelReadable ? modelReadableKey(data, { centerNode }) : null;
  const size = { width, maxHeight: job.maxHeight, padding: job.padding };

  let geometry: HypergraphSVG | null = null;
  let legend: string[] = [];
  let image: ReturnType<typeof composeSVG>;
  if (layout === 'matrix') {
    // 矩阵里枢纽就是一行，不需要图例；高度不设上限 / hubs are rows: no legend, no height cap
    image = composeSVG([matrixPanel()], { ...size, maxHeight: job.maxHeight ?? Infinity });
  } else {
    geometry = await renderHypergraphSVG(data, viewOptions);
    legend = key ? modelReadableLegend(key, { faded: fadedNodes, locale }) : [];
    const panels = [geometry, ...(layout === 'dual' ? [matrixPanel()] : [])];
    image = composeSVG(panels, { ...size, legend });
  }
  return {
    ...image,
    legend,
    table: key ? modelReadableTable(data, key, { faded: layout === 'matrix' ? [] : fadedNodes, locale, typeField }) : null,
    key,
    fadedNodes,
    geometry,
  };
};
