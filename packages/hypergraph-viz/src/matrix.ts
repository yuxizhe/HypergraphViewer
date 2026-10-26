import type { ID } from '@antv/g6';
import { hyperedgeIdOf } from './analysis';
import type { HyperedgeItem, HypergraphData } from './spec';

/**
 * <zh/> 关联矩阵的行列排序：
 * - 'degree'：行按度数降序（中心在最上），列按成员所在行字典序（阶梯状）；
 * - 'type'：行按实体类型分组（类型按实体数降序），组内按度数；列按超边 type 分组，组内阶梯状；
 * - 'cluster'：重心法交替排序行、列，相互关联的实体与超边聚到一起
 *
 * <en/> Row and column order of the incidence matrix: by degree (center first, columns as a staircase), grouped by
 * vertex / hyperedge type, or clustered by the barycenter heuristic
 */
export type MatrixOrder = 'degree' | 'type' | 'cluster';

export interface MatrixColumn {
  id: ID;
  /** 成员所在行号，升序 / row indices of the members, ascending */
  rows: number[];
  item: HyperedgeItem & { id: ID };
}

export interface IncidenceMatrix {
  /** 行：实体 id，按 order 排序 / rows: vertex ids in order */
  rows: ID[];
  columns: MatrixColumn[];
  /** 实体 id → 所属超边数 / vertex id → number of hyperedges containing it */
  degree: Map<ID, number>;
  /** 'type' 排序时每组的起始行号与类型 / start row and type of each group when ordered by type */
  rowGroups: { start: number; type: string | null }[];
  /** 'type' 排序时每组的起始列号与超边 type / start column and hyperedge type of each group when ordered by type */
  columnGroups: { start: number; type: string | null }[];
}

export interface MatrixOptions {
  order?: MatrixOrder;
  /** 顶点上表示类型的字段 / vertex field holding its type */
  typeField?: string;
  /** 放在最上面一行的实体 / vertex put in the first row */
  centerNode?: ID;
  /** 重心法迭代次数，默认 12 / barycenter iterations, defaults to 12 */
  iterations?: number;
}

// 按成员所在行字典序比较两列（阶梯状），成员多的在前
const staircase = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return b.length - a.length;
};

// 按出现次数降序给分组键排名，无类型（null）排最后
const groupRank = (keys: (string | null)[]) => {
  const count = new Map<string | null, number>();
  keys.forEach((k) => count.set(k, (count.get(k) || 0) + 1));
  const ranked = [...count.keys()].sort((a, b) =>
    a === null ? 1 : b === null ? -1 : count.get(b)! - count.get(a)! || String(a).localeCompare(String(b)),
  );
  return new Map(ranked.map((k, i) => [k, i]));
};

// 相邻元素分组键不同处为组的起点
const groupsOf = (keys: (string | null)[]) =>
  keys.flatMap((type, i) => (i === 0 || keys[i - 1] !== type ? [{ start: i, type }] : []));

/**
 * <zh/> 超图的关联矩阵：一行一个实体，一列一条超边（含 2 元超边），按 order 排序。
 * 超边去重、成员去重并只保留存在的实体，剩不足 2 个成员的超边不列出
 *
 * <en/> Incidence matrix of a hypergraph: one row per vertex, one column per hyperedge (2-member ones included), ordered by `order`.
 * Duplicate hyperedges and members are dropped, as are hyperedges left with fewer than 2 existing members
 */
export const incidenceMatrix = (data: HypergraphData, options: MatrixOptions = {}): IncidenceMatrix => {
  const { order = 'degree', typeField = 'entity_type', centerNode, iterations = 12 } = options;
  const ids = Object.keys(data.vertices);
  const degree = new Map<ID, number>(ids.map((id) => [id, 0]));
  const edges: (HyperedgeItem & { id: ID })[] = [];
  const seen = new Set<ID>();
  data.hyperedges.forEach((he) => {
    const id = hyperedgeIdOf(he);
    const members = [...new Set(he.members)].filter((m) => degree.has(m));
    if (members.length < 2 || seen.has(id)) return;
    seen.add(id);
    edges.push({ ...he, id, members });
    members.forEach((m) => degree.set(m, degree.get(m)! + 1));
  });

  const typeOf = (id: ID): string | null => data.vertices[id]?.[typeField] || null;
  const edgeTypeOf = (he: HyperedgeItem): string | null => (he.type ? String(he.type) : null);
  const byDegree = (a: ID, b: ID) =>
    Number(b === centerNode) - Number(a === centerNode) || degree.get(b)! - degree.get(a)! || String(a).localeCompare(String(b));

  let rows = [...ids];
  if (order === 'type') {
    const rank = groupRank(ids.map(typeOf));
    rows.sort((a, b) => rank.get(typeOf(a))! - rank.get(typeOf(b))! || byDegree(a, b));
  } else {
    rows.sort(byDegree);
  }

  const rowsOf = (rowIndex: Map<ID, number>) => (he: HyperedgeItem) => he.members.map((m) => rowIndex.get(m)!).sort((a, b) => a - b);
  let rowIndex = new Map(rows.map((id, i) => [id, i]));
  let cols = edges.map((item) => ({ id: item.id, rows: rowsOf(rowIndex)(item), item }));

  if (order === 'cluster' && cols.length) {
    // 重心法：列按成员行号均值排序，行按所在列号均值排序（没有超边的实体放最后），交替迭代
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    for (let it = 0; it < iterations; it++) {
      cols.sort((a, b) => mean(a.rows) - mean(b.rows) || staircase(a.rows, b.rows));
      const colsOfRow = new Map<ID, number[]>();
      cols.forEach((c, j) => c.item.members.forEach((m) => colsOfRow.set(m, [...(colsOfRow.get(m) || []), j])));
      const key = (id: ID) => (colsOfRow.has(id) ? mean(colsOfRow.get(id)!) : Infinity);
      const next = [...rows].sort((a, b) => key(a) - key(b) || byDegree(a, b));
      const changed = next.some((id, i) => id !== rows[i]);
      rows = next;
      rowIndex = new Map(rows.map((id, i) => [id, i]));
      cols = cols.map((c) => ({ ...c, rows: rowsOf(rowIndex)(c.item) }));
      if (!changed) break;
    }
    cols.sort((a, b) => mean(a.rows) - mean(b.rows) || staircase(a.rows, b.rows));
  } else if (order === 'type') {
    const rank = groupRank(cols.map((c) => edgeTypeOf(c.item)));
    cols.sort((a, b) => rank.get(edgeTypeOf(a.item))! - rank.get(edgeTypeOf(b.item))! || staircase(a.rows, b.rows));
  } else {
    cols.sort((a, b) => staircase(a.rows, b.rows));
  }

  return {
    rows,
    columns: cols,
    degree,
    rowGroups: order === 'type' ? groupsOf(rows.map(typeOf)) : [],
    columnGroups: order === 'type' ? groupsOf(cols.map((c) => edgeTypeOf(c.item))) : [],
  };
};
