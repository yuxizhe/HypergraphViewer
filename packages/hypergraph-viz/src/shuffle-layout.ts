/**
 * 打乱布局 / Shuffle layout
 *
 * 成员关系不变、位置打乱：按种子把顶点随机放进网格的空格里（格子数约为顶点数的 1.3 倍，留出随机的空位），
 * 格宽按最长标签留够，标签互不重叠；不做任何力导，同一种子结果相同。用作“布局无信息”的对照（如 T+V′）。
 * Membership kept, positions shuffled: vertices go into random cells of a grid (about 1.3 cells per vertex) by seed,
 * cells wide enough for the longest label so labels never overlap; no forces, same seed same result. A control where
 * the layout carries no information
 */
import type { BaseLayoutOptions, GraphData, ID, NodeData, Size } from '@antv/g6';
import { BaseLayout } from '@antv/g6';
import { charWidth } from './layout';

export interface ShuffleLayoutOptions extends BaseLayoutOptions {
  /** 随机种子 / random seed */
  seed?: number;
  nodeSize?: Size | ((node: NodeData) => Size);
  /** 节点间留白，默认 50 / gap between cells */
  nodeSpacing?: number;
  /** 节点标签，用于估算格宽 / node label, for the cell width */
  labelText?: (node: NodeData) => string;
  labelFontSize?: number | ((node: NodeData) => number);
}

// mulberry32：小而确定的伪随机数 / small deterministic PRNG
export const seededRandom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const sizeValue = (size: Size) => (Array.isArray(size) ? Math.max(...(size as number[])) : (size as number));

export class ShuffleLayout extends BaseLayout<ShuffleLayoutOptions> {
  public id = 'shuffle';

  async execute(model: GraphData, options?: ShuffleLayoutOptions): Promise<GraphData> {
    const { seed = 1, nodeSize = 20, nodeSpacing = 50, labelText, labelFontSize = 12 } = { ...this.options, ...options };
    const nodes = model.nodes || [];
    const value = <T>(v: T | ((d: NodeData) => T), d: NodeData) => (typeof v === 'function' ? (v as (d: NodeData) => T)(d) : v);
    const textWidth = (d: NodeData) => {
      const text = labelText ? labelText(d) : String(d.id);
      const size = value(labelFontSize, d);
      return [...text].reduce((w, ch) => w + size * charWidth(ch), 0);
    };
    const widths = nodes.map(textWidth);
    const diameter = Math.max(0, ...nodes.map((d) => sizeValue(value(nodeSize, d))));
    const fontSize = Math.max(0, ...nodes.map((d) => value(labelFontSize, d)));
    const cellW = Math.max(diameter, ...widths) + nodeSpacing / 2;
    const cellH = diameter + fontSize * 1.3 + nodeSpacing / 2;
    // 整体接近正方形 / roughly square overall
    const cells = Math.ceil(nodes.length * 1.3);
    const cols = Math.max(1, Math.ceil(Math.sqrt((cells * cellH) / cellW)));
    const rows = Math.ceil(cells / cols);
    const random = seededRandom(seed);
    const order = Array.from({ length: cols * rows }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const result = nodes.map((d, i) => {
      const cell = order[i];
      // 格内横向随机偏移（不超出标签的余量），纵向小幅偏移，减少网格感 / jitter within the label's slack
      const slack = (cellW - Math.max(diameter, widths[i]) - nodeSpacing / 4) / 2;
      const x = ((cell % cols) - (cols - 1) / 2) * cellW + (random() * 2 - 1) * Math.max(0, slack);
      const y = (Math.floor(cell / cols) - (rows - 1) / 2) * cellH + (random() * 2 - 1) * (nodeSpacing / 8);
      return { id: d.id as ID, style: { x, y } };
    });
    return { nodes: result };
  }
}
