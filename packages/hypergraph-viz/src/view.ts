import type { GraphOptions, ID } from '@antv/g6';
import { Graph, GraphEvent } from '@antv/g6';
import { BUBBLE_SETS_TARGET, HOVER_BUBBLE_SETS, SUPPRESS_CONTOUR_UPDATE } from './hover-bubble-sets';
import { cullLabels } from './label-culling';
import { registerHypergraph } from './register';
import type { Selection } from './selection';
import { EMPTY_SELECTION, isEmptySelection, nextSelection, selectionStyles } from './selection';
import type { HyperedgeItem, HypergraphData, HypergraphSpec, SpecOptions } from './spec';
import { pairId, toG6Spec } from './spec';
import { placeFaded } from './faded';
import type { HypergraphTheme } from './theme';
import { resolveTheme } from './theme';

/**
 * <zh/> 悬停 / 点击命中的元素。连线是 2 元超边（或图模式下拆出的一对成员），轮廓是 3 元及以上的超边；
 * 连线的 hyperedges 为产生它的超边 id
 *
 * <en/> Element under the pointer or clicked. A line is a 2-member hyperedge, a contour one with 3+ members;
 * a line's hyperedges are the ids of the hyperedges it comes from
 */
export type HypergraphHit =
  | {
      kind: 'node';
      id: ID;
      item: Record<string, any>;
      /** 只剩该实体一个成员的超边（其余成员淡出，见 fadedNodes）/ hyperedges whose other members are all faded */
      fadedHyperedges?: HyperedgeItem[];
    }
  | { kind: 'edge' | 'hyperedge'; id: ID; members: ID[]; item: HyperedgeItem; hyperedges?: ID[] };

export interface ViewOptions extends SpecOptions {
  data?: HypergraphData;
  /** 容器没有高度时的画布高度 / canvas height when the container has none */
  fallbackHeight?: number;
  /** 渲染后的视口：'center' 只居中（默认），'view' 缩放到撑满画布 / 'center' (default) centers only, 'view' zooms to fill the canvas */
  autoFit?: GraphOptions['autoFit'];
  /** autoFit 为 'view' 时自动缩放的上限，避免只有几个节点的图被放得很大，默认 2 / zoom cap when fitting to view */
  maxFitZoom?: number;
  /** autoFit 为 'view' 时四周留白（像素），默认 24 / padding around the fitted view */
  fitPadding?: number;
  /**
   * 节点标签保持屏幕上的字号，不随画布缩放；标签避让（hideOverlappingLabels）随之按屏幕尺寸计算，放大后显示更多标签
   * Keep node labels at their on-screen font size while zooming; label culling then works in screen space, showing more labels when zoomed in
   */
  fixLabelSize?: boolean;
  /**
   * 指针悬停在实体 / 超边上时高亮，效果同 hover()（表格行悬停）
   * Highlight the element under the pointer, same as hover() (table row hover)
   */
  hoverHighlight?: boolean;
  behaviors?: GraphOptions['behaviors'];
  /** 指针移动时触发，不在元素上时为 null；client 为视口坐标 / fired on pointer move, null off elements */
  onHover?: (hit: (HypergraphHit & { client: { x: number; y: number } }) | null) => void;
  /** 点击超边选中（高亮成员、其余变淡），再点同一条或点空白处取消（null）/ fired when a hyperedge is selected or cleared */
  onSelect?: (hit: Extract<HypergraphHit, { kind: 'edge' | 'hyperedge' }> | null) => void;
  /**
   * 多选模式：创建视图时传入则启用。点击实体或超边单选，Shift 点击增删，点空白取消；
   * 换数据（如隐藏元素后）保留选择。传了 selection 时为受控，视图只显示 selection
   * Multi-select mode, enabled when given at creation: click selects, Shift-click toggles, blank clears;
   * the selection survives data updates. Controlled when selection is given
   */
  onSelectionChange?: (selection: Selection, info: { additive: boolean; hit: HypergraphHit | null }) => void;
  selection?: Selection;
}

