import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getUrlParam, setUrlParam } from './urlParams.js';

// 中英文界面文字；与 Hypergraph-DB 查看器 / 管理后台用同一套术语（vertex → 实体，hyperedge → 超边）。
// 属性名（description、keywords 等）来自数据，不翻译
const MESSAGES = {
    en: {
        pageTitle: "Hypergraph Visualization",
        dataSource: "Data Source",
        useDefaultData: "Sample Datasets", remoteHif: "Remote HIF URL", uploadHif: "Upload HIF File",
        hifUrlPlaceholder: "Enter HIF file URL", load: "Load", loading: "Loading...",
        databaseInfo: "Database Information",
        verticesLabel: "Vertices:", hyperedgesLabel: "Hyperedges:", edgesLabel: "Edges:",
        searchList: "Search & Vertex List",
        searchPlaceholder: "Search vertex ID, type or description...",
        found: "Found {n} results", loadingVertices: "Loading vertices...", noMatch: "No matching vertices found",
        typeLabel: "Type:", idLabel: "ID:", degreeLabel: "Degree:",
        prev: "Previous", next: "Next",
        titleHyper: "Hypergraph Visualization", titleGraph: "Graph Visualization",
        modeLabel: "Mode:", modeHyper: "Hypergraph", modeGraph: "Graph",
        loadingGraph: "Loading hypergraph data...", loadingHint: "This may take a few seconds",
        loadFailed: "Failed to load graph data",
        detail: "Hypergraph Detail", hyperedge: "Hyperedge", edge: "Edge", node: "Node",
        partialDataNote: "The database has {v} vertices and {e} hyperedges; stats below cover the loaded subgraphs",
        typeClickHint: "Click a segment to filter the vertex list", neighborhoodCol: "Subgraph",
        hyperedgeSearchPlaceholder: "Search description, type or member...",
        panelTitle: "Subgraph", tab_stats: "Stats", tab_nodes: "Vertices", tab_hyperedges: "Hyperedges", tab_render: "Render",
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
        tagRelayout: "re-layout", tagRestyle: "restyle",
        groupLayout: "Layout", layoutAlgorithm: "Algorithm", layoutHypergraph: "Hypergraph layout",
        layoutForce: "Force", layoutCircular: "Circular", useCenter: "Center on selected vertex",
        nodeSpacing: "Node spacing", preventLabelOverlap: "Prevent label overlap",
        graphEdges: "3+ member hyperedges (graph)", graphEdgesBinary: "Drop", graphEdgesClique: "Clique",
        forceHint: "Force + primary-hyperedge clustering: the layout used before HypergraphLayout",
        groupHyperedge: "Hyperedges", showContours: "Contours", contourBounds: "Contour bounds",
        boundsKey: "Nodes only", boundsRender: "With labels",
        hyperedgeColorBy: "Color by", byHyperedge: "Hyperedge", byHyperedgeType: "Type", fillOpacity: "Fill opacity",
        groupNode: "Vertices", nodeColorBy: "Color", byType: "By type", uniform: "Uniform",
        nodeSizeBy: "Size", sizeFixed: "Fixed", sizeDegree: "By degree",
        groupLabel: "Labels", labelMode: "Show", labelAll: "All", labelKey: "Center & hubs", labelNone: "None",
        labelFontSize: "Font size", resetSettings: "Reset settings", resetColors: "Reset colors",
    },
    zh: {
        pageTitle: "超图可视化",
        dataSource: "数据源",
        useDefaultData: "示例数据集", remoteHif: "远程 HIF 地址", uploadHif: "上传 HIF 文件",
        hifUrlPlaceholder: "输入 HIF 文件地址", load: "加载", loading: "加载中...",
        databaseInfo: "数据库信息",
        verticesLabel: "实体：", hyperedgesLabel: "超边：", edgesLabel: "边：",
        searchList: "搜索与实体列表",
        searchPlaceholder: "搜索实体 ID、类型或描述...",
        found: "共找到 {n} 个结果", loadingVertices: "加载实体中...", noMatch: "没有匹配的实体",
        typeLabel: "类型：", idLabel: "ID：", degreeLabel: "度数：",
        prev: "上一页", next: "下一页",
        titleHyper: "超图可视化", titleGraph: "图可视化",
        modeLabel: "模式：", modeHyper: "超图", modeGraph: "图",
        loadingGraph: "加载超图数据中...", loadingHint: "可能需要几秒钟",
        loadFailed: "加载图数据失败",
        detail: "超图详情", hyperedge: "超边", edge: "边", node: "实体",
        partialDataNote: "数据库共 {v} 个实体、{e} 条超边；以下按已载入的子图统计",
        typeClickHint: "点色段筛选实体列表", neighborhoodCol: "子图",
        hyperedgeSearchPlaceholder: "搜索描述、类型或成员...",
        panelTitle: "当前子图", tab_stats: "统计", tab_nodes: "实体", tab_hyperedges: "超边", tab_render: "渲染",
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
        tagRelayout: "重新布局", tagRestyle: "重绘",
        groupLayout: "布局", layoutAlgorithm: "布局算法", layoutHypergraph: "超图布局",
        layoutForce: "力导", layoutCircular: "环形", useCenter: "以中心实体为中心",
        nodeSpacing: "节点间距", preventLabelOverlap: "标签防重叠",
        graphEdges: "图模式下 3 元及以上超边", graphEdgesBinary: "丢弃", graphEdgesClique: "拆成两两连线",
        forceHint: "力导 + 主超边聚类：改用 HypergraphLayout 之前的布局",
        groupHyperedge: "超边", showContours: "显示轮廓", contourBounds: "轮廓范围",
        boundsKey: "只圈节点", boundsRender: "包含标签",
        hyperedgeColorBy: "着色", byHyperedge: "按超边", byHyperedgeType: "按类型", fillOpacity: "填充透明度",
        groupNode: "节点", nodeColorBy: "着色", byType: "按类型", uniform: "统一颜色",
        nodeSizeBy: "大小", sizeFixed: "固定", sizeDegree: "按度数",
        groupLabel: "标签", labelMode: "显示", labelAll: "全部", labelKey: "中心与枢纽", labelNone: "不显示",
        labelFontSize: "字号", resetSettings: "恢复默认设置", resetColors: "恢复默认颜色",
    },
};
const LANG_KEY = "hypergraph-viewer-lang";

// 优先级：网址 ?lang=（en / zh）> 上次的选择 > 浏览器语言
const detectLang = () => {
    const fromUrl = getUrlParam("lang");
    if (fromUrl in MESSAGES) return fromUrl;
    try {
        const saved = localStorage.getItem(LANG_KEY);
        if (saved in MESSAGES) return saved;
    } catch {
        // localStorage 不可用时按浏览器语言
    }
    return (navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
};

const I18nContext = createContext(null);

export const I18nProvider = ({ children }) => {
    const [lang, setLang] = useState(detectLang);
    const t = useCallback((key, vars = {}) => {
        // 未收录的键原样返回（如服务端返回的错误信息）
        const msg = MESSAGES[lang][key] ?? MESSAGES.en[key] ?? key;
        return msg.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    }, [lang]);

    useEffect(() => {
        document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
        document.title = MESSAGES[lang].pageTitle;
        setUrlParam("lang", lang);
        try {
            localStorage.setItem(LANG_KEY, lang);
        } catch {
            // 忽略：只是记不住选择
        }
    }, [lang]);

    return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const LANGUAGES = [["en", "EN"], ["zh", "中文"]];

// eslint-disable-next-line react-refresh/only-export-components
export const useI18n = () => useContext(I18nContext);
