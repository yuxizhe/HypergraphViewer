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
 */
import type { BubbleSetsOptions, ID } from '@antv/g6';
import { BubbleSets } from '@antv/g6';

export class KeyBoundsBubbleSets extends BubbleSets {
  constructor(
    context: ConstructorParameters<typeof BubbleSets>[0],
    options: BubbleSetsOptions & { memberBoundsType?: 'render' | 'key' },
  ) {
    super(context, options);
    const self = this as any;
    const getPath = self.getPath;
    // getPath 同步地经 graph.getElementRenderBounds 取成员包围盒，调用期间临时换成主图形包围盒
    // getPath reads member bounds synchronously via graph.getElementRenderBounds: swap in key shape bounds while it runs
    self.getPath = (...args: unknown[]) => {
      if (self.options.memberBoundsType !== 'key') return getPath(...args);
      const graph = self.context.graph;
      graph.getElementRenderBounds = (id: ID) => self.context.element.getElement(id).getShape('key').getRenderBounds();
      try {
        return getPath(...args);
      } finally {
        delete graph.getElementRenderBounds;
      }
    };
  }
}
