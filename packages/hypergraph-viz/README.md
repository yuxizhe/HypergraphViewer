# hypergraph-viz

基于 G6 v5 的超图渲染：超图布局（HypergraphLayout）、只圈节点的超边轮廓、悬停与点击高亮；另有带左右面板的超图浏览器。
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
  preset="explorer"        // 与超图浏览器相同的渲染参数（悬停高亮、按度数分级、重叠标签隐藏等），单独传的选项优先
  toolbar={{ size: 'small', locale: 'zh' }}  // 右上角工具栏：放大、缩小、视图居中、全屏；true 为默认样式
/>
```

工具栏样式是内联的，不需要引入样式表。全屏默认让视图自身全屏，`toolbar.fullscreen` 可指定更大的元素（`ref`），`false` 不显示全屏按钮；
放进 `<HypergraphView>` 的子元素画在画布上方，随视图一起全屏。宿主的悬停卡片若用 portal，全屏时应挂到 `document.fullscreenElement` 下。

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

## 超图浏览器（面板）

`hypergraph-viz/explorer` 是完整的浏览界面：左栏（数据库统计、实体列表、超边列表）、画布（悬停卡片、工具栏、已隐藏标签条）、
右栏（子图统计、实体与超边表、渲染设置、详情）。和只有画布的 `hypergraph-viz/react` 分开，只用画布的项目不会引入面板代码。

```tsx
import { createLocalSource, fromHIF, HypergraphExplorer, Section } from 'hypergraph-viz/explorer';
import 'hypergraph-viz/style.css';   // 选择器都限定在 .hv-root 下，宿主不需要装 Tailwind

<HypergraphExplorer
  source={createLocalSource(fromHIF(hif))}   // 换一个 source 对象即重新载入
  defaultCenter="STROKE"
  panels={{ database: true, inspector: true, header: true }}
  layout="auto"                              // 按自身宽度：≥ 1200 三栏；≥ 768 左栏抽屉、右栏浮层；更窄（手机）面板从底部弹出
  localeStorageKey="my-app-lang"             // 浏览器自己管理语言：记住选择，标题栏可切换；或传 locale + onLocaleChange 由宿主管理
  messages={{ zh: { neighborhoodCol: '度数' } }}   // 覆盖或补充界面文字
  defaultRenderSettings={{ autoHideDegree: 0 }}   // 「渲染」设置的默认值；0 表示不自动隐藏高度数实体（默认隐藏度数 > 30 的）
  storageKey="my-app"                        // 渲染设置、颜色存到 localStorage；false 不存
  title="My Hypergraph"
  databaseHeader={<Section title="数据源" open onToggle={...}>...</Section>}  // 左栏顶部插槽
/>
```

没有后端时用 `createLocalSource`（输入为 `fromHIF` / `parseHIF` / `loadHIFFromURL` / `loadHIFFromFile` 的结果，后两者也能读 Hypergraph-DB 的 `.hgdb` 文件）。
有后端时实现同样接口的数据源即可，`listHyperedges` 可省略（左栏就没有超边列表），`overview` 只给 `database` 时左栏只显示计数：

```ts
const source: HypergraphSource = {
  overview: async () => ({ database: { name, vertices, edges }, listedTypes }),
  listVertices: ({ page, pageSize, search, sortBy, sortOrder, types }) => fetchJSON(...),  // { data, pagination }
  subgraph: async (center) => fromKeyedEdges(await fetchJSON(...)),
};
```

想自己排布局时，用 `useHypergraphExplorer(options)` 拿到 `databaseProps` / `canvasProps` / `inspectorProps`，
分别交给 `DatabasePanel` / `GraphCanvas` / `InspectorPanel`。

样式：主色可在 `.hv-root` 上覆盖 `--color-primary-50 / 100 / 500 / 600 / 700`。预置样式在 `@layer hv-base` 中，
宿主用 Tailwind 4 时先引入本包样式，放进插槽的宿主组件可用自己的工具类覆盖它。

## 管理后台

`hypergraph-viz/admin` 是超图数据库的管理后台（与 Hypergraph-DB 的 `/admin` 相同）：概览统计、实体与超边的搜索和增删改查、HIF 导入 / 导出。

```tsx
import { createHttpAdminApi, HypergraphAdmin } from 'hypergraph-viz/admin';
import 'hypergraph-viz/style.css';

<HypergraphAdmin
  api={createHttpAdminApi('/api/admin', { params: { database } })}   // Hypergraph-DB 管理后台的 HTTP 格式
  viewerUrl="/viewer"                       // 可选：「超图可视化」页与实体详情中的查看器链接
  headerExtra={<DatabaseSelect />}          // 顶栏右侧插槽
  localeStorageKey="my-app-lang"            // 或 locale + onLocaleChange
/>
```

数据接口见 `HypergraphAdminApi`：`save`、`exportHIF`、`importHIF`、`subgraph` 可省略，省略时不显示对应功能
（没有 `save` 时每次修改即生效；有 `subgraph` 时实体详情中显示关系图）。后端不支持的功能从 `createHttpAdminApi` 的返回值中去掉即可，
如 `const { save, ...api } = createHttpAdminApi(url)`。

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

只用画布：先引入 G6 的 UMD 包（`window.G6`），再引入 `dist/hypergraph-viz.global.js`，全局变量为 `window.HypergraphViz`。

带面板（超图浏览器与管理后台）：依次引入 G6、React 18+、ReactDOM 的 UMD 包，再引入 `dist/hypergraph-viz.explorer.global.js` 与 `dist/style.css`：

```js
const { mountExplorer, mountAdmin, createHttpAdminApi } = window.HypergraphViz;
const explorer = mountExplorer(document.getElementById('root'), { source, localeStorageKey: 'my-app-lang' });
explorer.update({ defaultCenter: 'STROKE' });   // 合并新的 props 重新渲染
mountAdmin(document.getElementById('admin'), { api: createHttpAdminApi('/api/admin'), hashRouting: true });
```

文件可直接从 CDN 引入（版本号写死），如 `https://unpkg.com/hypergraph-viz@0.2.0/dist/hypergraph-viz.explorer.global.js`
与 `https://unpkg.com/hypergraph-viz@0.2.0/dist/style.css`。

## 只用其中一部分

`registerHypergraph()` 注册 `'hypergraph'` 布局与 `'hover-bubble-sets'` 插件，`toG6Spec(data, options)` 生成 G6 的 data / node / edge / layout / plugins，可自行创建 Graph。

## 开发

```sh
npm run build -w hypergraph-viz   # 在 HypergraphViewer 根目录
npm test -w hypergraph-viz        # 与迁移前实现（test/legacy）对照
```
