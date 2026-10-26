import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

// 中英文界面文字；与 Hypergraph-DB 查看器 / 管理后台用同一套术语（vertex → 实体，hyperedge → 超边）。
// 属性名（description、keywords 等）来自数据，不翻译
// eslint-disable-next-line react-refresh/only-export-components
export const MESSAGES = {
    en: {
        databaseInfo: "Database Information",
        verticesLabel: "Vertices:", hyperedgesLabel: "Hyperedges:", edgesLabel: "Edges:",
        searchList: "Search & Vertex List",
        searchPlaceholder: "Search vertex ID, type or description...",
        found: "Found {n} results", loadingVertices: "Loading vertices...", noMatch: "No matching vertices found",
        typeLabel: "Type:", idLabel: "ID:", degreeLabel: "Degree:",
        prev: "Previous", next: "Next",
        titleHyper: "Hypergraph Visualization", titleGraph: "Graph Visualization", titleMatrix: "Incidence Matrix",
        modeLabel: "Mode:", modeHyper: "Hypergraph", modeGraph: "Graph", modeMatrix: "Matrix",
        loadingGraph: "Loading hypergraph data...", loadingHint: "This may take a few seconds",
        loadFailed: "Failed to load graph data",
        detail: "Hypergraph Detail", hyperedge: "Hyperedge", edge: "Edge", node: "Node",
        partialDataNote: "The database has {v} vertices and {e} hyperedges; stats below cover the loaded subgraphs",
        typeClickHint: "Click a segment to filter the vertex list", neighborhoodCol: "Subgraph",
        hyperedgeSearchPlaceholder: "Search description, type or member...",
        navVertices: "Vertices", navSubgraph: "Subgraph", navDetails: "Details", close: "Close", more: "More", openDetails: "Details ›", tapToInspect: "Tap a vertex or hyperedge on the canvas to see its attributes",
        panelTitle: "Subgraph", tab_stats: "Stats", tab_matrix: "Incidence matrix", tab_nodes: "Vertices", tab_hyperedges: "Hyperedges", tab_render: "Render",
        collapsePanel: "Collapse panel", expandPanel: "Expand panel", noGraph: "No subgraph loaded",
        statVertices: "Vertices", statHyperedges: "Hyperedges", statLines: "Lines", statMaxSize: "Max size",
        statAvgDegree: "Avg degree", statComponents: "Components",
        typeComposition: "Vertex types", untyped: "Untyped",
        degreeDistribution: "Vertex degree", sizeDistribution: "Hyperedge size",
        histogramHint: "Click a bar or color segment to select those elements",
        hubWarning: "{n} hubs (in ≥50% of hyperedges)", hideAllHubs: "Hide all", showAllHubs: "Show all",
        degreeCol: "Degree", sizeCol: "Size", nameCol: "Name", all: "All",
        filterPlaceholder: "Filter...", selectAllShown: "Select all shown", noRows: "No matching rows",
        typeColor: "Type color", elementColor: "Color",
        show: "Show", hide: "Hide",
        badgeCenter: "center", badgeHub: "hub",
        noteMembersHidden: "members hidden", noteNotDrawnInGraph: "not drawn in graph mode",
        selectedCount: "Selected: {n} vertices, {m} hyperedges", showOnlySelected: "Show only", clearSelection: "Clear",
        hiddenLabel: "Hidden", restoreAll: "Restore all",
        fadedHint: "faded: left out of the layout; hover a linked vertex to see the link", fadedRelations: "Links to hub vertices",
        tagRelayout: "re-layout", tagRestyle: "restyle",
        groupLayout: "Layout", layoutAlgorithm: "Algorithm", layoutHypergraph: "Hypergraph layout",
        layoutForce: "Force", layoutCircular: "Circular", useCenter: "Center on selected vertex",
        nodeSpacing: "Node spacing",
        graphEdges: "3+ member hyperedges (graph)", graphEdgesBinary: "Drop", graphEdgesClique: "Clique", graphEdgesStar: "Hyperedge nodes",
        groupMatrix: "Matrix", matrixOrder: "Order", orderDegree: "By degree", orderType: "By type", orderCluster: "Clustered",
        matrixHint: "One row per vertex, one column per hyperedge; members are dots joined by a line. Dashed rings mark hubs faded on the canvas",
        forceHint: "Force + primary-hyperedge clustering: the layout used before HypergraphLayout",
        groupHyperedge: "Hyperedges", showContours: "Contours", contourBounds: "Contour bounds", contourNesting: "Nested", contourNestingHint: "Smaller hyperedges inside, larger ones outside: each contour a node is already in pushes the next one further out",
        labelStripType: "Strip prefix", labelStripTypeHint: "Drop everything up to the last colon: \"Period:NVDA:FY2026Q4\" → \"FY2026Q4\"; the type is shown by color",
        maxFitZoom: "Max zoom", maxFitZoomHint: "Fitting the graph to the canvas never zooms in beyond this, so small graphs are not blown up",
        boundsKey: "Nodes only", boundsRender: "With labels",
        hyperedgeColorBy: "Color by", byHyperedge: "Hyperedge", byHyperedgeType: "Type", fillOpacity: "Fill opacity",
        groupNode: "Vertices", nodeColorBy: "Color", byType: "By type", uniform: "Uniform",
        nodeSizeBy: "Size", sizeFixed: "Fixed", sizeDegree: "By degree",
        autoHideDegree: "Auto-hide degree >", autoHideDegreeHint: "When a subgraph opens, hide vertices in more of its hyperedges than this (the center included); 0 = off",
        groupLabel: "Labels", labelMode: "Show", labelAll: "All", labelKey: "Center & hubs", labelNone: "None",
        labelFontSize: "Font size", labelBy: "Style", labelUniform: "Uniform", labelByDegree: "By degree", labelOverlap: "Overlap", labelOverlapHide: "Hide", labelOverlapLayout: "Avoid in layout", labelOverlapAllow: "Allow", labelMaxLength: "Max length", labelMaxLengthHint: "Truncate longer labels (characters); 0 = no limit. Long labels stretch hyperedges when label overlap is prevented", resetSettings: "Reset settings", resetColors: "Reset colors",
    },
    zh: {
        databaseInfo: "数据库信息",
        verticesLabel: "实体：", hyperedgesLabel: "超边：", edgesLabel: "边：",
        searchList: "搜索与实体列表",
        searchPlaceholder: "搜索实体 ID、类型或描述...",
        found: "共找到 {n} 个结果", loadingVertices: "加载实体中...", noMatch: "没有匹配的实体",
        typeLabel: "类型：", idLabel: "ID：", degreeLabel: "度数：",
        prev: "上一页", next: "下一页",
        titleHyper: "超图可视化", titleGraph: "图可视化", titleMatrix: "关联矩阵",
        modeLabel: "模式：", modeHyper: "超图", modeGraph: "图", modeMatrix: "矩阵",
        loadingGraph: "加载超图数据中...", loadingHint: "可能需要几秒钟",
        loadFailed: "加载图数据失败",
        detail: "超图详情", hyperedge: "超边", edge: "边", node: "实体",
        partialDataNote: "数据库共 {v} 个实体、{e} 条超边；以下按已载入的子图统计",
        typeClickHint: "点色段筛选实体列表", neighborhoodCol: "子图",
        hyperedgeSearchPlaceholder: "搜索描述、类型或成员...",
        navVertices: "实体", navSubgraph: "子图", navDetails: "详情", close: "关闭", more: "更多", openDetails: "详情 ›", tapToInspect: "在画布上点一个实体或超边，这里显示它的属性",
        panelTitle: "当前子图", tab_stats: "统计", tab_matrix: "关联矩阵", tab_nodes: "实体", tab_hyperedges: "超边", tab_render: "渲染",
        collapsePanel: "收起面板", expandPanel: "展开面板", noGraph: "尚未加载子图",
        statVertices: "实体", statHyperedges: "超边", statLines: "连线", statMaxSize: "最大超边",
        statAvgDegree: "平均度数", statComponents: "连通分量",
        typeComposition: "实体类型构成", untyped: "未分类",
        degreeDistribution: "实体度数分布", sizeDistribution: "超边大小分布",
        histogramHint: "点柱子或色段即选中对应元素",
        hubWarning: "{n} 个枢纽（出现在 ≥50% 超边中）", hideAllHubs: "全部隐藏", showAllHubs: "全部显示",
        degreeCol: "度数", sizeCol: "大小", nameCol: "名称", all: "全部",
        filterPlaceholder: "表内筛选...", selectAllShown: "全选当前列表", noRows: "没有匹配的行",
        typeColor: "类型颜色", elementColor: "颜色",
        show: "显示", hide: "隐藏",
        badgeCenter: "中心", badgeHub: "枢纽",
        noteMembersHidden: "成员已隐藏", noteNotDrawnInGraph: "图模式不绘制",
        selectedCount: "已选 实体 {n} · 超边 {m}", showOnlySelected: "只看所选", clearSelection: "清除",
        hiddenLabel: "已隐藏", restoreAll: "全部恢复",
        fadedHint: "淡出：不参与布局，悬停与它相关的实体可查看关联", fadedRelations: "与枢纽实体的关联",
        tagRelayout: "重新布局", tagRestyle: "重绘",
        groupLayout: "布局", layoutAlgorithm: "布局算法", layoutHypergraph: "超图布局",
        layoutForce: "力导", layoutCircular: "环形", useCenter: "以中心实体为中心",
        nodeSpacing: "节点间距",
        graphEdges: "图模式下 3 元及以上超边", graphEdgesBinary: "丢弃", graphEdgesClique: "拆成两两连线", graphEdgesStar: "超边节点",
        groupMatrix: "矩阵", matrixOrder: "排序", orderDegree: "按度数", orderType: "按类型", orderCluster: "聚类",
        matrixHint: "一行一个实体、一列一条超边，成员处画点并用竖线连起；虚线圈为画布上淡出的枢纽",
        forceHint: "力导 + 主超边聚类：改用 HypergraphLayout 之前的布局",
        groupHyperedge: "超边", showContours: "显示轮廓", contourBounds: "轮廓范围", contourNesting: "嵌套轮廓", contourNestingHint: "小超边在内、大超边在外：节点每被包一层，外层轮廓在它周围多外扩一段",
        labelStripType: "去掉前缀", labelStripTypeHint: "去掉最后一个冒号及之前的部分，如「期间:NVDA:FY2026Q4」→「FY2026Q4」，类型由颜色表示",
        maxFitZoom: "最大放大", maxFitZoomHint: "适应画布时最多放大到该倍数，节点少的图不会被放大撑满",
        boundsKey: "只圈节点", boundsRender: "包含标签",
        hyperedgeColorBy: "着色", byHyperedge: "按超边", byHyperedgeType: "按类型", fillOpacity: "填充透明度",
        groupNode: "节点", nodeColorBy: "着色", byType: "按类型", uniform: "统一颜色",
        nodeSizeBy: "大小", sizeFixed: "固定", sizeDegree: "按度数",
        autoHideDegree: "自动隐藏度数 >", autoHideDegreeHint: "打开子图时，隐藏在子图中所在超边数超过该值的实体（含中心）；0 表示不隐藏",
        groupLabel: "标签", labelMode: "显示", labelAll: "全部", labelKey: "中心与枢纽", labelNone: "不显示",
        labelFontSize: "字号", labelBy: "样式", labelUniform: "统一", labelByDegree: "按度数", labelOverlap: "重叠时", labelOverlapHide: "隐藏", labelOverlapLayout: "布局避让", labelOverlapAllow: "允许重叠", labelMaxLength: "最大长度", labelMaxLengthHint: "标签超过该字符数时截断，0 表示不限。防止标签重叠时，过长的标签会把超边拉长", resetSettings: "恢复默认设置", resetColors: "恢复默认颜色",
    },
};
// eslint-disable-next-line react-refresh/only-export-components
export const LANGUAGES = [["en", "EN"], ["zh", "中文"]];

