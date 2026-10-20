import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LANGUAGES, useLocale } from '../explorer/i18n.jsx';
import { AdminProvider, fmtId, fmtNum, makeContext } from './context.jsx';
import DataPage from './DataPage.jsx';
import { EdgeDetail, EdgesPage, NewEdgeModal } from './Edges.jsx';
import Overview from './Overview.jsx';
import { Button, ConfirmModal } from './ui.jsx';
import { NewVertexModal, VertexDetail, VerticesPage } from './Vertices.jsx';

// 左侧导航：[页面, 文字, 图标]
const NAV = [
    ["overview", "navOverview", "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"],
    ["vertices", "navVertices", "M12 21a9 9 0 100-18 9 9 0 000 18z"],
    ["edges", "navEdges", "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"],
    ["data", "navData", "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"],
    ["graph", "navGraph", "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"],
];

const EDGE_FILTERS = { page: 1, sort_by: "size", sort_order: "desc" };

const pageFromHash = () => window.location.hash.slice(1) || "overview";

/**
 * 超图数据库管理后台：概览、实体、超边（增删改查）、导入 / 导出、超图可视化。数据经 api 读写（见 createHttpAdminApi），
 * api 不提供 save 时不显示保存（每次修改即生效），不提供 exportHIF / importHIF 时没有对应按钮，提供 subgraph 时实体详情中有关系图；
 * viewerUrl 为超图查看器页面（「超图可视化」页与实体详情中的链接）；hashRouting 时当前页记在网址的 # 后
 */
