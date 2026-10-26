/**
 * 可交互的 bubble-sets 插件 / Interactive bubble-sets plugin
 *
 * - 超边轮廓接收鼠标事件，在 graph 上派发 pointerover / pointermove / pointerleave / click，
 *   事件的 targetType 为 'bubble-sets'，target 为该插件的 options（含 key、members 与调用方附加的数据）；
 * - 布局进行中隐藏轮廓，布局结束后按节点新位置重画；
 * - 首次渲染完成前被销毁（切换数据、组件卸载）时不再因 shape 为空而抛异常；
 * - 配置更新（graph.setPlugins / updatePlugin，如点击高亮改透明度）后立即应用到已画好的轮廓，
 *   npm 版基类的 update 只合并配置、不重画；
 * - graph 上的 SUPPRESS_CONTOUR_UPDATE 计数大于 0 时（只改样式、状态），不因元素更新而重算轮廓；
 * - 成员的元素还没创建时（换数据过程中，G6 先更新已有元素、后创建新元素）不重算，等 AFTER_RENDER 再画；
 * - polygon 为 true 时画成多边形（HGPolyVis）：成员按绕质心的角度连成，每个成员都在角上，不经 bubble-sets 计算。
 * 以新类型名 'hover-bubble-sets' 注册，不覆盖 G6 内置的 'bubble-sets'。
 */
import type { BubbleSetsOptions, ID } from '@antv/g6';
import { CommonEvent, GraphEvent } from '@antv/g6';
// 基类换成支持 memberBoundsType: 'key' 的版本（只圈节点、不包裹标签）
import { KeyBoundsBubbleSets } from './bubble-sets-key';
import { polygonOrder } from './polygon-layout';

export const HOVER_BUBBLE_SETS = 'hover-bubble-sets';
export const BUBBLE_SETS_TARGET = 'bubble-sets';
/** graph 上的计数字段：大于 0 时元素更新不触发轮廓重算 / counter on the graph: element updates skip contour recomputation while > 0 */
export const SUPPRESS_CONTOUR_UPDATE = '__hypergraphSuppressContour';

// 滚轮也要转发：轮廓上的事件不会到达画布，否则在轮廓上无法滚轮缩放
const SHAPE_EVENTS = [
  CommonEvent.POINTER_OVER,
  CommonEvent.POINTER_MOVE,
  CommonEvent.POINTER_LEAVE,
  CommonEvent.CLICK,
  CommonEvent.WHEEL,
];

export class HoverBubbleSets extends KeyBoundsBubbleSets {
  private layouting = false;

  private boundKey: any = null;

  constructor(
    context: ConstructorParameters<typeof KeyBoundsBubbleSets>[0],
    options: BubbleSetsOptions & { memberBoundsType?: 'render' | 'key'; polygon?: boolean },
  ) {
    super(context, { zIndex: -1, pointerEvents: 'all', ...options } as typeof options);
    // 基类的 shape / init / drawBubbleSets 均为 private，这里统一经 self 访问
    const self = this as any;
    const { graph } = this.context;
    // 多边形画法：按成员当前位置直接连成多边形 / polygon drawing: straight from the members' current positions
    const getPath = self.getPath;
    self.getPath = (...args: unknown[]) => {
      if (!self.options.polygon) return getPath(...args);
      const points = polygonOrder(self.options.members as ID[], (id) => graph.getElementPosition(id) as [number, number]);
      return [
        ...points.map((id, i) => {
          const [x, y] = graph.getElementPosition(id);
          return [i ? 'L' : 'M', x, y];
        }),
        ['Z'],
      ];
    };
    // 基类构造时已把原始 drawBubbleSets 绑定到 AFTER_RENDER，换成带事件绑定的版本
    graph.off(GraphEvent.AFTER_RENDER, self.drawBubbleSets);
    const baseDraw = self.drawBubbleSets;
    self.drawBubbleSets = () => {
      if (!this.membersReady()) return;
      // 成员不变时基类会复用缓存路径；布局移动了节点，必须重算
      self.init();
      baseDraw();
      this.bindShapeEvents();
      this.setContourVisible(!this.layouting);
    };
    graph.on(GraphEvent.AFTER_RENDER, self.drawBubbleSets);
    // 基类每个元素更新都按该元素重算一次轮廓；只改颜色、状态时逐个重算很慢，且路径不变
    graph.off(GraphEvent.AFTER_ELEMENT_UPDATE, self.updateBubbleSetsPath);
    const baseUpdatePath = self.updateBubbleSetsPath;
    self.updateBubbleSetsPath = (event: any) => {
      if (!((graph as any)[SUPPRESS_CONTOUR_UPDATE] > 0) && this.membersReady()) baseUpdatePath(event);
    };
    graph.on(GraphEvent.AFTER_ELEMENT_UPDATE, self.updateBubbleSetsPath);
    graph.on(GraphEvent.BEFORE_LAYOUT, this.onBeforeLayout);
    graph.on(GraphEvent.AFTER_LAYOUT, this.onAfterLayout);
  }