const I18nContext = createContext(null);

// locale：'en' | 'zh'；messages：{ en: {...}, zh: {...} }，覆盖或补充文字（宿主自己的组件放进面板插槽时也能用 useI18n 取到）
// setLang：切换语言的回调，传了时标题栏显示语言切换
export const I18nProvider = ({ locale = "en", messages, setLang, children }) => {
    const lang = locale in MESSAGES ? locale : "en";
    const t = useCallback((key, vars = {}) => {
        // 未收录的键原样返回（如服务端返回的错误信息）
        const msg = messages?.[lang]?.[key] ?? MESSAGES[lang][key] ?? messages?.en?.[key] ?? MESSAGES.en[key] ?? key;
        return msg.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    }, [lang, messages]);
    const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

// 记住的语言，没有时按浏览器语言
const initialLocale = (storageKey) => {
    try {
        const saved = storageKey && localStorage.getItem(storageKey);
        if (LANGUAGES.some(([code]) => code === saved)) return saved;
    } catch {
        // 读不到（隐私模式等）时按浏览器语言
    }
    return (navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
};

/**
 * 界面语言：传了 locale 时由宿主管理（onLocaleChange 为切换回调，可不传）；
 * 不传时自己管理，初始为 storageKey 记住的或浏览器语言，切换后记住并通知 onLocaleChange。返回 [语言, 切换函数]
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useLocale = ({ locale, onLocaleChange, localeStorageKey }) => {
    const [own, setOwn] = useState(() => initialLocale(localeStorageKey));
    if (locale !== undefined) return [locale, onLocaleChange];
    const setLang = (next) => {
        setOwn(next);
        try {
            if (localeStorageKey) localStorage.setItem(localeStorageKey, next);
        } catch {
            // 忽略：只是记不住语言
        }
        onLocaleChange?.(next);
    };
    return [own, setLang];
};

// 在 I18nProvider 之外使用（如单独用面板组件而没有包一层）时按英文
const FALLBACK = { lang: "en", setLang: undefined, t: (key, vars = {}) => (MESSAGES.en[key] ?? key).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) };

// eslint-disable-next-line react-refresh/only-export-components
export const useI18n = () => useContext(I18nContext) ?? FALLBACK;
