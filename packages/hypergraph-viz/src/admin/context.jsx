import React, { createContext, useContext } from 'react';

// 中英文界面文字（从 Hypergraph-DB 管理后台搬来）：字符串含 {占位符}，或返回 JSX 的函数（富文本）
// eslint-disable-next-line react-refresh/only-export-components
export const ADMIN_MESSAGES = {
    en: {
        appSubtitle: "Admin console",
        navOverview: "Overview", navVertices: "Vertices", navEdges: "Hyperedges", navData: "Import / Export", navGraph: "Graph viewer",
        vertices: "Vertices", hyperedges: "Hyperedges",
        connecting: "Connecting...", loading: "Loading...", noData: "No data", none: "None",
        unsaved: "Unsaved changes", saved: "Saved", save: "Save", savedToDisk: "Saved to disk",
        cancel: "Cancel", create: "Create", close: "Close", delete: "Delete", open: "Open", saveChanges: "Save changes",
        confirmTitle: "Please confirm",
        jsonValid: "Valid JSON object", jsonInvalid: "Invalid: {error}", jsonMustBeObject: "Must be a JSON object",
        records: "{n} records", prev: "Prev", next: "Next", pageOf: "Page {page} / {total}",
        logScale: "Log scale",
        statVertices: "Vertices", statEdges: "Hyperedges", statAvgDegree: "Avg. vertex degree", statMaxDegree: "Max vertex degree",
        statAvgSize: "Avg. hyperedge size", statMaxSize: "Max hyperedge size", statIsolated: "Isolated vertices",
        degreeDist: "Vertex degree distribution", sizeDist: "Hyperedge size distribution", histDegree: "degree", histSize: "size",
        edgeTypes: "Hyperedge types", entityTypes: "Entity types", attributeKeys: "Attribute keys",
        newVertex: "+ New vertex", searchVertices: "Search id or attributes...", allEntityTypes: "All entity types",
        sortDegreeDesc: "Degree ↓", sortDegreeAsc: "Degree ↑", sortIdAsc: "ID A→Z", sortIdDesc: "ID Z→A",
        colId: "ID", colDegree: "Degree", colEntityType: "Entity type", colAttributes: "Attributes", colVertices: "Vertices", colSize: "Size",
        noVertices: "No vertices", noEdges: "No hyperedges",
        newVertexTitle: "New vertex", idLabel: "ID", idPlaceholder: "e.g. Alice", attributes: "Attributes", attributesJson: "Attributes (JSON)",
        vertexCreated: "Vertex {id} created", vertexSaved: "Vertex saved", vertexDeleted: "Vertex deleted",
        confirmDeleteVertex: ({ id, degree }) => <>Delete vertex <b>{id}</b>? It will be removed from its {degree} hyperedge(s); hyperedges left with fewer than 2 vertices are deleted.</>,
        vertexTitle: ({ id }) => <>Vertex <span className="text-primary-600">{id}</span></>,
        degree: "Degree", neighbors: "Neighbors", openViewer: "Open graph viewer ↗", relationGraph: "Relation graph",
        incidentEdges: "Incident hyperedges ({n})", first200: " — showing first 200", isolated: "This vertex is isolated.",
        newEdge: "+ New hyperedge", searchEdges: "Search vertices or attributes...", allEdgeTypes: "All hyperedge types",
        sortSizeDesc: "Size ↓", sortSizeAsc: "Size ↑", sortVerticesAsc: "Vertices A→Z", more: "+{n} more",
        pickTwo: "Pick at least 2 vertices", searchToAdd: "Search vertices to add...", deg: "deg {n}", noMatch: "No matching vertices",
        newEdgeTitle: "New hyperedge", edgeCreated: "Hyperedge created", edgeSaved: "Hyperedge saved", edgeDeleted: "Hyperedge deleted",
        confirmDeleteEdge: "Delete this hyperedge connecting {n} vertices? The vertices themselves are kept.",
        edgeTitle: "Hyperedge ({n} vertices)",
        membershipHint: "Membership is the hyperedge's identity — to change it, create a new hyperedge and delete this one.",
        invalidJsonFile: "Not valid JSON: {error}",
        confirmImport: ({ file, v, e }) => <>Import <b>{file}</b>? This <b>replaces all {v} vertices and {e} hyperedges</b> in memory. The file on disk is untouched until you click Save.</>,
        replaceData: "Replace data", imported: "Imported {v} vertices, {e} hyperedges",
        storage: "Storage", file: "File", onDisk: "On disk", bytes: "{n} bytes", notSavedYet: "Not saved yet",
        lastSaved: "Last saved", notThisSession: "Not in this session", status: "Status", inSync: "In sync", saveToDisk: "Save to disk",
        hifTitle: "HIF import / export", hifDesc: "(Hypergraph Interchange Format) is a JSON format supported by many hypergraph libraries.",
        exportHif: "Export HIF", importHif: "Import HIF…",
    },
    zh: {
        appSubtitle: "管理后台",
        navOverview: "概览", navVertices: "实体", navEdges: "超边", navData: "导入 / 导出", navGraph: "超图可视化",
        vertices: "实体", hyperedges: "超边",
        connecting: "连接中...", loading: "加载中...", noData: "暂无数据", none: "无",
        unsaved: "有未保存的修改", saved: "已保存", save: "保存", savedToDisk: "已保存到磁盘",
        cancel: "取消", create: "创建", close: "关闭", delete: "删除", open: "打开", saveChanges: "保存修改",
        confirmTitle: "请确认",
        jsonValid: "JSON 格式正确", jsonInvalid: "格式错误：{error}", jsonMustBeObject: "必须是 JSON 对象",
        records: "共 {n} 条", prev: "上一页", next: "下一页", pageOf: "第 {page} / {total} 页",
        logScale: "对数刻度",
        statVertices: "实体数", statEdges: "超边数", statAvgDegree: "实体平均度", statMaxDegree: "实体最大度",
        statAvgSize: "超边平均大小", statMaxSize: "超边最大大小", statIsolated: "孤立实体",
        degreeDist: "实体度分布", sizeDist: "超边大小分布", histDegree: "度", histSize: "大小",
        edgeTypes: "超边类型", entityTypes: "实体类型", attributeKeys: "属性字段",
        newVertex: "+ 新建实体", searchVertices: "搜索 ID 或属性...", allEntityTypes: "全部实体类型",
        sortDegreeDesc: "度数 ↓", sortDegreeAsc: "度数 ↑", sortIdAsc: "ID A→Z", sortIdDesc: "ID Z→A",
        colId: "ID", colDegree: "度数", colEntityType: "实体类型", colAttributes: "属性", colVertices: "实体", colSize: "大小",
        noVertices: "没有实体", noEdges: "没有超边",
        newVertexTitle: "新建实体", idLabel: "ID", idPlaceholder: "例如：关羽", attributes: "属性", attributesJson: "属性（JSON）",
        vertexCreated: "已创建实体 {id}", vertexSaved: "实体已保存", vertexDeleted: "实体已删除",
        confirmDeleteVertex: ({ id, degree }) => <>确定删除实体 <b>{id}</b> 吗？它会从所属的 {degree} 条超边中移除，移除后不足 2 个实体的超边会被一起删除。</>,
        vertexTitle: ({ id }) => <>实体 <span className="text-primary-600">{id}</span></>,
        degree: "度数", neighbors: "邻居数", openViewer: "在超图可视化中打开 ↗", relationGraph: "关系图",
        incidentEdges: "关联超边（{n}）", first200: " — 仅显示前 200 条", isolated: "这是一个孤立实体。",
        newEdge: "+ 新建超边", searchEdges: "搜索实体或属性...", allEdgeTypes: "全部超边类型",
        sortSizeDesc: "大小 ↓", sortSizeAsc: "大小 ↑", sortVerticesAsc: "实体 A→Z", more: "+{n} 个",
        pickTwo: "至少选择 2 个实体", searchToAdd: "搜索要添加的实体...", deg: "度 {n}", noMatch: "没有匹配的实体",
        newEdgeTitle: "新建超边", edgeCreated: "超边已创建", edgeSaved: "超边已保存", edgeDeleted: "超边已删除",
        confirmDeleteEdge: "确定删除这条连接 {n} 个实体的超边吗？实体本身会保留。",
        edgeTitle: "超边（{n} 个实体）",
        membershipHint: "超边由它的实体集合唯一确定，不能直接修改成员。要修改成员，请新建一条超边并删除这条。",
        invalidJsonFile: "不是有效的 JSON：{error}",
        confirmImport: ({ file, v, e }) => <>确定导入 <b>{file}</b> 吗？这会<b>替换内存中全部 {v} 个实体和 {e} 条超边</b>。点击保存之前，磁盘上的文件不会改变。</>,
        replaceData: "替换数据", imported: "已导入 {v} 个实体、{e} 条超边",
        storage: "存储", file: "文件", onDisk: "磁盘占用", bytes: "{n} 字节", notSavedYet: "尚未保存",
        lastSaved: "上次保存", notThisSession: "本次会话未保存", status: "状态", inSync: "已同步", saveToDisk: "保存到磁盘",
        hifTitle: "HIF 导入 / 导出", hifDesc: "（Hypergraph Interchange Format）是一种被许多超图工具支持的 JSON 交换格式。",
        exportHif: "导出 HIF", importHif: "导入 HIF…",
    },
};

