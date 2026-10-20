import type { ComponentType, CSSProperties, ReactNode } from 'react';
import type { HypergraphData } from './spec';
import AdminImpl from './admin/HypergraphAdmin.jsx';
import { ADMIN_MESSAGES as ADMIN_MESSAGES_IMPL } from './admin/context.jsx';
import { createHttpAdminApi as createHttpAdminApiImpl } from './admin/httpApi.js';
import type { Locale } from './explorer';

/** 实体 id：字符串或数字（其他类型由后端转为字符串）/ vertex id */
export type AdminVertexId = string | number;

export interface AdminPagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface AdminInfo {
  num_v: number;
  num_e: number;
  /** 以下为存储状态，有 save 的后端才需要 / storage state, only for back ends with save */
  storage_file?: string;
  file_exists?: boolean;
  file_size?: number | null;
  dirty?: boolean;
  last_saved?: number | null;
  /** 显示名：{语言: {entity_type | edge_type | key: {原值: 显示名}}} / display labels */
  labels?: Record<string, Record<string, Record<string, string>>>;
}

export interface AdminStats {
  num_v: number;
  num_e: number;
  avg_degree: number;
  max_degree: number;
  avg_edge_size: number;
  max_edge_size: number;
  isolated_v: number;
  /** [值, 个数] / [value, count] */
  degree_hist: [number, number][];
  edge_size_hist: [number, number][];
  entity_types: [string, number][];
  edge_types: [string, number][];
  vertex_keys: [string, number][];
  edge_keys: [string, number][];
}

export interface AdminListQuery {
  page?: number;
  page_size?: number;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  /** 实体列表按实体类型筛选 / vertex list filter */
  entity_type?: string;
  /** 超边列表按超边类型筛选 / hyperedge list filter */
  edge_type?: string;
}

/**
 * <zh/> 管理后台的数据接口。save、exportHIF、importHIF、subgraph 可省略，省略时界面不显示对应功能
 * （没有 save 时每次修改即生效，不显示保存与未保存状态；有 subgraph 时实体详情中显示关系图）
 *
 * <en/> Data access for the admin console; optional methods hide the matching features
 */
export interface HypergraphAdminApi {
  info(): Promise<AdminInfo>;
  stats(): Promise<AdminStats>;
  listVertices(query: AdminListQuery): Promise<{
    data: { id: AdminVertexId; degree: number; entity_type: string; preview: string }[];
    pagination: AdminPagination;
  }>;
  listEdges(query: AdminListQuery): Promise<{
    data: { vertices: AdminVertexId[]; size: number; preview: string }[];
    pagination: AdminPagination;
  }>;
  getVertex(id: AdminVertexId): Promise<{
    id: AdminVertexId;
    data: Record<string, unknown>;
    degree: number;
    neighbors: number;
    edges: { vertices: AdminVertexId[] }[];
    edges_truncated?: boolean;
  }>;
  getEdge(vertices: AdminVertexId[]): Promise<{ vertices: { id: AdminVertexId; degree: number }[]; data: Record<string, unknown> }>;
  /** create：新建（已存在时报错）；replace：整体替换属性（否则合并）/ create or update */
  upsertVertex(body: { id: AdminVertexId; data: Record<string, unknown>; create?: boolean; replace?: boolean }): Promise<{ id: AdminVertexId }>;
  deleteVertex(id: AdminVertexId): Promise<unknown>;
  upsertEdge(body: {
    vertices: AdminVertexId[];
    data: Record<string, unknown>;
    create?: boolean;
    replace?: boolean;
  }): Promise<{ vertices: { id: AdminVertexId }[] }>;
  deleteEdge(vertices: AdminVertexId[]): Promise<unknown>;
  save?(): Promise<AdminInfo>;
  exportHIF?(): Promise<unknown>;
  importHIF?(hif: unknown): Promise<{ num_v: number; num_e: number }>;
  /** 以该实体为中心的子图 / subgraph centered on the vertex, for the relation graph */
  subgraph?(id: AdminVertexId): Promise<HypergraphData>;
}

export interface HypergraphAdminProps {
  api: HypergraphAdminApi;
  /** 左上角标题，默认 'Hypergraph DB' / sidebar title */
  title?: ReactNode;
  /** 超图查看器页面：有它时多一个「超图可视化」页（iframe），实体详情中有打开查看器的链接（加 ?vertex=）/ viewer page URL */
  viewerUrl?: string;
  /** 顶栏右侧的插槽（如数据库选择）/ slot on the right of the header */
  headerExtra?: ReactNode;
  /** 当前页记在网址的 # 后（独立页面用；宿主自己用 hash 路由时不要开）/ keep the current page in location.hash */
  hashRouting?: boolean;
  /** 界面语言；不传时由管理后台自己管理（localeStorageKey 记住）并显示语言切换 / UI language */
  locale?: Locale;
  onLocaleChange?: (locale: Locale) => void;
  localeStorageKey?: string;
  /** 覆盖或补充界面文字 / override UI messages */
  messages?: Partial<Record<Locale, Record<string, string>>>;
  className?: string;
  style?: CSSProperties;
}

/**
 * <zh/> 超图数据库管理后台：概览、实体与超边的增删改查、导入 / 导出。样式需引入 hypergraph-viz/style.css
 *
 * <en/> Hypergraph database admin console; import hypergraph-viz/style.css
 */
export const HypergraphAdmin = AdminImpl as ComponentType<HypergraphAdminProps>;

/**
 * <zh/> 按 Hypergraph-DB 管理后台的 HTTP 格式读写（默认 /api/admin）；params 附加到每个请求的网址上（如 { database }）。
 * 后端不支持的功能从返回的对象中去掉即可，如 const { save, ...api } = createHttpAdminApi(url)
 *
 * <en/> Admin API over Hypergraph-DB's admin HTTP endpoints; drop methods the back end does not support
 */
export const createHttpAdminApi = createHttpAdminApiImpl as (
  baseUrl?: string,
  options?: { params?: Record<string, string | number> },
) => Required<Omit<HypergraphAdminApi, 'subgraph'>>;

export const ADMIN_MESSAGES = ADMIN_MESSAGES_IMPL as Record<Locale, Record<string, unknown>>;