  // 成员的元素都已创建。同一条超边在前后两份数据中成员不同（如另一份数据中淡出了某个成员）时，
  // 换数据过程中已有成员的更新会触发重算，此时新成员还没有元素
  private membersReady() {
    const { element } = this.context as any;
    return !!element && this.options.members.every((id) => element.getElement(id));
  }

  private onBeforeLayout = () => {
    this.layouting = true;
    this.setContourVisible(false);
  };

  private onAfterLayout = () => {
    this.layouting = false;
    (this as any).drawBubbleSets();
  };

  private forward = (event: any) => {
    this.context.graph.emit(event.type, {
      ...event,
      target: { ...this.options, id: this.options.key, options: this.options },
      targetType: BUBBLE_SETS_TARGET,
      originalTarget: event.target,
    });
  };

  update(options: Partial<BubbleSetsOptions>) {
    const self = this as any;
    const prevMembers = this.options.members;
    const prevPolygon = (this.options as any).polygon;
    super.update(options);
    // 成员变了（换数据、隐藏实体）：清掉按旧成员缓存的区域。否则基类在算新路径时要先移除旧成员，
    // 对已删除的节点调用 graph.getElementType 会抛 "Unknown element type"
    const members = this.options.members;
    if (options.members && (members.length !== prevMembers.length || members.some((m, i) => m !== prevMembers[i]))) {
      self.init();
    }
    // 换了画法：按新画法重画 / drawing switched between bubble and polygon: redraw
    if ('polygon' in options && (options as any).polygon !== prevPolygon && self.shape && !self.shape.destroyed) {
      self.drawBubbleSets();
      return;
    }
    // 只更新样式（路径 d 不在 style 中，保持不变），不重算轮廓
    if (self.shape && !self.shape.destroyed) self.shape.update(self.parseOptions().style);
  }

  /** 按节点当前位置重算并重画轮廓（新加入的插件、轮廓范围变化后）/ recompute the contour from current node positions */
  redraw() {
    (this as any).drawBubbleSets();
  }

  private setContourVisible(visible: boolean) {
    const shape = (this as any).shape;
    if (shape) shape.style.visibility = visible ? 'visible' : 'hidden';
  }

  private bindShapeEvents() {
    const key = (this as any).shape?.shapeMap?.key;
    if (!key || key === this.boundKey) return;
    this.unbindShapeEvents();
    key.style.pointerEvents = 'all';
    SHAPE_EVENTS.forEach((type) => key.addEventListener(type, this.forward));
    this.boundKey = key;
  }

  private unbindShapeEvents() {
    if (!this.boundKey) return;
    SHAPE_EVENTS.forEach((type) => this.boundKey.removeEventListener(type, this.forward));
    this.boundKey = null;
  }

  destroy() {
    const self = this as any;
    const { graph } = this.context;
    graph.off(GraphEvent.AFTER_RENDER, self.drawBubbleSets);
    graph.off(GraphEvent.AFTER_ELEMENT_UPDATE, self.updateBubbleSetsPath);
    graph.off(GraphEvent.BEFORE_LAYOUT, this.onBeforeLayout);
    graph.off(GraphEvent.AFTER_LAYOUT, this.onAfterLayout);
    this.unbindShapeEvents();
    if (!self.shape) self.shape = { destroy: () => undefined };
    super.destroy();
  }
}
