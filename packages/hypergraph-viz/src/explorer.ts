import type { ComponentType, CSSProperties, ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react';
import type { Graph } from '@antv/g6';
import type { Selection } from './selection';
import type { HypergraphData } from './spec';
import type { HypergraphSource } from './source';
import ExplorerImpl from './explorer/HypergraphExplorer.jsx';
import DatabasePanelImpl from './explorer/DatabasePanel.jsx';
import GraphCanvasImpl from './explorer/GraphCanvas.jsx';
import InspectorPanelImpl from './explorer/panel/InspectorPanel.jsx';
import SectionImpl from './explorer/panel/Section.jsx';
import { PropertyList as PropertyListImpl } from './explorer/DetailsPanel.jsx';
import { I18nProvider as I18nProviderImpl, MESSAGES as MESSAGES_IMPL, useI18n as useI18nImpl } from './explorer/i18n.jsx';
import { DEFAULT_RENDER_SETTINGS as DEFAULT_RENDER_SETTINGS_IMPL } from './explorer/settings.js';
import { EMPTY_HIDDEN as EMPTY_HIDDEN_IMPL, useHypergraphExplorer as useHypergraphExplorerImpl } from './explorer/useHypergraphExplorer.js';

type ID = string;

export type { HypergraphSource, LocalHypergraphData, SourceOverview, VertexListPage, VertexListQuery } from './source';
export { createLocalSource, fromHIF, loadHIFFromFile, loadHIFFromURL, parseHIF } from './source';
export type Locale = 'en' | 'zh';
/** 界面文字：语言 → 键 → 文字，可带 {n} 占位 / UI messages by locale and key */
export type Messages = Partial<Record<Locale, Record<string, string>>>;

export interface ExplorerOptions {
  /** 数据源，换一个对象即重新载入 / data source; pass a new object to reload */
  source?: HypergraphSource;
  /** 没有 source 时显示的超图（没有左栏）/ hypergraph shown when there is no source (no left panel) */
  data?: HypergraphData;
  /** 没有 source 时的中心实体 / center vertex when there is no source */
  centerNode?: ID;
  /** 载入数据源后默认显示的中心实体 / center shown after the source loads */
  defaultCenter?: ID;
  /** 打开子图时默认彻底隐藏的实体类型 / vertex types hidden when a subgraph opens */
  hiddenTypes?: string[];
  /** 「渲染」设置的默认值，覆盖 DEFAULT_RENDER_SETTINGS 中的项，如 { autoHideDegree: 0 } 不自动隐藏高度数实体 /
   *  overrides of DEFAULT_RENDER_SETTINGS, e.g. { autoHideDegree: 0 } to keep high-degree vertices */
  defaultRenderSettings?: Record<string, unknown>;
  /** 渲染设置、颜色存到 localStorage 的键前缀，默认 'hypergraph-viewer'；false 不存 / localStorage key prefix, false to disable */
  storageKey?: string | false;
  /** 实体列表每页条数，默认 50 / vertex list page size */
  pageSize?: number;
  onCenterChange?: (center: ID) => void;
  onSelectionChange?: (selection: Selection) => void;
}

export interface HypergraphExplorerProps extends ExplorerOptions {
  /** 面板开关：database 左栏（需 source），inspector 右栏，header 标题栏；默认都开 / toggle panels, all on by default */
  panels?: { database?: boolean; inspector?: boolean; header?: boolean };
  /**
   * 界面语言；不传时由浏览器自己管理：初始为 localeStorageKey 记住的或浏览器语言，标题栏显示语言切换 /
   * UI language; when omitted the explorer manages it (remembered under localeStorageKey, else the browser's) and shows the switch
   */
  locale?: Locale;
  /** 传了 locale 时，传了它标题栏才显示语言切换；不传 locale 时为切换后的通知 / language switch callback */
  onLocaleChange?: (locale: Locale) => void;
  /** 不传 locale 时记住语言的 localStorage 键 / localStorage key remembering the language when locale is omitted */
  localeStorageKey?: string;
  messages?: Messages;
  /** 左栏顶部标题 / left panel title */
  title?: ReactNode;
  /** 左栏统计卡片之前的插槽（如数据源选择，可用 Section 包成同样的卡片）/ slot above the left panel stats */
  databaseHeader?: ReactNode;
  /** 标题栏右侧的插槽 / slot on the right of the header */
  headerExtra?: ReactNode;
  /** 宿主正在载入数据源 / the host is loading the source */
  loading?: boolean;
  className?: string;
  style?: CSSProperties;
}

export interface HypergraphExplorerHandle {
  readonly graph: Graph | undefined;
  hover(target: Partial<Selection> | null): void;
  select(id: ID | null): void;
  fitView(animate?: boolean): Promise<void>;
}

/**
 * <zh/> 超图浏览器：左栏、画布、右栏，面板用 panels 开关；样式需引入 hypergraph-viz/style.css
 *
 * <en/> Hypergraph explorer with database / inspector panels toggled by `panels`; import hypergraph-viz/style.css
 */
export const HypergraphExplorer = ExplorerImpl as ForwardRefExoticComponent<HypergraphExplorerProps & RefAttributes<HypergraphExplorerHandle>>;

/** HypergraphExplorer 的全部状态，返回 databaseProps / canvasProps / inspectorProps 交给对应面板，自行排布时用 */
export const useHypergraphExplorer = useHypergraphExplorerImpl as (options: ExplorerOptions) => {
  hypergraph: HypergraphData | null;
  visibleHypergraph: HypergraphData | null;
  centerNode: ID;
  mode: 'hyper' | 'graph';
  setMode: (mode: 'hyper' | 'graph') => void;
  loading: boolean;
  error: string;
  selection: Selection;
  setSelection: (selection: Selection | ((prev: Selection) => Selection)) => void;
  hidden: { nodes: ID[]; hyperedges: ID[]; faded: ID[] };
  setHidden: (hidden: { nodes: ID[]; hyperedges: ID[]; faded?: ID[] }) => void;
  databaseProps: Record<string, unknown>;
  canvasProps: Record<string, unknown>;
  inspectorProps: Record<string, unknown>;
  [key: string]: unknown;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
/** 左栏：数据源统计、实体列表、超边列表；props 为 useHypergraphExplorer().databaseProps 加 title / header */
export const DatabasePanel = DatabasePanelImpl as ComponentType<any>;
/** 画布：悬停卡片、工具栏、已隐藏标签条；props 为 useHypergraphExplorer().canvasProps */
export const GraphCanvas = GraphCanvasImpl as ComponentType<any>;
/** 右栏：子图统计、实体与超边表、渲染设置、详情；props 为 useHypergraphExplorer().inspectorProps */
export const InspectorPanel = InspectorPanelImpl as ComponentType<any>;
/** 可收起的卡片，与面板中的卡片同样式 / collapsible card styled like the panel cards */
export const Section = SectionImpl as ComponentType<{
  title: ReactNode;
  count?: ReactNode;
  subtitle?: ReactNode;
  open: boolean;
  onToggle: () => void;
  grow?: boolean;
  children?: ReactNode;
}>;
/** 属性列表（详情区、悬停卡片共用）/ property list used by the details area and hover card */
export const PropertyList = PropertyListImpl as ComponentType<{ item: Record<string, unknown>; priority?: string[]; exclude?: string[]; limit?: number }>;
export const I18nProvider = I18nProviderImpl as ComponentType<{ locale?: Locale; messages?: Messages; setLang?: (l: Locale) => void; children?: ReactNode }>;
/** 面板内的文字；宿主放进插槽的组件也可用它取 messages 中的文字 / UI text, also for host components inside slots */
export const useI18n = useI18nImpl as () => { lang: Locale; setLang?: (l: Locale) => void; t: (key: string, vars?: Record<string, unknown>) => string };
export const MESSAGES = MESSAGES_IMPL as Record<Locale, Record<string, string>>;
export const DEFAULT_RENDER_SETTINGS = DEFAULT_RENDER_SETTINGS_IMPL as Record<string, unknown>;
export const EMPTY_HIDDEN = EMPTY_HIDDEN_IMPL as { nodes: ID[]; hyperedges: ID[]; faded: ID[] };
