import { defineConfig } from 'tsup';

// React UMD 包没有 jsx-runtime：用 window.React.createElement 实现 jsx / jsxs（jsxs 的 children 为静态数组，展开传入）
const JSX_RUNTIME = `
const React = window.React;
const create = (type, props, key, spread) => {
  const { children, ...rest } = props || {};
  if (key !== undefined) rest.key = key;
  if (children === undefined) return React.createElement(type, rest);
  return spread && Array.isArray(children) ? React.createElement(type, rest, ...children) : React.createElement(type, rest, children);
};
module.exports = {
  Fragment: React.Fragment,
  jsx: (type, props, key) => create(type, props, key, false),
  jsxs: (type, props, key) => create(type, props, key, true),
};
`;

export default defineConfig([
  {
    // node：Node 端无头渲染（Playwright），不进浏览器包 / node: headless rendering for Node (Playwright)
    entry: { index: 'src/index.ts', react: 'src/react.tsx', explorer: 'src/explorer.ts', admin: 'src/admin.ts', node: 'src/node.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    splitting: true,
    sourcemap: true,
    external: ['@antv/g6', 'react', 'react-dom', 'playwright', '@napi-rs/canvas'],
    // node 入口用到 import.meta.url，CJS 版需要垫片 / the node entry uses import.meta.url, shimmed for CJS
    shims: true,
  },
  // 经 <script> 引入的页面（如 Hypergraph-DB viewer）：读取全局 G6（UMD 包的 window.G6），暴露 window.HypergraphViz
  {
    entry: { 'hypergraph-viz': 'src/index.ts' },
    format: ['iife'],
    globalName: 'HypergraphViz',
    sourcemap: true,
    // 经 CDN 直接加载，压缩体积
    minify: true,
    esbuildPlugins: [
      {
        name: 'g6-global',
        setup(build) {
          build.onResolve({ filter: /^@antv\/g6$/ }, () => ({ path: 'g6', namespace: 'g6-global' }));
          build.onLoad({ filter: /.*/, namespace: 'g6-global' }, () => ({ contents: 'module.exports = window.G6;' }));
        },
      },
    ],
  },
  // 面板全局版（超图浏览器与管理后台）：React、ReactDOM、G6 都取页面上的全局变量（UMD 包）
  {
    entry: { 'hypergraph-viz.explorer': 'src/explorer-global.ts' },
    format: ['iife'],
    globalName: 'HypergraphViz',
    sourcemap: true,
    minify: true,
    // 不清空 dist：与上面两项并行构建
    clean: false,
    esbuildPlugins: [
      {
        name: 'umd-globals',
        setup(build) {
          const globals: Record<string, string> = {
            '@antv/g6': 'window.G6',
            react: 'window.React',
            'react-dom': 'window.ReactDOM',
            'react-dom/client': 'window.ReactDOM',
          };
          build.onResolve({ filter: /^(@antv\/g6|react|react-dom|react-dom\/client|react\/jsx-runtime)$/ }, (args) => ({
            path: args.path,
            namespace: 'umd-global',
          }));
          build.onLoad({ filter: /.*/, namespace: 'umd-global' }, (args) => ({
            contents: args.path === 'react/jsx-runtime' ? JSX_RUNTIME : `module.exports = ${globals[args.path]};`,
          }));
        },
      },
    ],
  },
]);
