import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

// 中英文界面文字；与 Hypergraph-DB 查看器 / 管理后台用同一套术语（vertex → 实体，hyperedge → 超边）。
// 属性名（description、keywords 等）来自数据，不翻译
const MESSAGES = {
    en: {
        pageTitle: "Hypergraph Visualization",
        dataSource: "Data Source",
        useDefaultData: "Use Default Data", remoteHif: "Remote HIF URL", uploadHif: "Upload HIF File",
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
    },
    zh: {
        pageTitle: "超图可视化",
        dataSource: "数据源",
        useDefaultData: "使用默认数据", remoteHif: "远程 HIF 地址", uploadHif: "上传 HIF 文件",
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
    },
};
const LANG_KEY = "hypergraph-viewer-lang";

const detectLang = () => {
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
