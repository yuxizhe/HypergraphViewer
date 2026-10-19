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

### 多选、隐藏与样式

```tsx
import { filterHypergraph, hyperedgeColorsOf, hypergraphStats } from 'hypergraph-viz';

const stats = hypergraphStats(graph);                          // 度数、超边大小分布、类型构成、连通分量、枢纽实体
const visible = filterHypergraph(graph, { nodes: hiddenIds }); // 去掉隐藏元素，超边保留原 id
const colors = hyperedgeColorsOf(graph);                       // 在完整数据上按 id 取色，隐藏后颜色不变

<HypergraphView
  ref={viewRef}                      // viewRef.current.hover({ nodes: [id] }) 临时高亮
  data={visible}
  hyperedgeColors={colors}
  nodeColors={{ [id]: '#ff0000' }}   // 单个实体颜色，优先于类型颜色
  contours contourBounds="key"       // 是否画轮廓；'key' 只圈节点，'render' 含标签
  nodeSizeBy="degree"
  layout={{ type: 'hypergraph', nodeSpacing: 50, preventLabelOverlap: true, useCenter: true }}
  selection={{ nodes: [...], hyperedges: [...] }}
  onSelectionChange={(selection, { additive, hit }) => ...}  // 挂载时传入即启用多选：点击单选，Shift 增删
/>
```

### 标签、悬停与视口

```tsx
<HypergraphView
  data={visible}
  hoverHighlight                     // 指针悬停在实体 / 超边上时高亮，同 hover()
  autoFit="view" fixLabelSize        // 渲染后缩放撑满画布；标签字号不随缩放变化
  labelBy="degree"                   // 子图内度数越大，标签字号越大、颜色越深
  hideOverlappingLabels              // 与更重要的标签重叠的标签不显示（悬停、选中时显示）
  layout={{ type: 'hypergraph', preventLabelOverlap: false }}
  fadedNodes={hubIds}                // 枢纽淡出：不参与布局；悬停与它相关的实体时淡入并连线
/>
viewRef.current.fitView();           // 视图居中
```

`layout.type` 还可以是 `'force'`（改造前的力导 + 主超边聚类）、`'force-atlas2'`、`'circular'`。
数据或布局相关选项变化时重新布局；只有颜色、轮廓、主题配色变化时只重绘，节点位置不变。
对象类选项（`typeColors`、`layout`、`theme` 等）需由宿主保持引用稳定（`useMemo`）。

## 不用框架

```ts
import { createHypergraphView } from 'hypergraph-viz';
const view = createHypergraphView(container, { data, mode: 'hyper', onHover, onSelect });
view.update({ data: next });
view.select(hyperedgeId);
view.hover({ hyperedges: [hyperedgeId] }); // null 取消
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
