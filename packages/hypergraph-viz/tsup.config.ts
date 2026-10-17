import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts', react: 'src/react.tsx' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    splitting: true,
    sourcemap: true,
    external: ['@antv/g6', 'react'],
  },
  // 经 <script> 引入的页面（如 Hypergraph-DB viewer）：读取全局 G6（UMD 包的 window.G6），暴露 window.HypergraphViz
  {
    entry: { 'hypergraph-viz': 'src/index.ts' },
    format: ['iife'],
    globalName: 'HypergraphViz',
    sourcemap: true,
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
]);
