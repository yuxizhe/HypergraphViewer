import type { ID } from '@antv/g6';
import type { HyperedgeItem, HypergraphData } from './spec';
import { DEFAULT_THEME } from './theme';

const PAIR_SEP = '|#|';

/**
 * <zh/> 超边 id：有 id 用 id，否则 2 元超边为两端按字典序拼接，3 元及以上为成员按原顺序拼接（与 toG6Spec 一致）
 *
 * <en/> Hyperedge id: its own id, else the sorted pair for 2 members, else members joined in order (same as toG6Spec)
 */
export const hyperedgeIdOf = (he: HyperedgeItem): ID => {
  if (he.id !== undefined) return he.id;
  const members = [...new Set(he.members)];
  if (members.length === 2) {
    const [a, b] = members;
    return a < b ? `${a}${PAIR_SEP}${b}` : `${b}${PAIR_SEP}${a}`;
  }
  return members.join(PAIR_SEP);
};

/**
 * <zh/> 按超边在完整数据中的顺序循环取色，得到 id → 颜色。隐藏部分超边后仍传入这份映射，其余超边颜色不变
 *
 * <en/> Colors by order in the full data, as id → color. Keep passing it after hiding hyperedges so the rest keep their colors
 */
export const hyperedgeColorsOf = (data: HypergraphData, palette = DEFAULT_THEME.hyperedgeColors): Record<ID, string> => {
  const colors: Record<ID, string> = {};
  data.hyperedges.forEach((he, i) => {
    const id = hyperedgeIdOf(he);
    if (!(id in colors)) colors[id] = palette[i % palette.length];
  });
  return colors;
};

export interface HypergraphStats {
  vertexCount: number;
  /** 3 个及以上成员的超边数 / hyperedges with 3+ members */
  hyperedgeCount: number;
  /** 2 个成员的超边数（画成连线）/ 2-member hyperedges, drawn as lines */
  lineCount: number;
  maxSize: number;
  avgDegree: number;
  /** 实体 id → 所属超边数 / vertex id → number of hyperedges containing it */
  degree: Map<ID, number>;
  /** 超边 id → 成员（去重、只含存在的实体，至少 2 个）/ hyperedge id → members (deduped, existing, at least 2) */
  members: Map<ID, ID[]>;
  /** 超边大小 → 条数 / hyperedge size → count */
  sizes: Map<number, number>;
  /** 实体类型及数量，降序；无类型记为 null / vertex types with counts, descending; untyped as null */
  types: { type: string | null; count: number }[];
  /** 连通分量大小，降序 / connected component sizes, descending */
  components: number[];
  /** 出现在 ≥ hubRatio 超边中的实体，按度数降序 / vertices in at least hubRatio of the hyperedges, by degree */
  hubs: ID[];
}

/**
 * <zh/> 超图统计：度数、超边大小分布、类型构成、连通分量、枢纽实体。
 * 枢纽：所在超边数 ≥ hubRatio × 超边总数（含 2 元），且超边总数 ≥ hubMinEdges
 *
 * <en/> Hypergraph statistics. A hub is in at least hubRatio of all hyperedges (2-member included), when there are at least hubMinEdges
 */
export const hypergraphStats = (
  data: HypergraphData,
  { typeField = 'entity_type', hubRatio = 0.5, hubMinEdges = 6 } = {},
): HypergraphStats => {
  const ids = Object.keys(data.vertices);
  const degree = new Map<ID, number>(ids.map((id) => [id, 0]));
  const members = new Map<ID, ID[]>();
  const sizes = new Map<number, number>();
  const parent = new Map<ID, ID>(ids.map((id) => [id, id]));
  const find = (x: ID): ID => {
    while (parent.get(x) !== x) {
      const p = parent.get(parent.get(x)!)!;
      parent.set(x, p);
      x = p;
    }
    return x;
  };

  data.hyperedges.forEach((he) => {
    const m = [...new Set(he.members)].filter((id) => degree.has(id));
    const id = hyperedgeIdOf(he);
    if (m.length < 2 || members.has(id)) return;
    members.set(id, m);
    sizes.set(m.length, (sizes.get(m.length) || 0) + 1);
    m.forEach((v) => degree.set(v, degree.get(v)! + 1));
    m.slice(1).forEach((v) => parent.set(find(v), find(m[0])));
  });

  const typeCount = new Map<string | null, number>();
  ids.forEach((id) => {
    const type = data.vertices[id]?.[typeField] || null;
    typeCount.set(type, (typeCount.get(type) || 0) + 1);
  });
  const componentSize = new Map<ID, number>();
  ids.forEach((id) => componentSize.set(find(id), (componentSize.get(find(id)) || 0) + 1));

  const total = members.size;
  const lineCount = sizes.get(2) || 0;
  const degreeSum = [...degree.values()].reduce((a, b) => a + b, 0);
  return {
    vertexCount: ids.length,
    hyperedgeCount: total - lineCount,
    lineCount,
    maxSize: Math.max(0, ...sizes.keys()),
    avgDegree: ids.length ? degreeSum / ids.length : 0,
    degree,
    members,
    sizes,
    types: [...typeCount].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    components: [...componentSize.values()].sort((a, b) => b - a),
    hubs:
      total >= hubMinEdges
        ? ids.filter((id) => degree.get(id)! >= hubRatio * total).sort((a, b) => degree.get(b)! - degree.get(a)!)
        : [],
  };
};

/**
 * <zh/> 去掉隐藏的实体与超边：超边删去隐藏成员，剩不足 2 个成员的超边一并去掉。
 * 保留下来的超边写明原 id，成员减少后 id 不变（选择、颜色按 id 对应）
 *
 * <en/> Drop hidden vertices and hyperedges; hidden members are removed from hyperedges, which are dropped below 2 members.
 * Kept hyperedges carry their original id, so selection and colors still match after members are removed
 */
export const filterHypergraph = (
  data: HypergraphData,
  hidden: { nodes?: Iterable<ID>; hyperedges?: Iterable<ID> } = {},
): HypergraphData => {
  const hiddenNodes = new Set(hidden.nodes);
  const hiddenHyperedges = new Set(hidden.hyperedges);
  if (!hiddenNodes.size && !hiddenHyperedges.size) return data;
  const vertices: HypergraphData['vertices'] = {};
  Object.entries(data.vertices).forEach(([id, v]) => {
    if (!hiddenNodes.has(id)) vertices[id] = v;
  });
  const hyperedges: HyperedgeItem[] = [];
  data.hyperedges.forEach((he) => {
    const id = hyperedgeIdOf(he);
    if (hiddenHyperedges.has(id)) return;
    const members = he.members.filter((m) => !hiddenNodes.has(m));
    if (new Set(members).size >= 2) hyperedges.push({ ...he, id, members });
  });
  return { vertices, hyperedges };
};
