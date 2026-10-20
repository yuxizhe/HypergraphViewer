import { getUrlParam, setUrlParam } from './urlParams.js';

// 本应用自己的文字（页面标题、数据源选择）；面板中的文字在 hypergraph-viz 里，经 HypergraphExplorer 的 messages 合并
export const APP_MESSAGES = {
    en: {
        pageTitle: "Hypergraph Visualization",
        dataSource: "Data Source",
        useDefaultData: "Sample Datasets", remoteHif: "Remote .hgdb / HIF URL", uploadHif: "Upload .hgdb / HIF File",
        hifUrlPlaceholder: "Enter .hgdb / HIF file URL", load: "Load", loading: "Loading...",
    },
    zh: {
        pageTitle: "超图可视化",
        dataSource: "数据源",
        useDefaultData: "示例数据集", remoteHif: "远程 .hgdb / HIF 地址", uploadHif: "上传 .hgdb / HIF 文件",
        hifUrlPlaceholder: "输入 .hgdb / HIF 文件地址", load: "加载", loading: "加载中...",
    },
};
const LANG_KEY = "hypergraph-viewer-lang";

// 优先级：网址 ?lang=（en / zh）> 上次的选择 > 浏览器语言
export const detectLang = () => {
    const fromUrl = getUrlParam("lang");
    if (fromUrl in APP_MESSAGES) return fromUrl;
    try {
        const saved = localStorage.getItem(LANG_KEY);
        if (saved in APP_MESSAGES) return saved;
    } catch {
        // localStorage 不可用时按浏览器语言
    }
    return (navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
};

// 语言写入页面、网址与 localStorage
export const applyLang = (lang) => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title = APP_MESSAGES[lang].pageTitle;
    setUrlParam("lang", lang);
    try {
        localStorage.setItem(LANG_KEY, lang);
    } catch {
        // 忽略：只是记不住选择
    }
};
