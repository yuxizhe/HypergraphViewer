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

### 图模式与二部图

`mode="graph"` 只画连线、力导布局。3 个及以上成员的超边由 `graphEdges` 决定：`'binary'`（默认）丢弃，`'clique'` 拆成两两连线，
`'star'` 画成一个菱形的超边节点、连向各成员（二部图 / 关联图，同 SimpleHypergraphs.jl、HAT 的画法）。超边节点的边长与成员数成正比（3 个成员与实体节点一样大，最大为 3 倍），节点与连线用该超边的颜色，
悬停、点击时按超边报告（`kind: 'hyperedge'`），选中、表格行悬停的高亮与轮廓一致。超边节点的 id 为 `hyperedgeNodeId(超边 id)`。

### 关联矩阵

```tsx
import { IncidenceMatrixView } from 'hypergraph-viz/react';

<IncidenceMatrixView
  data={graph}
  order="degree"                     // 'degree' 按度数 | 'type' 按类型分组 | 'cluster' 重心法聚类
  hyperedgeColors={colors}
  hubNodes={fadedIds}                // 行首画虚线圈，如画布上淡出的枢纽
  selection={selection}
  onSelectionChange={(selection, { additive, hit }) => ...}  // 点行选实体、点列选超边，Shift 增删，点左上角取消
  onHover={(hit) => ...}             // 与 HypergraphView 相同的命中格式
  toolbar                            // 放大、缩小（单元格大小）、适应、全屏
/>
```

一行一个实体、一列一条超边（含 2 元超边），成员处画点并用竖线连起（参考 HAT 的 incidence plot）。枢纽实体只是满格的一行，不会像画布那样把超边挤成一团。
行、列标题在滚动时固定；`ref` 提供 `hover` / `select` / `fitView` / `zoomBy`。只要排序结果可用 `incidenceMatrix(data, { order })`。

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

`layout.type` 还可以是 `'polygon'`（多边形画法，参考 HGPolyVis：在超图布局上优化，超边画成成员在角上的多边形）、
`'force'`（改造前的力导 + 主超边聚类）、`'force-atlas2'`、`'circular'`。
`overlapHubs(graph)` 贪心挑出造成注定重叠的隐含枢纽，可传给 `fadedNodes`；`forcedOverlaps(graph)` 统计注定重叠数。
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
  defaultRenderSettings={{ autoHideBy: 'off' }}   // 「渲染」设置的默认值；'off' 不自动隐藏枢纽（默认 'overlap' 按注定重叠挑隐含枢纽，'degree' 按 autoHideDegree）
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

文件可直接从 CDN 引入（版本号写死），如 `https://unpkg.com/hypergraph-viz@0.2.1/dist/hypergraph-viz.explorer.global.js`
与 `https://unpkg.com/hypergraph-viz@0.2.1/dist/style.css`。

## 模型可读（MR）模式与导出图片

给多模态模型看的画法：`modelReadable: true`（或 `{ vertexLabel: 'code' | 'code+name' }`）。开启后，实体和超边都带常显的短编号（v1、e1），轮廓只描边，标签不隐藏，淡出的枢纽写进图例。编号由 `modelReadableKey(data, { centerNode })` 生成，同一份数据每次结果相同。`modelReadableTable` 生成 Markdown 映射表，`incidenceMatrixSVG` 生成关联矩阵的 SVG 字符串。这三个函数都不依赖 DOM。

在浏览器里导出图片：`view.exportImage({ layout: 'canvas' | 'dual', width, locale })` 导出画布，或画布与矩阵并排；`exportMatrixImage(data, options)` 只导出矩阵。返回 PNG（data URL）、图例，以及标签在图片中的像素 `labelPx`。

Node 中用无头浏览器批量出图（需安装 `playwright`；它自带的浏览器没装时，改用系统 Chrome）：

```ts
import { createHeadlessRenderer } from 'hypergraph-viz/node';
const renderer = await createHeadlessRenderer();
const { png, table, labelPx } = await renderer.render({ data, centerNode, layout: 'dual', hideTypes: ['财季'], locale: 'zh' });
await renderer.close();
```

命令行：`node scripts/render-mr.mjs --hif nvda.hif.json --top 3 --layout canvas,matrix,dual --out out/`。每张图输出 PNG 和 `.md` 映射表，并写一份 `manifest.jsonl`，记录尺寸、`labelPx` 和用时。中文标签依赖系统字体，Linux 上需要安装 CJK 字体。

## 只用其中一部分

`registerHypergraph()` 注册 `'hypergraph'`、`'polygon'` 布局与 `'hover-bubble-sets'` 插件，`toG6Spec(data, options)` 生成 G6 的 data / node / edge / layout / plugins，可自行创建 Graph。

## 开发

```sh
npm run build -w hypergraph-viz   # 在 HypergraphViewer 根目录
npm test -w hypergraph-viz        # 与迁移前实现（test/legacy）对照
```
