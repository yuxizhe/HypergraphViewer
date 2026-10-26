/**
 * bubble-sets 只圈节点（补丁版）/ bubble-sets that wraps nodes only (patch)
 *
 * 为已发布的 @antv/g6 补上 G6 仓库中 bubble-sets 的 `memberBoundsType` 选项：设为 `'key'` 时，
 * 节点所占区域只取主图形（如圆形节点的圆），轮廓不再包裹标签。升级到自带该选项的 G6 后删除本文件即可。
 * Backports the `memberBoundsType` option of bubble-sets in the G6 repo to published @antv/g6: with `'key'`,
 * a node's area is its key shape only (e.g. the circle), so the contour no longer wraps its label.
 * Delete this file once the G6 in use ships the option.
 *
 * 用法 / Usage:
 *   import { registerHypergraph } from 'hypergraph-viz';
 *   registerHypergraph({ overrideBubbleSets: true }); // 'bubble-sets' 换成本版本 / replaces 'bubble-sets' with this version
 *   plugins: [{ type: 'bubble-sets', members, memberBoundsType: 'key' }]
 *
 * 另加 `memberPadding`（成员 id → 像素）：轮廓在该成员周围多外扩这段距离，用于嵌套轮廓（见 toG6Spec 的 contourNesting）。
 * Also adds `memberPadding` (member id → pixels): the contour grows that much further around the member, for nested
 * contours (see contourNesting in toG6Spec).
 */
import type { BubbleSetsOptions, ID } from '@antv/g6';
import { BubbleSets } from '@antv/g6';

/** 外扩用的圆环由多少段线段组成 / segments of the ring used for padding */
const RING_SEGMENTS = 12;

type Bounds = { min: number[]; max: number[] };

/**
 * <zh/> 以 (cx, cy) 为圆心、r 为半径的圆环，展开为线段
 *
 * <en/> A ring of radius r around (cx, cy), as line segments
 */
const ring = (cx: number, cy: number, r: number) =>
  Array.from({ length: RING_SEGMENTS }, (_, i) => {
    const a = (i / RING_SEGMENTS) * Math.PI * 2;
    const b = ((i + 1) / RING_SEGMENTS) * Math.PI * 2;
    return { x1: cx + r * Math.cos(a), y1: cy + r * Math.sin(a), x2: cx + r * Math.cos(b), y2: cy + r * Math.sin(b) };
  });

export class KeyBoundsBubbleSets extends BubbleSets {
  constructor(
    context: ConstructorParameters<typeof BubbleSets>[0],
    options: BubbleSetsOptions & { memberBoundsType?: 'render' | 'key'; memberPadding?: Record<ID, number> },
  ) {
    super(context, options);
    const self = this as any;
    const getPath = self.getPath;
    // getPath 同步地经 graph.getElementRenderBounds 取成员包围盒，调用期间临时换成主图形包围盒
    // getPath reads member bounds synchronously via graph.getElementRenderBounds: swap in key shape bounds while it runs
    self.getPath = (...args: unknown[]) => {
      const { memberBoundsType, memberPadding } = self.options;
      if (memberBoundsType !== 'key' && !memberPadding) return getPath(...args);
      const graph = self.context.graph;
      const boundsOf = (id: ID): Bounds =>
        memberBoundsType === 'key'
          ? self.context.element.getElement(id).getShape('key').getRenderBounds()
          : graph.getElementRenderBounds(id);
      // 外扩不能靠放大成员的包围盒：默认参数下成员自身的势能低于阈值，轮廓由成员间连线的“管道”撑起，包围盒再大也不起作用。
      // 改为在成员周围临时加一圈线段，线段与连线同样形成约 edgeR0 宽的管道，轮廓随之外扩约 padding
      // Growing the member's bounds does not work: with the default options a member's own potential is below the threshold
      // and the contour is held up by the "tubes" around the links between members. Instead a ring of segments is added
      // around the member while the path is computed; like the links it forms a tube about edgeR0 wide, growing the contour by
      // about the padding
      const bubbleSets = self.bubbleSets;
      const rings: ReturnType<typeof ring> = [];
      if (memberPadding) {
        (self.options.members as ID[]).forEach((id) => {
          const pad = memberPadding[id];
          if (!pad) return;
          const { min, max } = boundsOf(id);
          rings.push(...ring((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, pad));
        });
        bubbleSets.pushEdge(...rings);
      }
      if (memberBoundsType === 'key') graph.getElementRenderBounds = boundsOf;
      try {
        return getPath(...args);
      } finally {
        delete graph.getElementRenderBounds;
        rings.forEach((line) => bubbleSets.removeEdge(line));
      }
    };
  }
}
