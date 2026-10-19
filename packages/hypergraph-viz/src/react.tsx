import type { CSSProperties } from 'react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { HypergraphView as View, ViewOptions } from './view';
import { createHypergraphView } from './view';

export interface HypergraphViewProps extends ViewOptions {
  className?: string;
  style?: CSSProperties;
}

/**
 * <zh/> 超图视图 React 组件。Graph 实例只创建一次，数据或选项变化时复用实例重新布局；
 * 悬停卡片、详情面板由宿主根据 onHover / onSelect 自行渲染
 *
 * <en/> React component for the hypergraph view. The Graph is created once and re-laid out on data or option changes;
 * the host renders tooltips and detail panels from onHover / onSelect
 */
export const HypergraphView = forwardRef<View | null, HypergraphViewProps>(function HypergraphView(
  { className, style, onHover, onSelect, ...options },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View | null>(null);
  // 回调经 ref 读取最新值，变化时不重新布局
  const callbacks = useRef({ onHover, onSelect });
  callbacks.current = { onHover, onSelect };

  useImperativeHandle(ref, () => viewRef.current as View, []);

  useEffect(() => {
    const view = createHypergraphView(containerRef.current!, {
      fallbackHeight: options.fallbackHeight,
      autoFit: options.autoFit,
      behaviors: options.behaviors,
      onHover: (hit) => callbacks.current.onHover?.(hit),
      onSelect: (hit) => callbacks.current.onSelect?.(hit),
    });
    viewRef.current = view;
    return () => {
      viewRef.current = null;
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, mode, centerNode, typeField, typeColors, graphEdges, labelText, theme } = options;
  useEffect(() => {
    viewRef.current?.update({ data, mode, centerNode, typeField, typeColors, graphEdges, labelText, theme });
  }, [data, mode, centerNode, typeField, typeColors, graphEdges, labelText, theme]);

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%', ...style }} />;
});
