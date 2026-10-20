// <script> 页面（如 Hypergraph-DB viewer）用的面板全局版：读取 window.React / window.ReactDOM / window.G6，
// 暴露 window.HypergraphViz（核心 API + 面板组件 + mountExplorer）
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { HypergraphExplorerProps } from './explorer';
import { HypergraphExplorer } from './explorer';

export * from './index';
export * from './explorer';
export { HypergraphView } from './react';

/**
 * <zh/> 在 el 中挂载 HypergraphExplorer，返回 update（合并新的 props 重新渲染）与 unmount
 *
 * <en/> Mount HypergraphExplorer into el; update merges new props and re-renders
 */
export const mountExplorer = (el: Element, props: HypergraphExplorerProps) => {
  const root = createRoot(el);
  let current = props;
  const render = () => root.render(createElement(HypergraphExplorer, current));
  render();
  return {
    update(next: Partial<HypergraphExplorerProps>) {
      current = { ...current, ...next };
      render();
    },
    unmount: () => root.unmount(),
  };
};
