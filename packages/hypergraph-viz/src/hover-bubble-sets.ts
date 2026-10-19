/**
 * 可交互的 bubble-sets 插件 / Interactive bubble-sets plugin
 *
 * - 超边轮廓接收鼠标事件，在 graph 上派发 pointerover / pointermove / pointerleave / click，
 *   事件的 targetType 为 'bubble-sets'，target 为该插件的 options（含 key、members 与调用方附加的数据）；
 * - 布局进行中隐藏轮廓，布局结束后按节点新位置重画；
 * - 首次渲染完成前被销毁（切换数据、组件卸载）时不再因 shape 为空而抛异常；
 * - 配置更新（graph.setPlugins / updatePlugin，如点击高亮改透明度）后立即应用到已画好的轮廓，
 *   npm 版基类的 update 只合并配置、不重画。
 * 以新类型名 'hover-bubble-sets' 注册，不覆盖 G6 内置的 'bubble-sets'。
 */
import type { BubbleSetsOptions } from '@antv/g6';
import { CommonEvent, GraphEvent } from '@antv/g6';
// 基类换成支持 memberBoundsType: 'key' 的版本（只圈节点、不包裹标签）
import { KeyBoundsBubbleSets } from './bubble-sets-key';

export const HOVER_BUBBLE_SETS = 'hover-bubble-sets';
export const BUBBLE_SETS_TARGET = 'bubble-sets';

const SHAPE_EVENTS = [CommonEvent.POINTER_OVER, CommonEvent.POINTER_MOVE, CommonEvent.POINTER_LEAVE, CommonEvent.CLICK];

export class HoverBubbleSets extends KeyBoundsBubbleSets {
  private layouting = false;

  private boundKey: any = null;

  constructor(
    context: ConstructorParameters<typeof KeyBoundsBubbleSets>[0],
    options: BubbleSetsOptions & { memberBoundsType?: 'render' | 'key' },
  ) {
    super(context, { zIndex: -1, pointerEvents: 'all', ...options } as typeof options);
    // 基类的 shape / init / drawBubbleSets 均为 private，这里统一经 self 访问
    const self = this as any;
    const { graph } = this.context;
    // 基类构造时已把原始 drawBubbleSets 绑定到 AFTER_RENDER，换成带事件绑定的版本
    graph.off(GraphEvent.AFTER_RENDER, self.drawBubbleSets);
    const baseDraw = self.drawBubbleSets;
    self.drawBubbleSets = () => {
      // 成员不变时基类会复用缓存路径；布局移动了节点，必须重算
      self.init();
      baseDraw();
      this.bindShapeEvents();
      this.setContourVisible(!this.layouting);
    };
    graph.on(GraphEvent.AFTER_RENDER, self.drawBubbleSets);
    graph.on(GraphEvent.BEFORE_LAYOUT, this.onBeforeLayout);
    graph.on(GraphEvent.AFTER_LAYOUT, this.onAfterLayout);
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
    super.update(options);
    const self = this as any;
    // 只更新样式（路径 d 不在 style 中，保持不变），不重算轮廓
    if (self.shape && !self.shape.destroyed) self.shape.update(self.parseOptions().style);
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
    graph.off(GraphEvent.BEFORE_LAYOUT, this.onBeforeLayout);
    graph.off(GraphEvent.AFTER_LAYOUT, this.onAfterLayout);
    this.unbindShapeEvents();
    if (!self.shape) self.shape = { destroy: () => undefined };
    super.destroy();
  }
}
