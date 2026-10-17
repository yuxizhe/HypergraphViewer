# hypergraph-viz

基于 G6 v5 的超图渲染：超图布局（HypergraphLayout）、只圈节点的超边轮廓、悬停与点击高亮。
HypergraphViewer、Hyper-RAG web-ui、Hypergraph-DB viewer 共用这一份实现。

`@antv/g6`（5.0.x）为 peer 依赖，扩展注册在宿主项目自己的 G6 上，需确保项目中只有一份 G6。

## 输入格式

```ts
{ vertices: { [id]: { entity_type?, description?, ... } },
  hyperedges: [{ id?, members: [id, ...], weight?, keywords?, summary?, ... }] }
```

2 个成员的超边画成连线，3 个及以上画成轮廓。Hyper-RAG / Hypergraph-DB 的 `{ vertices, edges }`（edge key 为 `|#|` 拼接的成员）用 `fromKeyedEdges` 转换。

## React

```tsx
import { fromKeyedEdges } from 'hypergraph-viz';
import { HypergraphView } from 'hypergraph-viz/react';

<HypergraphView
  data={fromKeyedEdges(graph)}
  mode="hyper"             // 或 'graph'
  centerNode={vertexId}
  onHover={(hit) => ...}   // { kind: 'node' | 'edge' | 'hyperedge', id, item, client } | null
  onSelect={(hit) => ...}  // 点击超边选中，再点或点空白处取消
/>
```

## 不用框架

```ts
import { createHypergraphView } from 'hypergraph-viz';
const view = createHypergraphView(container, { data, mode: 'hyper', onHover, onSelect });
view.update({ data: next });
view.select(hyperedgeId);
view.destroy();
```

## `<script>` 页面

先引入 G6 的 UMD 包（`window.G6`），再引入 `dist/hypergraph-viz.global.js`，全局变量为 `window.HypergraphViz`。

## 只用其中一部分

`registerHypergraph()` 注册 `'hypergraph'` 布局与 `'hover-bubble-sets'` 插件，`toG6Spec(data, options)` 生成 G6 的 data / node / edge / layout / plugins，可自行创建 Graph。

## 开发

```sh
npm run build -w hypergraph-viz   # 在 HypergraphViewer 根目录
npm test -w hypergraph-viz        # 与迁移前实现（test/legacy）对照
```
