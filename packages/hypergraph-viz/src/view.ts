import type { GraphOptions, ID } from '@antv/g6';
import { Graph } from '@antv/g6';
import { BUBBLE_SETS_TARGET, HOVER_BUBBLE_SETS } from './hover-bubble-sets';
import { registerHypergraph } from './register';
import type { HyperedgeItem, HypergraphData, HypergraphSpec, SpecOptions } from './spec';
import { pairId, toG6Spec } from './spec';
import { resolveTheme } from './theme';

/**
 * <zh/> 悬停 / 点击命中的元素。连线是 2 元超边（或图模式下拆出的一对成员），轮廓是 3 元及以上的超边
 *
 * <en/> Element under the pointer or clicked. A line is a 2-member hyperedge, a contour one with 3+ members
 */
export type HypergraphHit =
  | { kind: 'node'; id: ID; item: Record<string, any> }
  | { kind: 'edge' | 'hyperedge'; id: ID; members: ID[]; item: HyperedgeItem };

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
}

export interface HypergraphView {
  readonly graph: Graph;
  /** 更新数据或选项，复用同一个 Graph 实例重新布局 / update data or options and re-layout with the same Graph */
  update(options: Partial<ViewOptions>): void;
  /** 选中超边（id 为超边 id），null 取消 / select a hyperedge by id, null to clear */
  select(id: ID | null): void;
  destroy(): void;
}

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
  let spec: HypergraphSpec | null = null;
  let selected: Extract<HypergraphHit, { kind: 'edge' | 'hyperedge' }> | null = null;

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
      return { kind: 'edge', id: edge.id!, members, item: { ...rest, id: edge.id, members } };
    }
    if (e.targetType === BUBBLE_SETS_TARGET) {
      const item: HyperedgeItem = e.target.options?.hyperedge;
      return item ? { kind: 'hyperedge', id: item.id!, members: item.members, item } : null;
    }
    return null;
  };

  // 高亮选中的超边及其成员实体，其余实体、连线、超边轮廓变淡；未选中时全部恢复
  const applySelection = () => {
    if (!spec) return;
    const { bubble } = resolveTheme(options.theme);
    const members = new Set(selected?.members);
    const states: Record<ID, string[]> = {};
    spec.data.nodes!.forEach((n) => {
      states[n.id] = !selected ? [] : members.has(n.id) ? ['highlight'] : ['inactive'];
    });
    spec.data.edges!.forEach((d) => {
      states[d.id!] = !selected ? [] : selected.kind === 'edge' && d.id === selected.id ? ['highlight'] : ['inactive'];
    });
    graph.setElementState(states, false);
    graph.setPlugins((plugins) =>
      plugins.map((p: any) =>
        p.type !== HOVER_BUBBLE_SETS
          ? p
          : {
              ...p,
              ...(!selected
                ? bubble.normal
                : selected.kind === 'hyperedge' && p.hyperedge?.id === selected.id
                  ? bubble.highlight
                  : bubble.dimmed),
            },
      ),
    );
  };

  const setSelected = (next: typeof selected) => {
    selected = next;
    applySelection();
    options.onSelect?.(selected);
  };

  graph.on('click', (e: any) => {
    if (e.targetType === 'node') return;
    const hit = hitOf(e);
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

  const render = () => {
    if (graph.destroyed || !options.data) return;
    // id 相同的元素在 setOptions 后保留原状态，先清掉上一份数据的选中高亮
    if (selected) {
      selected = null;
      applySelection();
    }
    spec = toG6Spec(options.data, options);
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

  // 推迟到微任务再 render，同一轮的多次更新只 render 一次；其间已被销毁（如 React StrictMode 挂载后立即卸载）则跳过，
  // 否则 G6 会报 "The graph instance has been destroyed"
  let renderPending = false;
  const scheduleRender = () => {
    if (renderPending) return;
    renderPending = true;
    queueMicrotask(() => {
      renderPending = false;
      // 实例在布局迭代中被销毁（换数据、卸载）时 render 会 reject
      if (!graph.destroyed) graph.render().catch(() => undefined);
    });
  };

  render();

  return {
    graph,
    update(next) {
      options = { ...options, ...next };
      const hadSelection = !!selected;
      render();
      if (hadSelection) options.onSelect?.(null);
    },
    select(id) {
      if (id === null) return setSelected(null);
      const he = spec?.hyperedges.get(id);
      if (!he) return;
      const [a, b] = he.members;
      setSelected(
        he.members.length === 2
          ? { kind: 'edge', id: pairId(a, b), members: he.members, item: he }
          : { kind: 'hyperedge', id: he.id, members: he.members, item: he },
      );
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
