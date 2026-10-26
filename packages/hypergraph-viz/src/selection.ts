import type { ID } from '@antv/g6';
import type { HypergraphSpec } from './spec';

/**
 * <zh/> 选中的实体与超边（超边 id，2 元超边也用超边 id 而不是连线 id）
 *
 * <en/> Selected vertices and hyperedges (hyperedge ids, also for 2-member ones rather than line ids)
 */
export interface Selection {
  nodes: ID[];
  hyperedges: ID[];
}

export const EMPTY_SELECTION: Selection = Object.freeze({ nodes: [], hyperedges: [] }) as Selection;

export const isEmptySelection = (s?: Partial<Selection> | null) => !s?.nodes?.length && !s?.hyperedges?.length;

export type BubbleLevel = 'normal' | 'highlight' | 'dimmed';

export interface SelectionStyles {
  /** 元素 id → 状态（节点与连线）/ element id → states, for nodes and lines */
  states: Record<ID, string[]>;
  /** 超边 id → 轮廓样式档位 / hyperedge id → contour level */
  bubbles: Record<ID, BubbleLevel>;
}

/**
 * <zh/> 由选择与悬停计算各元素状态：
 * - 选中的实体、选中超边的成员：highlight；
 * - 含有选中实体的其他超边保持常态，它们的成员也保持常态；
 * - 其余实体、连线 inactive，轮廓 dimmed；没有选择时全部常态；
 * - 悬停（表格行）的实体及悬停超边的成员、连线追加 active，悬停超边的轮廓 highlight。
 *
 * <en/> States from selection and hover: selected vertices and members of selected hyperedges are highlighted;
 * other hyperedges containing a selected vertex stay normal with their members; everything else is inactive / dimmed.
 * Hovered vertices, members and lines of hovered hyperedges get 'active', hovered contours are highlighted
 */
export const selectionStyles = (
  spec: Pick<HypergraphSpec, 'data' | 'hyperedges' | 'lineHyperedges'> & Partial<Pick<HypergraphSpec, 'hyperedgeNodes'>>,
  selection: Partial<Selection> = EMPTY_SELECTION,
  hover?: Partial<Selection> | null,
): SelectionStyles => {
  const exists = (id: ID) => spec.hyperedges.has(id);
  const nodeIds = new Set(spec.data.nodes!.map((n) => n.id));
  const selNodes = new Set((selection.nodes || []).filter((id) => nodeIds.has(id)));
  const selEdges = new Set((selection.hyperedges || []).filter(exists));
  const active = !!(selNodes.size || selEdges.size);

  const highlightNodes = new Set(selNodes);
  selEdges.forEach((id) => spec.hyperedges.get(id)!.members.forEach((m) => highlightNodes.add(m)));
  const related = new Set<ID>();
  if (selNodes.size) {
    spec.hyperedges.forEach((he, id) => {
      if (!selEdges.has(id) && he.members.some((m) => selNodes.has(m))) related.add(id);
    });
  }
  const normalNodes = new Set<ID>();
  related.forEach((id) => spec.hyperedges.get(id)!.members.forEach((m) => normalNodes.add(m)));

  const hoverNodes = new Set(hover?.nodes || []);
  const hoverEdges = new Set((hover?.hyperedges || []).filter(exists));
  hoverEdges.forEach((id) => spec.hyperedges.get(id)!.members.forEach((m) => hoverNodes.add(m)));

  const states: Record<ID, string[]> = {};
  spec.data.nodes!.forEach((n) => {
    // 超边节点（graphEdges: 'star'）随它的超边：同连线
    const owner = spec.hyperedgeNodes?.get(n.id);
    if (owner !== undefined) {
      const s = !active ? [] : selEdges.has(owner) ? ['highlight'] : related.has(owner) ? [] : ['inactive'];
      states[n.id] = hoverEdges.has(owner) ? [...s, 'active'] : s;
      return;
    }
    const s = !active ? [] : highlightNodes.has(n.id) ? ['highlight'] : normalNodes.has(n.id) ? [] : ['inactive'];
    states[n.id] = hoverNodes.has(n.id) ? [...s, 'active'] : s;
  });
  spec.data.edges!.forEach((e) => {
    const owners = spec.lineHyperedges.get(e.id!) || [];
    const s = !active
      ? []
      : owners.some((id) => selEdges.has(id))
        ? ['highlight']
        : owners.some((id) => related.has(id))
          ? []
          : ['inactive'];
    states[e.id!] = owners.some((id) => hoverEdges.has(id)) ? [...s, 'active'] : s;
  });

  const bubbles: Record<ID, BubbleLevel> = {};
  spec.hyperedges.forEach((_, id) => {
    bubbles[id] =
      hoverEdges.has(id) || selEdges.has(id) ? 'highlight' : !active || related.has(id) ? 'normal' : 'dimmed';
  });
  return { states, bubbles };
};

/**
 * <zh/> 点击后的选择：点空白取消（additive 时保留）；点元素时单选，再点同一个取消；additive（Shift）时在选择中增删该元素
 *
 * <en/> Selection after a click: blank clears (kept when additive); an element is selected alone, or toggled off when it is the only one;
 * with additive (Shift) it is toggled in the current selection
 */
export const nextSelection = (
  current: Selection,
  target: { kind: 'nodes' | 'hyperedges'; id: ID } | null,
  additive: boolean,
): Selection => {
  if (!target) return additive ? current : EMPTY_SELECTION;
  const { kind, id } = target;
  const list = current[kind];
  if (additive) {
    return { ...current, [kind]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] };
  }
  const only = list.length === 1 && list[0] === id && current[kind === 'nodes' ? 'hyperedges' : 'nodes'].length === 0;
  return only ? EMPTY_SELECTION : { ...EMPTY_SELECTION, [kind]: [id] };
};