export interface HypergraphView {
  readonly graph: Graph;
  /** 更新数据或选项：数据、布局相关项变化时重新布局，只有样式变化时只重绘 / re-layout on data or layout changes, otherwise restyle only */
  update(options: Partial<ViewOptions>): void;
  /** 选中超边（id 为超边 id），null 取消 / select a hyperedge by id, null to clear */
  select(id: ID | null): void;
  /** 临时高亮（如表格行悬停），不触发回调；null 取消 / transient highlight, e.g. on table row hover; null clears */
  hover(target: Partial<Selection> | null): void;
  /** 缩放平移到撑满画布（不超过 maxFitZoom），如工具栏的“适应画布” / fit the graph to the canvas, capped at maxFitZoom */
  fitView(animate?: boolean): Promise<void>;
  destroy(): void;
}

// 变化时需要重新布局的选项；其余（颜色、轮廓）只重绘
const LAYOUT_KEYS = [
  'data',
  'mode',
  'centerNode',
  'graphEdges',
  'labelText',
  'layout',
  'nodeSizeBy',
  'labelBy',
  'fadedNodes',
] as const;
const STYLE_KEYS = [
  'typeField',
  'typeColors',
  'nodeColors',
  'hyperedgeColors',
  'contours',
  'contourBounds',
  'theme',
  'hideOverlappingLabels',
] as const;
// 影响布局的主题项（节点尺寸、标签字号）
const LAYOUT_THEME_KEYS: (keyof HypergraphTheme)[] = ['nodeSize', 'largeNodeSize', 'largeGraphThreshold', 'labelFontSize'];

const isFitView = (autoFit: ViewOptions['autoFit']) =>
  autoFit === 'view' || (typeof autoFit === 'object' && autoFit?.type === 'view');

// 首次渲染完成前销毁（换数据、StrictMode 二次挂载）时，npm 版 G6 在销毁元素层时抛异常；
// 此时插件、交互、布局已销毁，补上画布销毁即可
const destroyGraph = (graph: Graph) => {
  if (graph.destroyed) return;
  try {
    graph.destroy();
  } catch {
    (graph as any).context.canvas?.destroy();
    (graph as any).destroyed = true;
  }
};

/**
 * <zh/> 在容器中创建超图视图：超图布局、超边轮廓、悬停与点击高亮，容器尺寸变化时自动调整画布
 *
 * <en/> Create a hypergraph view in the container, with layout, contours, hover and click highlighting; follows container resizes
 */
