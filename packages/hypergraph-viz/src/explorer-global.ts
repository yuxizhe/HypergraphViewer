// <script> 页面（如 Hypergraph-DB 的查看器与管理后台）用的面板全局版：读取 window.React / window.ReactDOM / window.G6，
// 暴露 window.HypergraphViz（核心 API + 面板组件 + mountExplorer / mountAdmin）
import type { ComponentType } from 'react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { HypergraphExplorerProps } from './explorer';
import { HypergraphExplorer } from './explorer';
import type { HypergraphAdminProps } from './admin';
import { HypergraphAdmin } from './admin';

export * from './index';
export * from './explorer';
export * from './admin';
export { HypergraphView } from './react';

// 在 el 中挂载组件，返回 update（合并新的 props 重新渲染）与 unmount
const mount = <P extends object>(component: ComponentType<P>, el: Element, props: P) => {
  const root = createRoot(el);
  let current = props;
  const render = () => root.render(createElement(component, current));
  render();
  return {
    update(next: Partial<P>) {
      current = { ...current, ...next };
      render();
    },
    unmount: () => root.unmount(),
  };
};

/**
 * <zh/> 在 el 中挂载 HypergraphExplorer，返回 update（合并新的 props 重新渲染）与 unmount
 *
 * <en/> Mount HypergraphExplorer into el; update merges new props and re-renders
 */
export const mountExplorer = (el: Element, props: HypergraphExplorerProps) => mount(HypergraphExplorer, el, props);

/**
 * <zh/> 在 el 中挂载 HypergraphAdmin（管理后台），返回 update 与 unmount
 *
 * <en/> Mount HypergraphAdmin into el
 */
export const mountAdmin = (el: Element, props: HypergraphAdminProps) => mount(HypergraphAdmin, el, props);
