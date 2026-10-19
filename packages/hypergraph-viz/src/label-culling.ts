import type { ID } from '@antv/g6';
import { charWidth } from './layout';

export interface LabelCandidate {
  id: ID;
  x: number;
  y: number;
  /** 节点半径 / node radius */
  r: number;
  text: string;
  /** 该标签的字号（画布坐标），不给时用 cullLabels 的 fontSize / font size of this label, defaults to cullLabels' fontSize */
  fontSize?: number;
}

/**
 * <zh/> 标签避让：按 order 的先后放置标签（在节点下方），与已放的标签或任一节点重叠的不显示；返回不显示标签的节点。
 * 标签尺寸按字符估算，与 HypergraphLayout 的标签防重叠一致
 *
 * <en/> Label culling: labels (below their nodes) are placed in the given order and skipped when they overlap a placed
 * label or any node; returns the nodes whose label is hidden. Label sizes are estimated as in HypergraphLayout
 */
export const cullLabels = (candidates: LabelCandidate[], fontSize: number, padding = 2): Set<ID> => {
  const hidden = new Set<ID>();
  const nodes = candidates.map(({ x, y, r }) => [x - r, y - r, x + r, y + r]);
  const placed: number[][] = [];
  const hit = (a: number[], b: number[]) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  candidates.forEach(({ id, x, y, r, text, fontSize: size = fontSize }, i) => {
    if (!text) return;
    let width = 0;
    for (const char of text) width += size * charWidth(char);
    const box = [x - width / 2 - padding, y + r, x + width / 2 + padding, y + r + size * 1.3 + padding];
    if (placed.some((p) => hit(p, box)) || nodes.some((n, j) => j !== i && hit(n, box))) {
      hidden.add(id);
      return;
    }
    placed.push(box);
  });
  return hidden;
};
