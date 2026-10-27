import { ExtensionCategory, register } from '@antv/g6';
import { KeyBoundsBubbleSets } from './bubble-sets-key';
import { HOVER_BUBBLE_SETS, HoverBubbleSets } from './hover-bubble-sets';
import { HypergraphLayout } from './layout';
import { PolygonLayout } from './polygon-layout';
import { ShuffleLayout } from './shuffle-layout';

export const HYPERGRAPH_LAYOUT = 'hypergraph';
export const POLYGON_LAYOUT = 'polygon';
export const SHUFFLE_LAYOUT = 'shuffle';
/** KelpFusion 画法：坐标沿用超图布局，只换超边的画法 / KelpFusion drawing on the hypergraph layout's coordinates */
export const KELP_LAYOUT = 'kelp';

let registered = false;
let bubbleSetsOverridden = false;

/**
 * <zh/> 向宿主项目的 G6 注册超图扩展，可重复调用（只注册一次）：
 * - 'hypergraph' 布局；'polygon' 布局（超图布局 + 多边形优化，配合多边形画法）；'shuffle' 布局（按种子打乱位置）；
 * - 'hover-bubble-sets'：可悬停、点击的超边轮廓，支持 memberBoundsType: 'key'（只圈节点、不包裹标签）；
 * - overrideBubbleSets 为 true 时，把 G6 内置的 'bubble-sets' 也换成支持 memberBoundsType 的版本。
 *
 * <en/> Register the hypergraph extensions with the host's G6. Safe to call repeatedly.
 */
export const registerHypergraph = ({ overrideBubbleSets = false } = {}) => {
  if (!registered) {
    registered = true;
    register(ExtensionCategory.LAYOUT, HYPERGRAPH_LAYOUT, HypergraphLayout);
    register(ExtensionCategory.LAYOUT, POLYGON_LAYOUT, PolygonLayout);
    register(ExtensionCategory.LAYOUT, SHUFFLE_LAYOUT, ShuffleLayout);
    register(ExtensionCategory.PLUGIN, HOVER_BUBBLE_SETS, HoverBubbleSets as any);
  }
  if (overrideBubbleSets && !bubbleSetsOverridden) {
    bubbleSetsOverridden = true;
    register(ExtensionCategory.PLUGIN, 'bubble-sets', KeyBoundsBubbleSets as any);
  }
};
