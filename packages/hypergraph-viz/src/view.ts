import type { GraphOptions, ID } from '@antv/g6';
import { Graph } from '@antv/g6';
import { BUBBLE_SETS_TARGET, HOVER_BUBBLE_SETS, SUPPRESS_CONTOUR_UPDATE } from './hover-bubble-sets';
import { registerHypergraph } from './register';
import type { Selection } from './selection';
import { EMPTY_SELECTION, isEmptySelection, nextSelection, selectionStyles } from './selection';
import type { HyperedgeItem, HypergraphData, HypergraphSpec, SpecOptions } from './spec';
import { pairId, toG6Spec } from './spec';
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
  | { kind: 'node'; id: ID; item: Record<string, any> }
  | { kind: 'edge' | 'hyperedge'; id: ID; members: ID[]; item: HyperedgeItem; hyperedges?: ID[] };

export interface ViewOptions extends SpecOptions {
  data?: HypergraphData;
  /** 容器没有高度时的画布高度 / canvas height when the container has none */
  fallbackHeight?: number;
  autoFit?: GraphOptions['autoFit'];
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
  destroy(): void;
}

// 变化时需要重新布局的选项；其余（颜色、轮廓）只重绘
const LAYOUT_KEYS = ['data', 'mode', 'centerNode', 'graphEdges', 'labelText', 'layout', 'nodeSizeBy'] as const;
const STYLE_KEYS = ['typeField', 'typeColors', 'nodeColors', 'hyperedgeColors', 'contours', 'contourBounds', 'theme'] as const;
// 影响布局的主题项（节点尺寸、标签字号）
const LAYOUT_THEME_KEYS: (keyof HypergraphTheme)[] = ['nodeSize', 'largeNodeSize', 'largeGraphThreshold', 'labelFontSize'];

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
      return node ? { kind: 'node', id: node.id, item: node } : null;
    }
    if (e.targetType === 'edge') {
      const edge = spec.data.edges!.find((d) => d.id === e.target.id);
      if (!edge) return null;
      const { source, target, ...rest } = edge;
      const members = [source, target];
      const hyperedges = spec.lineHyperedges.get(edge.id!) || [];
      // 连线上不带 type 等保留字段，从产生它的超边补回
      const owner = spec.hyperedges.get(hyperedges[0]);
      return {
        kind: 'edge',
        id: edge.id!,
        members,
        item: { ...owner, ...rest, id: edge.id, members },
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

  // 高亮选中的实体 / 超边，无关的实体、连线、轮廓变淡；未选中时全部恢复
  const applySelection = () => {
    if (!spec) return;
    const { states, bubbles } = selectionStyles(spec, selection, hovered);
    withoutContourUpdate(() => graph.setElementState(states, false)).catch(() => undefined);
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
    const hit = hitOf(e);
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

  graph.on('pointermove', (e: any) => {
    if (!options.onHover) return;
    const hit = e.client ? hitOf(e) : null;
    options.onHover(hit ? { ...hit, client: { x: e.client.x, y: e.client.y } } : null);
  });

  const onLeave = () => options.onHover?.(null);
  container.addEventListener('pointerleave', onLeave);

  const observer = new ResizeObserver(() => {
    if (!graph.destroyed && container.offsetWidth && container.offsetHeight) {
      graph.setSize(container.offsetWidth, container.offsetHeight);
    }
  });
  observer.observe(container);

  // 新数据的 spec，并把当前选择写进元素初始状态与轮廓透明度
  const buildSpec = () => {
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
  const scheduleRender = () => {
    if (renderPending) return;
    renderPending = true;
    queueMicrotask(() => {
      renderPending = false;
      // 实例在布局迭代中被销毁（换数据、卸载）时 render 会 reject
      if (!graph.destroyed) graph.render().catch((e) => console.warn("[hypergraph-viz] render failed", e));
    });
  };

  render();

  const themeChanged = (a?: Partial<HypergraphTheme>, b?: Partial<HypergraphTheme>) => {
    const ra = resolveTheme(a);
    const rb = resolveTheme(b);
    return LAYOUT_THEME_KEYS.some((k) => ra[k] !== rb[k]);
  };

  return {
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
    destroy() {
      observer.disconnect();
      container.removeEventListener('pointerleave', onLeave);
      spec = null;
      destroyGraph(graph);
      host.remove();
    },
  };
};