/**
 * 当前语言的 t（文字）、lbl（显示名）与数据接口 api。
 * 显示名来自 info.labels（Hypergraph-DB 的 <name>.labels.json）：{lang: {entity_type|edge_type|key: {value: label}}}，
 * 只改变显示，筛选与接口调用仍用原值
 */
// eslint-disable-next-line react-refresh/only-export-components
export const makeContext = ({ lang, messages, labels, api, viewerUrl }) => ({
    lang,
    api,
    viewerUrl,
    t: (key, vars = {}) => {
        const msg = messages?.[lang]?.[key] ?? ADMIN_MESSAGES[lang]?.[key] ?? messages?.en?.[key] ?? ADMIN_MESSAGES.en[key] ?? key;
        if (typeof msg === "function") return msg(vars);
        return msg.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    },
    lbl: (kind, value) => labels?.[lang]?.[kind]?.[value] ?? value,
});

const AdminContext = createContext(null);
export const AdminProvider = ({ value, children }) => <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
// eslint-disable-next-line react-refresh/only-export-components
export const useAdmin = () => useContext(AdminContext);

// eslint-disable-next-line react-refresh/only-export-components
export const fmtId = (id) => (typeof id === "string" ? id : JSON.stringify(id));
// eslint-disable-next-line react-refresh/only-export-components
export const fmtNum = (n) => (typeof n === "number" ? n.toLocaleString() : n);