export default function HypergraphAdmin({
    api,
    title = "Hypergraph DB",
    viewerUrl,
    headerExtra,
    hashRouting = false,
    locale,
    onLocaleChange,
    localeStorageKey,
    messages,
    className,
    style,
}) {
    const [lang, setLang] = useLocale({ locale, onLocaleChange, localeStorageKey });
    const [page, setPage] = useState(() => (hashRouting ? pageFromHash() : "overview"));
    const [info, setInfo] = useState(null);
    const [version, setVersion] = useState(0);
    const [vertexFilters, setVertexFilters] = useState({ page: 1 });
    const [edgeFilters, setEdgeFilters] = useState(EDGE_FILTERS);
    const [stack, setStack] = useState([]); // 打开的详情弹窗：{type, id | vertices}
    const [modal, setModal] = useState(null); // "newVertex" | "newEdge"
    const [confirmState, setConfirmState] = useState(null);
    const [toasts, setToasts] = useState([]);

    const ctx = useMemo(() => makeContext({ lang, messages, labels: info?.labels, api, viewerUrl }), [lang, messages, info?.labels, api, viewerUrl]);
    const { t } = ctx;

    const notify = useCallback((message, kind = "ok") => {
        const id = Math.random();
        setToasts((ts) => [...ts, { id, message, kind }]);
        setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3000);
    }, []);
    const refreshInfo = useCallback(() => api.info().then(setInfo).catch((e) => notify(e.message, "error")), [api, notify]);
    const onChanged = useCallback(() => {
        setVersion((v) => v + 1);
        refreshInfo();
    }, [refreshInfo]);

    // 换数据接口（如宿主切换数据库）：重新载入，关闭弹窗，清空筛选
    useEffect(() => {
        setInfo(null);
        setStack([]);
        setModal(null);
        setVertexFilters({ page: 1 });
        setEdgeFilters(EDGE_FILTERS);
        setVersion((v) => v + 1);
        refreshInfo();
    }, [refreshInfo]);

    useEffect(() => {
        if (!hashRouting) return;
        window.location.hash = page;
    }, [hashRouting, page]);
    useEffect(() => {
        if (!hashRouting) return;
        const onHash = () => setPage(pageFromHash());
        window.addEventListener("hashchange", onHash);
        return () => window.removeEventListener("hashchange", onHash);
    }, [hashRouting]);

    // 有未保存的修改时离开页面先确认
    useEffect(() => {
        const warn = (e) => {
            if (info && info.dirty) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [info]);

    const save = async () => {
        try {
            setInfo(await api.save());
            notify(t("savedToDisk"));
        } catch (e) {
            notify(e.message, "error");
        }
    };
    // Ctrl / ⌘ + S 保存
    const saveRef = useRef(save);
    saveRef.current = save;
    useEffect(() => {
        if (!api.save) return;
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                saveRef.current();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [api]);

    const openVertex = (id) => setStack((s) => [...s, { type: "vertex", id }]);
    const openEdge = (vertices) => setStack((s) => [...s, { type: "edge", vertices }]);
    const closeTop = () => setStack((s) => s.slice(0, -1));
    const confirm = (opts) => setConfirmState(opts);
    const top = stack[stack.length - 1];

    // 数据接口没有的功能不显示对应页面
    const nav = NAV.filter(
        ([key]) => (key !== "data" || api.save || api.exportHIF || api.importHIF) && (key !== "graph" || viewerUrl)
    );
    const current = nav.some(([key]) => key === page) ? page : "overview";
    const navKey = nav.find(([k]) => k === current)?.[1];

    return (
        <div className={`hv-root ${className ?? ""}`} lang={lang === "zh" ? "zh-CN" : "en"} style={{ width: "100%", height: "100%", ...style }}>
            <AdminProvider value={ctx}>
                {!info ? (
                    <div className="p-8 text-gray-500">{t("connecting")}</div>
                ) : (
                    <div className="flex h-full bg-gray-50">
                        <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
                            <div className="px-5 py-5 border-b border-gray-100">
                                <div className="text-lg font-bold text-gray-800">{title}</div>
                                <div className="text-xs text-gray-500">{t("appSubtitle")}</div>
                            </div>
                            <nav className="p-3 space-y-1 flex-1">
                                {nav.map(([key, label, icon]) => (
                                    <button
                                        key={key}
                                        onClick={() => setPage(key)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${current === key ? "bg-primary-50 text-primary-700 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                                        </svg>
                                        {t(label)}
                                    </button>
                                ))}
                            </nav>
                            <div className="p-4 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                                <div className="flex justify-between"><span>{t("vertices")}</span><b className="text-primary-600">{fmtNum(info.num_v)}</b></div>
                                <div className="flex justify-between"><span>{t("hyperedges")}</span><b className="text-primary-600">{fmtNum(info.num_e)}</b></div>
                            </div>
                        </aside>

                        <main className="flex-1 flex flex-col min-w-0">
                            <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-4 shrink-0">
                                <h1 className="font-semibold text-gray-800 shrink-0">{navKey && t(navKey)}</h1>
                                {info.storage_file && (
                                    <span className="font-mono text-xs text-gray-400 truncate min-w-0" title={info.storage_file}>{info.storage_file}</span>
                                )}
                                <div className="ml-auto flex items-center gap-3 shrink-0 whitespace-nowrap">
                                    {headerExtra}
                                    {setLang && (
                                        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs" role="group" aria-label="Language">
                                            {LANGUAGES.map(([code, name]) => (
                                                <button
                                                    key={code}
                                                    onClick={() => setLang(code)}
                                                    className={`px-2.5 py-1 ${lang === code ? "bg-primary-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                                                >
                                                    {name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {api.save && (
                                        <>
                                            {info.dirty ? (
                                                <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{t("unsaved")}</span>
                                            ) : (
                                                <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">{t("saved")}</span>
                                            )}
                                            <Button variant="primary" onClick={save} disabled={!info.dirty} title="Ctrl/⌘ + S">{t("save")}</Button>
                                        </>
                                    )}
                                </div>
                            </header>
                            <div className={`flex-1 overflow-y-auto ${current === "graph" ? "" : "p-6"}`}>
                                {current === "overview" && (
                                    <Overview
                                        version={version}
                                        gotoVertices={(f) => {
                                            setVertexFilters({ page: 1, ...f });
                                            setPage("vertices");
                                        }}
                                        gotoEdges={(f) => {
                                            setEdgeFilters({ ...EDGE_FILTERS, ...f });
                                            setPage("edges");
                                        }}
                                    />
                                )}
                                {current === "vertices" && (
                                    <VerticesPage version={version} filters={vertexFilters} setFilters={setVertexFilters} openVertex={openVertex} onCreate={() => setModal("newVertex")} />
                                )}
                                {current === "edges" && (
                                    <EdgesPage
                                        version={version}
                                        filters={edgeFilters}
                                        setFilters={setEdgeFilters}
                                        openEdge={openEdge}
                                        openVertex={openVertex}
                                        onCreate={() => setModal("newEdge")}
                                    />
                                )}
                                {current === "data" && <DataPage info={info} onChanged={onChanged} notify={notify} confirm={confirm} save={save} />}
                                {current === "graph" && <iframe key={version} src={viewerUrl} className="w-full h-full border-0" />}
                            </div>
                        </main>
                    </div>
                )}

                {top && top.type === "vertex" && (
                    <VertexDetail
                        key={`v-${stack.length}-${fmtId(top.id)}`}
                        id={top.id}
                        version={version}
                        onClose={closeTop}
                        openVertex={openVertex}
                        openEdge={openEdge}
                        onChanged={onChanged}
                        notify={notify}
                        confirm={confirm}
                    />
                )}
                {top && top.type === "edge" && (
                    <EdgeDetail
                        key={`e-${stack.length}-${JSON.stringify(top.vertices)}`}
                        vertices={top.vertices}
                        onClose={closeTop}
                        openVertex={openVertex}
                        onChanged={onChanged}
                        notify={notify}
                        confirm={confirm}
                    />
                )}
                {modal === "newVertex" && (
                    <NewVertexModal
                        onClose={() => setModal(null)}
                        notify={notify}
                        onDone={(id) => {
                            setModal(null);
                            onChanged();
                            openVertex(id);
                        }}
                    />
                )}
                {modal === "newEdge" && (
                    <NewEdgeModal
                        onClose={() => setModal(null)}
                        notify={notify}
                        onDone={(vs) => {
                            setModal(null);
                            onChanged();
                            openEdge(vs);
                        }}
                    />
                )}
                {confirmState && <ConfirmModal {...confirmState} onClose={() => setConfirmState(null)} />}

                <div className="fixed bottom-4 right-4 z-50 space-y-2">
                    {toasts.map((x) => (
                        <div key={x.id} className={`px-4 py-2 rounded-lg shadow-lg text-sm text-white ${x.kind === "error" ? "bg-red-600" : "bg-gray-800"}`}>
                            {x.message}
                        </div>
                    ))}
                </div>
            </AdminProvider>
        </div>
    );
}
