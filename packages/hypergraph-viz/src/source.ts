import type { HypergraphData, HyperedgeItem } from './spec';
import { createLocalSource as createLocalSourceImpl } from './explorer/localSource.js';
import {
  fromHIF as fromHIFImpl,
  loadHIFFromFile as loadHIFFromFileImpl,
  loadHIFFromURL as loadHIFFromURLImpl,
  parseHIF as parseHIFImpl,
} from './explorer/hif.js';

type ID = string;

/**
 * <zh/> 内部格式：fromHIF / parseHIF 的结果，createLocalSource 的输入。graphs 为每个可作为中心的实体的子图（超边 key 为 |#| 拼接的成员）
 *
 * <en/> Internal format produced by fromHIF / parseHIF: a subgraph per center vertex, hyperedge keys joined by |#|
 */
export interface LocalHypergraphData {
  database: { name: string; vertices: number; edges: number };
  vertices: Array<{ id: ID; entity_type?: string; description?: string; [key: string]: unknown }>;
  graphs: Record<ID, { vertices: Record<ID, Record<string, unknown>>; edges: Record<string, Record<string, unknown>> }>;
}

export interface VertexListQuery {
  page: number;
  pageSize: number;
  search: string;
  sortBy: 'degree' | 'id';
  sortOrder: 'asc' | 'desc';
  /** 实体类型筛选，null 为未分类 / entity type filter, null for untyped */
  types: Array<string | null>;
}

export interface VertexListPage {
  /** degree：列表中显示的邻域大小（子图实体数）/ neighborhood size shown in the list */
  data: Array<{ id: ID; entity_type?: string; description?: string; degree?: number; [key: string]: unknown }>;
  pagination: { page: number; page_size: number; total: number; total_pages: number };
}

export interface SourceOverview {
  database: { name: string; vertices: number; edges: number };
  /** 已载入的实体与超边，给了才在左栏显示统计 / loaded vertices and hyperedges; the left-panel stats need them */
  vertices?: HypergraphData['vertices'];
  hyperedges?: Array<HyperedgeItem & { id: ID; members: ID[] }>;
  /** 实体列表的类型筛选 / type chips of the vertex list */
  listedTypes?: Array<{ type: string | null; count: number }>;
  /** 可作为中心的实体 → 子图大小；不给时任何实体都可作为中心 / vertices that can be centers, all when omitted */
  centers?: Map<ID, number>;
}

/**
 * <zh/> HypergraphExplorer 的数据源：左栏统计、实体列表、超边列表与子图都从这里读取。HTTP 后端实现同样的接口即可接入
 *
 * <en/> Data source of HypergraphExplorer; HTTP backends implement the same interface
 */
export interface HypergraphSource {
  overview(): Promise<SourceOverview>;
  listVertices(query: VertexListQuery): Promise<VertexListPage>;
  /** 不实现时左栏没有超边列表 / the left panel has no hyperedge list without it */
  listHyperedges?(query: { search: string }): Promise<Array<HyperedgeItem & { id: ID; members: ID[] }>>;
  subgraph(center: ID): Promise<HypergraphData>;
}

/** 内存中的数据源 / in-memory source over the internal format */
export const createLocalSource: (data: LocalHypergraphData) => HypergraphSource = createLocalSourceImpl;
/** 已解析的 HIF（或其他超图 JSON）→ 内部格式 / parsed HIF (or other hypergraph JSON) → internal format */
export const fromHIF: (data: unknown) => LocalHypergraphData = fromHIFImpl;
/** HIF 文本 → 内部格式 / HIF text → internal format */
export const parseHIF: (content: string, filename?: string) => Promise<LocalHypergraphData> = parseHIFImpl;
/** 下载并解析 HIF / JSON 或 Hypergraph-DB 的 .hgdb 文件 / fetch and parse a HIF / JSON or Hypergraph-DB .hgdb file */
export const loadHIFFromURL: (url: string) => Promise<LocalHypergraphData> = loadHIFFromURLImpl;
export const loadHIFFromFile: (file: File) => Promise<LocalHypergraphData> = loadHIFFromFileImpl;
