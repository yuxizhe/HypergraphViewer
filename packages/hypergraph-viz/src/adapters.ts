import type { HyperedgeItem, HypergraphData } from './spec';

/** Hyper-RAG / Hypergraph-DB 超边 key 中成员的分隔符 / member separator in Hyper-RAG / Hypergraph-DB hyperedge keys */
export const EDGE_SEPARATOR = '|#|';

/**
 * <zh/> 从 `{ vertices, edges }` 转换，edges 的 key 为用分隔符拼接的成员（Hyper-RAG、Hypergraph-DB 的 API 格式）
 *
 * <en/> Convert from `{ vertices, edges }` whose edge keys are members joined by a separator (the Hyper-RAG / Hypergraph-DB API format)
 */
export const fromKeyedEdges = (
  graph: { vertices: Record<string, Record<string, any>>; edges: Record<string, Record<string, any>> },
  separator = EDGE_SEPARATOR,
): HypergraphData => ({
  vertices: graph.vertices,
  hyperedges: Object.entries(graph.edges).map(
    ([key, edge]): HyperedgeItem => ({ ...edge, id: key, members: key.split(separator) }),
  ),
});
