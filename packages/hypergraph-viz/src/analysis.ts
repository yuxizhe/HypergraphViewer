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

/**
 * <zh/> 注定重叠的结构数（Qu et al. TVCG 2022 / HGPolyVis 的可无重叠绘制判定中的两种禁止结构）：
 * 共享 ≥3 个成员的超边对、共同成员 ≥2 个的超边三元组。它们无论怎么布局都会重叠（轮廓、多边形皆然）
 *
 * <en/> Forced overlaps, two of the forbidden configurations of the overlap-free drawability criterion (Qu et al. TVCG 2022 /
 * HGPolyVis): hyperedge pairs sharing ≥3 members and hyperedge triples with ≥2 common members. They overlap under any layout
 */
export interface ForcedOverlaps {
  /** 共享 ≥3 个成员的超边对 / hyperedge pairs sharing 3+ members */
  pairs: number;
  /** 共同成员 ≥2 个的超边三元组 / hyperedge triples with 2+ common members */
  triples: number;
}

// 成员列表（去重、至少 2 个）→ 注定重叠数；cap 为三元组计数上限，超过即停（贪心选择时只需比较大小）
const countForcedOverlaps = (sets: ID[][], cap = Infinity): ForcedOverlaps => {
  const edgesOf = new Map<ID, number[]>();
  sets.forEach((set, e) => set.forEach((v) => edgesOf.set(v, [...(edgesOf.get(v) || []), e])));
  // 超边两两共享的成员 / members shared by each pair of hyperedges
  const shared = new Map<number, ID[]>();
  const E = sets.length;
  edgesOf.forEach((list, v) => {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const key = list[i] * E + list[j];
        const s = shared.get(key);
        if (s) s.push(v);
        else shared.set(key, [v]);
      }
    }
  });
  let pairs = 0;
  let triples = 0;
  const hits = new Map<number, number>();
  for (const [key, common] of shared) {
    if (common.length >= 3) pairs++;
    if (common.length < 2 || triples >= cap) continue;
    // 第三条超边 c > b 含其中 ≥2 个共同成员 / a third hyperedge c > b holding 2+ of the common members
    const b = key % E;
    hits.clear();
    common.forEach((v) => edgesOf.get(v)!.forEach((c) => c > b && hits.set(c, (hits.get(c) || 0) + 1)));
    hits.forEach((n) => n >= 2 && triples++);
  }
  return { pairs, triples };
};

const memberSets = (data: HypergraphData, hidden: Set<ID> = new Set()) => {
  const sets: ID[][] = [];
  data.hyperedges.forEach((he) => {
    const m = [...new Set(he.members)].filter((id) => id in data.vertices && !hidden.has(id));
    if (m.length >= 2) sets.push(m);
  });
  return sets;
};

/**
 * <zh/> 统计超图中注定重叠的结构
 *
 * <en/> Count the forced overlaps of a hypergraph
 */
export const forcedOverlaps = (data: HypergraphData): ForcedOverlaps => countForcedOverlaps(memberSets(data));

/**
 * <zh/> 贪心挑出隐含枢纽：每轮在度数最高的若干实体中，去掉后注定重叠（对 + 三元组）减少最多的那个，
 * 直到注定重叠不超过超边数的 tolerance（零星几处不值得为此隐藏实体）、减少量不足最初的 minGain，或已挑出 maxHubs 个。比按度数阈值隐藏更有针对性：只去掉真正造成重叠的实体
 *
 * <en/> Greedily pick implicit hubs: each round, among the highest-degree vertices, the one whose removal cuts forced overlaps
 * (pairs + triples) the most, until they are within tolerance of the hyperedge count (a few are not worth hiding a vertex),
 * the cut falls below minGain of the initial count, or maxHubs are picked. Unlike a degree
 * threshold, only vertices that actually cause overlaps are removed
 */
export const overlapHubs = (
  data: HypergraphData,
  {
    maxHubs = 8,
    minGain = 0.05,
    tolerance = 0.1,
    candidates = 12,
  }: { maxHubs?: number; minGain?: number; tolerance?: number; candidates?: number } = {},
): { hubs: ID[]; before: ForcedOverlaps; after: ForcedOverlaps } => {
  const hidden = new Set<ID>();
  const total = (o: ForcedOverlaps) => o.pairs + o.triples;
  const initialSets = memberSets(data);
  const before = countForcedOverlaps(initialSets);
  let current = before;
  const threshold = Math.max(1, minGain * total(before));
  const allowed = tolerance * initialSets.length;
  while (hidden.size < maxHubs && total(current) > allowed) {
    const sets = memberSets(data, hidden);
    const degree = new Map<ID, number>();
    sets.forEach((set) => set.forEach((v) => degree.set(v, (degree.get(v) || 0) + 1)));
    const pool = [...degree]
      .filter(([, d]) => d >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, candidates)
      .map(([id]) => id);
    // 同样有效时取度数高的（pool 按度数降序）/ ties go to the higher degree (pool is by degree, descending)
    let bestId: ID | null = null;
    let bestTotal = Infinity;
    for (const id of pool) {
      hidden.add(id);
      const overlaps = total(countForcedOverlaps(memberSets(data, hidden), bestTotal));
      hidden.delete(id);
      if (overlaps < bestTotal) {
        bestId = id;
        bestTotal = overlaps;
      }
    }
    if (bestId === null || total(current) - bestTotal < threshold) break;
    hidden.add(bestId);
    // 带上限的计数只用于比较，选定后重算准确值 / capped counts are for comparison only; recount exactly
    current = countForcedOverlaps(memberSets(data, hidden));
  }
  return { hubs: [...hidden], before, after: current };
};