export const createHypergraphView = (container: HTMLElement, initial: ViewOptions = {}): HypergraphView => {
  registerHypergraph();
  let options: ViewOptions = { ...initial };
  const multi = !!initial.onSelectionChange;
  let spec: HypergraphSpec | null = null;
  // 单选模式下的选中元素（onSelect 的参数）；selection 为两种模式共用的选中集合
  let selected: Extract<HypergraphHit, { kind: 'edge' | 'hyperedge' }> | null = null;
  let selection: Selection = initial.selection ?? EMPTY_SELECTION;
  let hovered: Partial<Selection> | null = null;
  // 标签避让中不显示标签的节点（hideOverlappingLabels）；高亮、悬停的节点照常显示
  let culled = new Set<ID>();
  // 上次标签避让时的缩放；标签固定屏幕字号时，缩放变化后重新避让
  let culledZoom = 1;
  let statesStale = false;
  let recullTimer: ReturnType<typeof setTimeout> | undefined;

  // 画布放进绝对定位的内层：画布的像素宽度不计入容器的固有尺寸，容器在 flex 布局中能随旁边面板出现而变窄
  const host = document.createElement('div');
  host.style.cssText = 'position: absolute; inset: 0; overflow: hidden;';
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.appendChild(host);

  const graph = new Graph({
    container: host,
    width: container.offsetWidth,
    height: container.offsetHeight || options.fallbackHeight || 300,
    behaviors: options.behaviors ?? ['zoom-canvas', 'drag-canvas', 'drag-element'],
    autoFit: options.autoFit ?? 'center',
    padding: isFitView(options.autoFit) ? (options.fitPadding ?? 24) : undefined,
    animation: false,
  });

  // 只改样式、状态期间不重算轮廓路径
  const withoutContourUpdate = async (fn: () => Promise<unknown> | unknown) => {
    const g = graph as any;
    g[SUPPRESS_CONTOUR_UPDATE] = (g[SUPPRESS_CONTOUR_UPDATE] || 0) + 1;
    try {
      await fn();
    } finally {
      g[SUPPRESS_CONTOUR_UPDATE]--;
    }
  };

  const hitOf = (e: any): HypergraphHit | null => {
    if (!spec) return null;
    if (e.targetType === 'node') {
      const node = spec.data.nodes!.find((n) => n.id === e.target.id);
      if (!node) return null;
      const fadedHyperedges = spec.faded.dropped.get(node.id);
      return fadedHyperedges ? { kind: 'node', id: node.id, item: node, fadedHyperedges } : { kind: 'node', id: node.id, item: node };
    }
    if (e.targetType === 'edge') {
      const edge = spec.data.edges!.find((d) => d.id === e.target.id);
      if (!edge) return null;
      const { source, target, ...rest } = edge;
      const members = [source, target];
      const hyperedges = spec.lineHyperedges.get(edge.id!) || [];
      // 连线上不带 type 等保留字段，从产生它的超边补回；成员补上淡出的
      const owner = spec.hyperedges.get(hyperedges[0]);
      const faded = spec.faded.members.get(hyperedges[0]) || [];
      return {
        kind: 'edge',
        id: edge.id!,
        members,
        item: { ...owner, ...rest, id: edge.id, members: [...members, ...faded] },
        hyperedges,
      };
    }
    if (e.targetType === BUBBLE_SETS_TARGET) {
      const item: HyperedgeItem = e.target.options?.hyperedge;
      return item ? { kind: 'hyperedge', id: item.id!, members: item.members, item } : null;
    }
    return null;
  };

  // 命中元素对应的选择目标：连线取产生它的第一条超边
  const targetOf = (hit: HypergraphHit | null) => {
    if (!hit) return null;
    if (hit.kind === 'node') return { kind: 'nodes' as const, id: hit.id };
    if (hit.kind === 'hyperedge') return { kind: 'hyperedges' as const, id: hit.id };
    const owner = hit.hyperedges?.[0];
    return owner === undefined ? null : { kind: 'hyperedges' as const, id: owner };
  };

  // 按选择与悬停给轮廓插件配置透明度档位
  const decoratePlugins = (plugins: any[], bubbles: Record<ID, string>) => {
    const { bubble } = resolveTheme(options.theme);
    return plugins.map((p: any) =>
      p.type !== HOVER_BUBBLE_SETS ? p : { ...p, ...(bubble as any)[bubbles[p.hyperedge?.id] ?? 'normal'] },
    );
  };

  // 被避让的节点加上 labelHidden 状态（高亮、悬停的除外）
  const withCulledLabels = (states: Record<ID, string[]>) => {
    culled.forEach((id) => {
      const s = states[id];
      if (s && !s.includes('highlight') && !s.includes('active')) states[id] = [...s, 'labelHidden'];
    });
    return states;
  };

  // 淡出实体与虚线的状态：悬停只剩一个成员的超边的成员时，显示它与淡出实体的虚线，其余不显示
  let fadedPlaced = false;
  const fadedStates = (states: Record<ID, string[]> = {}) => {
    if (!spec || !fadedPlaced) return states;
    const nodes = new Set(hovered?.nodes || []);
    const shown = new Set<ID>();
    spec.faded.links.forEach((link) => {
      const on = nodes.has(link.target);
      if (on) shown.add(link.source);
      states[link.id] = [on ? 'fadedShown' : 'faded'];
    });
    spec.faded.nodes.forEach(({ id }) => {
      states[id] = [shown.has(id) ? 'fadedShown' : 'faded'];
    });
    return states;
  };

  // 高亮选中的实体 / 超边，无关的实体、连线、轮廓变淡；未选中时全部恢复
  const applySelection = () => {
    if (!spec) return;
    const { states, bubbles } = selectionStyles(spec, selection, hovered);
    withoutContourUpdate(() => graph.setElementState(fadedStates(withCulledLabels(states)), false)).catch(
      () => undefined,
    );
    graph.setPlugins((plugins) => decoratePlugins(plugins, bubbles));
  };

  const setSelected = (next: typeof selected) => {
    selected = next;
    const target = targetOf(next);
    selection = target ? { ...EMPTY_SELECTION, hyperedges: [target.id] } : EMPTY_SELECTION;
    applySelection();
    options.onSelect?.(selected);
  };

  graph.on('click', (e: any) => {
    // 双指缩放后抬起手指的那次点击（见下方 onTouchUp）
    if (Date.now() - pinchedAt < 300) return;
    const hit = hitOf(e);
    // 触摸没有悬停：点一下等同鼠标悬停（高亮 + 悬停卡片），点空白处取消，不选中
    if (e.pointerType === 'touch') {
      tapped = !!hit;
      hoverPointer(hit);
      options.onHover?.(hit && e.client ? { ...hit, client: { x: e.client.x, y: e.client.y } } : null);
      return;
    }
    if (multi) {
      const additive = !!(e.shiftKey ?? e.nativeEvent?.shiftKey ?? e.originalEvent?.shiftKey);
      const next = nextSelection(selection, targetOf(hit), additive);
      if (next === selection) return;
      if (!options.selection) {
        selection = next;
        applySelection();
      }
      options.onSelectionChange!(next, { additive, hit });
      return;
    }
    if (e.targetType === 'node') return;
    const next = hit && hit.kind !== 'node' && hit.id !== selected?.id ? hit : null;
    if (next || selected) setSelected(next);
  });

  // 画布悬停高亮：与表格行悬停共用 hovered，只在悬停目标变化时重设状态
  let pointerKey = '';
  // 触摸点出来的悬停还在；拖动、捏合画布时撤掉
  let tapped = false;
  const clearTap = () => {
    if (!tapped) return;
    tapped = false;
    hoverPointer(null);
    options.onHover?.(null);
  };
  const hoverPointer = (hit: HypergraphHit | null) => {
    if (!options.hoverHighlight) return;
    const target: Partial<Selection> | null = !hit
      ? null
      : hit.kind === 'node'
        ? { nodes: [hit.id] }
        : hit.kind === 'hyperedge'
          ? { hyperedges: [hit.id] }
          : hit.hyperedges?.length
            ? { hyperedges: hit.hyperedges }
            : null;
    const key = target ? JSON.stringify(target) : '';
    if (key === pointerKey) return;
    pointerKey = key;
    view.hover(target);
  };

  graph.on('pointermove', (e: any) => {
    // 触摸时 pointermove 是在拖动画布：悬停由点击设置（见上方 click），拖动时撤掉，免得卡片停在原处
    if (e.pointerType === 'touch') {
      clearTap();
      return;
    }
    const hit = e.client ? hitOf(e) : null;
    hoverPointer(hit);
    options.onHover?.(hit ? { ...hit, client: { x: e.client.x, y: e.client.y } } : null);
  });

  // 拖动节点后重新避让
  graph.on('node:dragend', () => updateCulledLabels());

  // 标签固定屏幕字号：每次缩放、重绘后把节点标签图形按 1 / 缩放 反向缩放（重绘会新建或重置标签图形）。
  // 不用 G6 的 fix-element-size：它只在滚轮缩放事件里更新缩放倍数，换数据后自动撑满改变了缩放，它仍按旧倍数修正
  const fixLabelScale = () => {
    if (!options.fixLabelSize || graph.destroyed) return;
    const element = (graph as any).context.element;
    if (!element) return;
    const scale = 1 / (graph.getZoom() || 1);
    graph.getNodeData().forEach((d) => {
      const label = element.getElement(d.id)?.getShape?.('label');
      if (label && label.getLocalScale()[0] !== scale) label.setLocalScale(scale);
    });
  };
  graph.on(GraphEvent.AFTER_TRANSFORM, fixLabelScale);
  graph.on(GraphEvent.AFTER_DRAW, fixLabelScale);
  graph.on(GraphEvent.AFTER_RENDER, fixLabelScale);
  // 标签固定屏幕字号时，缩放停下来后按新的缩放重新避让
  graph.on(GraphEvent.AFTER_TRANSFORM, () => {
    if (!options.fixLabelSize || !options.hideOverlappingLabels) return;
    clearTimeout(recullTimer);
    recullTimer = setTimeout(() => {
      if (!graph.destroyed && Math.abs(graph.getZoom() / culledZoom - 1) > 0.05) updateCulledLabels();
    }, 150);
  });

  // 触摸每次抬起都会触发 pointerleave，不能因此撤掉点出来的悬停
  const onLeave = (e?: PointerEvent) => {
    if (e?.pointerType === 'touch') return;
    hoverPointer(null);
    options.onHover?.(null);
  };
  container.addEventListener('pointerleave', onLeave);

  // 双指缩放：G6 的 drag-canvas 只跟一根手指，内置的捏合（zoom-canvas 的 pinch）按起始距离累乘倍率，越捏越快。
  // 自己跟踪触点：两指时按两指距离之比缩放、随中点移动画布，并拦下这些事件，不让 G6 当成拖动或点击。
  // 必须在 window 的捕获阶段拦：G 在 document 捕获阶段收 pointermove；支持触摸事件的设备上（手机）它不看触摸的
  // pointer 事件，改收画布上的 touchstart/touchmove，把第二根手指也当拖动，画布会一下跳出两指间距那么远
  host.style.touchAction = 'none';
  const touches = new Map<number, { x: number; y: number }>();
  // armed：两指刚落下时触点会抖（第二指落点和它第一次移动常差好几像素），距离或中点变化超过 PINCH_SLOP 才开始跟手，
  // 并以那一刻为起点，免得落指的抖动变成一下跳动
  const PINCH_SLOP = 8;
  let pinch: { d: number; x: number; y: number; armed: boolean } | null = null;
  let frame = 0;
  const pinchOf = () => {
    const [a, b] = [...touches.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  // 两根手指各自触发 pointermove，每帧只按最新触点更新一次视图
  const applyPinch = () => {
    frame = 0;
    if (!pinch || touches.size !== 2 || graph.destroyed) return;
    const next = pinchOf();
    if (!pinch.armed) {
      if (Math.abs(next.d - pinch.d) < PINCH_SLOP && Math.hypot(next.x - pinch.x, next.y - pinch.y) < PINCH_SLOP) return;
      pinch = { ...next, armed: true };
      return;
    }
    const rect = host.getBoundingClientRect();
    if (pinch.d > 0 && next.d > 0) {
      graph.zoomTo((graph.getZoom() * next.d) / pinch.d, false, [next.x - rect.left, next.y - rect.top]);
    }
    graph.translateBy([next.x - pinch.x, next.y - pinch.y], false);
    pinch = { ...next, armed: true };
  };
  const onTouchDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || !host.contains(e.target as Node)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) {
      pinch = { ...pinchOf(), armed: false };
      clearTap();
    }
    if (touches.size > 1) e.stopPropagation();
  };
  const onTouchMove = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!pinch) return;
    e.stopPropagation();
    if (!frame) frame = requestAnimationFrame(applyPinch);
  };
  // 抬起照常交给 G6（结束它的拖动），但随后的点击不算选中
  let pinchedAt = 0;
  const onTouchUp = (e: PointerEvent) => {
    if (!touches.delete(e.pointerId) || !pinch) return;
    pinchedAt = Date.now();
    // 两指都抬起才结束：先抬一指时剩下那根不接着拖动画布
    if (touches.size === 0) pinch = null;
  };
  // 触摸事件跟在同一触点的 pointer 事件之后，这时 pinch 已更新；touchend 照常放行，让 G 结束第一根手指的拖动
  const onTouchEvent = (e: TouchEvent) => {
    if ((pinch || e.touches.length > 1) && host.contains(e.target as Node)) e.stopPropagation();
  };
  window.addEventListener('pointerdown', onTouchDown, true);
  window.addEventListener('pointermove', onTouchMove, true);
  window.addEventListener('pointerup', onTouchUp, true);
  window.addEventListener('pointercancel', onTouchUp, true);
  window.addEventListener('touchstart', onTouchEvent, true);
  window.addEventListener('touchmove', onTouchEvent, true);

  const observer = new ResizeObserver(() => {
    if (!graph.destroyed && container.offsetWidth && container.offsetHeight) {
      graph.setSize(container.offsetWidth, container.offsetHeight);
    }
  });
  observer.observe(container);

  // 标签避让：按节点当前位置重新计算不显示的标签，中心优先，其次按所属超边数降序。
  // 还有 render 排队时跳过（spec 已换成新数据，画布上还是旧的），由那次 render 完成后再算
  const updateCulledLabels = () => {
    if (graph.destroyed || !spec || renderPending) return;
    const prev = culled;
    culled = new Set();
    if (options.hideOverlappingLabels) {
      const style = spec.node.style as any;
      const value = (v: any, d: any) => (typeof v === 'function' ? v(d) : v);
      const degree = new Map<ID, number>();
      spec.hyperedges.forEach((he) => he.members.forEach((m) => degree.set(m, (degree.get(m) || 0) + 1)));
      const rank = (id: ID) => (id === options.centerNode ? Infinity : degree.get(id) || 0);
      const drawn = new Set(graph.getNodeData().map((d) => d.id));
      const nodes = spec.data.nodes!.filter((d) => drawn.has(d.id)).sort((a, b) => rank(b.id) - rank(a.id));
      // 标签固定屏幕字号时，画布坐标里的标签大小为 字号 / 缩放
      const scale = options.fixLabelSize ? graph.getZoom() || 1 : 1;
      culledZoom = graph.getZoom();
      const candidates = nodes.map((d) => {
        const [x, y] = graph.getElementPosition(d.id);
        const size = value(style.size, d);
        return {
          id: d.id,
          x,
          y,
          r: (Array.isArray(size) ? Math.max(...size) : size || 0) / 2,
          text: String(style.labelText ? value(style.labelText, d) : d.id),
          fontSize: (value(style.labelFontSize, d) || 12) / scale,
        };
      });
      culled = cullLabels(candidates, 12 / scale, 2 / scale);
    }
    // 换数据后第一次也要设置：id 相同的节点会保留上一份数据中的 labelHidden 状态
    if (statesStale || prev.size || culled.size) {
      statesStale = false;
      applySelection();
    }
  };

  // 新数据的 spec，并把当前选择写进元素初始状态与轮廓透明度
  const buildSpec = () => {
    culled = new Set();
    fadedPlaced = false;
    statesStale = true;
    const next = toG6Spec(options.data!, options);
    if (!isEmptySelection(selection) || hovered) {
      const { states, bubbles } = selectionStyles(next, selection, hovered);
      next.data.nodes = next.data.nodes!.map((n) => (states[n.id]?.length ? { ...n, states: states[n.id] } : n));
      next.data.edges = next.data.edges!.map((d) => (states[d.id!]?.length ? { ...d, states: states[d.id!] } : d));
      next.plugins = decoratePlugins(next.plugins as any[], bubbles);
    }
    return next;
  };

  const render = () => {
    if (graph.destroyed || !options.data) return;
    hovered = null;
    pointerKey = '';
    // 单选模式：换数据时清掉上一份数据的选中（id 相同的元素在 setOptions 后会保留原状态）
    if (!multi && selected) {
      selected = null;
      selection = EMPTY_SELECTION;
      applySelection();
    }
    spec = buildSpec();
    // 布局控制器在首次 render 时才创建；换数据前停掉上一轮的力导迭代
    if ((graph as any).context.layout) graph.stopLayout();
    graph.setOptions({
      data: spec.data,
      node: spec.node,
      edge: spec.edge,
      layout: spec.layout,
      plugins: spec.plugins,
    });
    scheduleRender();
  };

  // 只重绘：节点、连线样式与轮廓配置换成新的，节点位置不变
  const restyle = (redrawContours: boolean) => {
    if (graph.destroyed || !options.data || !spec) return;
    const prevKeys = new Set((spec.plugins as any[]).map((p) => p.key));
    const next = toG6Spec(options.data, options);
    const { bubbles } = selectionStyles(next, selection, hovered);
    next.plugins = decoratePlugins(next.plugins as any[], bubbles);
    // 元素状态已在画布上，沿用当前 spec 的数据（含 states）
    spec = { ...next, data: spec.data };
    graph.setNode(next.node);
    graph.setEdge(next.edge);
    graph.setPlugins(next.plugins);
    withoutContourUpdate(() => graph.draw())
      .then(() => {
        updateCulledLabels();
        (next.plugins as any[]).forEach((p) => {
          if (p.type === HOVER_BUBBLE_SETS && (redrawContours || !prevKeys.has(p.key))) {
            (graph.getPluginInstance(p.key) as any)?.redraw();
          }
        });
      })
      .catch(() => undefined);
  };

  // 推迟到微任务再 render，同一轮的多次更新只 render 一次；其间已被销毁（如 React StrictMode 挂载后立即卸载）则跳过，
  // 否则 G6 会报 "The graph instance has been destroyed"
  let renderPending = false;
  // 每次 render 的编号：上一次的布局还没算完就换了数据（如打开子图后立即自动隐藏实体）时，旧布局写回位置会因节点已删除而失败，
  // 这种被新 render 取代的失败不报告
  let renderSeq = 0;
  // 进行中的 render：期间销毁实例时，G6 在画布初始化之后仍会访问已销毁的画布（未捕获的 getCamera 异常），等它结束再销毁
  let inflight: Promise<unknown> | null = null;
  let disposed = false;
  // 撑满画布时限制放大倍数：超过上限就按上限缩放并居中
  const clampFitZoom = async () => {
    const max = options.maxFitZoom ?? 2;
    if (graph.destroyed || !isFitView(options.autoFit) || graph.getZoom() <= max) return;
    await graph.zoomTo(max, false);
    await graph.fitCenter(false);
  };
  // 布局完成后放置淡出实体（关联实体的中心附近的空位）并加上虚线，初始不显示
  const addFaded = async () => {
    if (graph.destroyed || !spec?.faded.nodes.length) return;
    const style = spec.node.style as any;
    const sizeOf = (d: any) => {
      const size = typeof style.size === 'function' ? style.size(d) : style.size;
      return Array.isArray(size) ? Math.max(...size) : size || 20;
    };
    const drawn = spec.data.nodes!.map((d) => {
      const [x, y] = graph.getElementPosition(d.id);
      return { id: d.id, x, y, r: sizeOf(d) / 2 };
    });
    const positions = placeFaded(
      spec.faded.nodes.map((d) => ({ id: d.id, r: sizeOf(d) / 2 })),
      drawn,
      spec.faded.links,
    );
    fadedPlaced = true;
    const states = fadedStates();
    graph.addData({
      nodes: spec.faded.nodes.map((d) => ({
        ...d,
        style: { ...positions.get(d.id), pointerEvents: 'none' },
        states: states[d.id],
      })),
      edges: spec.faded.links.map(({ id, source, target }) => ({
        id,
        source,
        target,
        style: { lineDash: [4, 3], pointerEvents: 'none' },
        states: states[id],
      })),
    });
    await withoutContourUpdate(() => graph.draw());
  };

  const scheduleRender = () => {
    if (renderPending) return;
    renderPending = true;
    queueMicrotask(() => {
      renderPending = false;
      // 实例在布局迭代中被销毁（换数据、卸载）时 render 会 reject
      if (!graph.destroyed && !disposed) {
        const seq = ++renderSeq;
        const current = graph
          .render()
          .then(async () => {
            if (seq !== renderSeq || disposed) return;
            await clampFitZoom();
            if (seq !== renderSeq || disposed) return;
            await addFaded();
            if (seq !== renderSeq || disposed) return;
            updateCulledLabels();
          })
          .catch((e) => {
            if (seq === renderSeq && !graph.destroyed && !disposed) console.warn('[hypergraph-viz] render failed', e);
          })
          .finally(() => {
            if (inflight === current) inflight = null;
          });
        inflight = current;
      }
    });
  };

  render();

  const themeChanged = (a?: Partial<HypergraphTheme>, b?: Partial<HypergraphTheme>) => {
    const ra = resolveTheme(a);
    const rb = resolveTheme(b);
    return LAYOUT_THEME_KEYS.some((k) => ra[k] !== rb[k]);
  };

  const view: HypergraphView = {
    graph,
    update(next) {
      const prev = options;
      options = { ...options, ...next };
      const changed = (k: keyof ViewOptions) => k in next && next[k] !== prev[k];
      const selectionChanged = changed('selection');
      if (selectionChanged) selection = options.selection ?? EMPTY_SELECTION;

      if (!spec || LAYOUT_KEYS.some(changed) || (changed('theme') && themeChanged(prev.theme, options.theme))) {
        const hadSelection = !!selected;
        render();
        if (hadSelection) options.onSelect?.(null);
      } else if (STYLE_KEYS.some(changed)) {
        restyle(changed('contourBounds'));
      } else if (selectionChanged) {
        applySelection();
      }
    },
    select(id) {
      if (id === null) return setSelected(null);
      const he = spec?.hyperedges.get(id);
      if (!he) return;
      const [a, b] = he.members;
      setSelected(
        he.members.length === 2
          ? { kind: 'edge', id: pairId(a, b), members: he.members, item: he, hyperedges: [he.id] }
          : { kind: 'hyperedge', id: he.id, members: he.members, item: he },
      );
    },
    hover(target) {
      const next = isEmptySelection(target) ? null : target;
      if (!next && !hovered) return;
      hovered = next;
      applySelection();
    },
    async fitView(animate = true) {
      if (graph.destroyed || !spec) return;
      const max = options.maxFitZoom ?? 2;
      await graph.fitView(undefined, animate ? { duration: 300 } : false);
      if (graph.getZoom() > max) {
        await graph.zoomTo(max, false);
        await graph.fitCenter(false);
      }
    },
    destroy() {
      disposed = true;
      clearTimeout(recullTimer);
      observer.disconnect();
      container.removeEventListener('pointerleave', onLeave);
      spec = null;
      window.removeEventListener('pointerdown', onTouchDown, true);
      window.removeEventListener('pointermove', onTouchMove, true);
      window.removeEventListener('pointerup', onTouchUp, true);
      window.removeEventListener('pointercancel', onTouchUp, true);
      window.removeEventListener('touchstart', onTouchEvent, true);
      window.removeEventListener('touchmove', onTouchEvent, true);
      cancelAnimationFrame(frame);
      host.remove();
      if (inflight) inflight.finally(() => destroyGraph(graph));
      else destroyGraph(graph);
    },
  };
  return view;
};
