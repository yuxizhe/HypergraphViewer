import type { CSSProperties, ReactNode } from 'react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Toolbar, type ToolbarOptions } from './toolbar';
import type { HypergraphView as View, ViewOptions } from './view';
import { createHypergraphView } from './view';

export type { ToolbarOptions } from './toolbar';
export type { IncidenceMatrixHandle, IncidenceMatrixViewProps } from './matrix-view';
export { IncidenceMatrixView } from './matrix-view';

// 与 HypergraphViewer 默认渲染设置一致：撑满画布、指针悬停高亮、标签字号不随缩放变化；节点大小、标签字号与颜色按度数分级；
// 布局不为标签让位，重叠的标签不显示（悬停、选中时显示）
const EXPLORER_PRESET: Partial<ViewOptions> = {
  autoFit: 'view',
  hoverHighlight: true,
  fixLabelSize: true,
  nodeSizeBy: 'degree',
  labelBy: 'degree',
  hideOverlappingLabels: true,
  layout: { type: 'hypergraph', preventLabelOverlap: false },
};

export interface HypergraphViewProps extends ViewOptions {
  /**
   * <zh/> 'explorer'：与超图浏览器（HypergraphViewer）相同的渲染参数作为默认值，单独传的选项优先
   *
   * <en/> 'explorer': default to the explorer's render options; options passed explicitly win
   */
  preset?: 'explorer';
  /**
   * <zh/> 右上角工具栏（放大、缩小、视图居中、全屏）；true 为默认样式
   *
   * <en/> zoom / fit / full-screen toolbar at the top right; true for the default look
   */
  toolbar?: boolean | ToolbarOptions;
  className?: string;
  style?: CSSProperties;
  /** 画在画布上方的浮层（随视图一起全屏）/ overlays drawn above the canvas, kept in full screen */
  children?: ReactNode;
}

/**
 * <zh/> 超图视图 React 组件。Graph 实例只创建一次，数据或选项变化时复用实例重新布局；
 * 悬停卡片、详情面板由宿主根据 onHover / onSelect 自行渲染。onSelectionChange 在挂载时传入才启用多选模式
 *
 * <en/> React component for the hypergraph view. The Graph is created once and re-laid out on data or option changes;
 * the host renders tooltips and detail panels from onHover / onSelect
 */
export const HypergraphView = forwardRef<View | null, HypergraphViewProps>(function HypergraphView(
  { className, style, onHover, onSelect, onSelectionChange, preset, toolbar, children, ...own },
  ref,
) {
  const options: ViewOptions = preset === 'explorer' ? { ...EXPLORER_PRESET, ...own } : own;
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View | null>(null);
  // 回调经 ref 读取最新值，变化时不重新布局
  const callbacks = useRef({ onHover, onSelect, onSelectionChange });
  callbacks.current = { onHover, onSelect, onSelectionChange };

  // 视图在 useEffect 中才创建，晚于 useImperativeHandle；对外给一个转发到当前视图的对象
  useImperativeHandle(
    ref,
    () => ({
      get graph() {
        return viewRef.current!.graph;
      },
      update: (next) => viewRef.current?.update(next),
      select: (id) => viewRef.current?.select(id),
      hover: (target) => viewRef.current?.hover(target),
      fitView: async (animate) => viewRef.current?.fitView(animate),
      destroy: () => viewRef.current?.destroy(),
    }),
    [],
  );

  useEffect(() => {
    const view = createHypergraphView(containerRef.current!, {
      fallbackHeight: options.fallbackHeight,
      autoFit: options.autoFit,
      maxFitZoom: options.maxFitZoom,
      fitPadding: options.fitPadding,
      fixLabelSize: options.fixLabelSize,
      hoverHighlight: options.hoverHighlight,
      behaviors: options.behaviors,
      onHover: (hit) => callbacks.current.onHover?.(hit),
      onSelect: (hit) => callbacks.current.onSelect?.(hit),
      onSelectionChange: onSelectionChange
        ? (selection, info) => callbacks.current.onSelectionChange?.(selection, info)
        : undefined,
    });
    viewRef.current = view;
    return () => {
      viewRef.current = null;
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 对象类选项需由宿主保持引用稳定（useMemo），否则每次渲染都会重新布局
  const {
    data, mode, centerNode, typeField, typeColors, graphEdges, labelText, theme,
    nodeColors, hyperedgeColors, contours, contourBounds, nodeSizeBy, labelBy, hideOverlappingLabels, fadedNodes, layout, selection,
  } = options;
  useEffect(() => {
    viewRef.current?.update({
      data, mode, centerNode, typeField, typeColors, graphEdges, labelText, theme,
      nodeColors, hyperedgeColors, contours, contourBounds, nodeSizeBy, labelBy, hideOverlappingLabels, fadedNodes, layout, selection,
    });
  }, [
    data, mode, centerNode, typeField, typeColors, graphEdges, labelText, theme,
    nodeColors, hyperedgeColors, contours, contourBounds, nodeSizeBy, labelBy, hideOverlappingLabels, fadedNodes, layout, selection,
  ]);

  const toolbarOptions = toolbar === true ? {} : toolbar || null;
  const fullscreenTarget =
    toolbarOptions?.fullscreen === false ? null : typeof toolbarOptions?.fullscreen === 'object' ? toolbarOptions.fullscreen : rootRef;
  // 视图自己全屏时铺满屏幕，需要不透明的背景
  const [ownFullscreen, setOwnFullscreen] = useState(false);
  const hasToolbar = !!toolbarOptions;
  useEffect(() => {
    if (!hasToolbar) return;
    const onChange = () => setOwnFullscreen(!!rootRef.current && document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [hasToolbar]);

  return (
    <div
      ref={rootRef}
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', ...(ownFullscreen && { background: '#fff' }), ...style }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {toolbarOptions && <Toolbar viewRef={viewRef} target={fullscreenTarget} options={toolbarOptions} />}
      {children}
    </div>
  );
});
