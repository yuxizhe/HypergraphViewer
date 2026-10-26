import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import BottomSheet, { useLayout } from './BottomSheet.jsx';
import DatabasePanel from './DatabasePanel.jsx';
import DetailsPanel from './DetailsPanel.jsx';
import GraphCanvas from './GraphCanvas.jsx';
import InspectorPanel from './panel/InspectorPanel.jsx';
import { I18nProvider, LANGUAGES, useI18n, useLocale } from './i18n.jsx';
import { useHypergraphExplorer } from './useHypergraphExplorer.js';

// 实体 / 超边计数：可见数 / 子图总数
const Counts = ({ explorer, className = "" }) => {
    const { t } = useI18n();
    const { mode, hypergraph, visibleHypergraph, hidden, lineCount } = explorer;
    if (!visibleHypergraph) return null;
    // 图模式下 3 元及以上超边画成超边节点时也按超边计数
    const byHyperedge = mode !== "graph" || explorer.inspectorProps.settings.graphEdges === "star";
    return (
        <div className={`text-sm text-gray-600 ${className}`}>
            <span className="font-semibold">{t("verticesLabel")}</span> {Object.keys(visibleHypergraph.vertices).length}
            {hidden.nodes.length > 0 && ` / ${Object.keys(hypergraph.vertices).length}`} |
            <span className="font-semibold ml-1">{t(byHyperedge ? "hyperedgesLabel" : "edgesLabel")}</span>{" "}
            {byHyperedge ? visibleHypergraph.hyperedges.length : lineCount}
            {byHyperedge && visibleHypergraph.hyperedges.length !== hypergraph.hyperedges.length && ` / ${hypergraph.hyperedges.length}`}
        </div>
    );
};

// 模式 → [模式名, 标题]
const MODE_KEYS = { hyper: ["modeHyper", "titleHyper"], graph: ["modeGraph", "titleGraph"], matrix: ["modeMatrix", "titleMatrix"] };

const ModeSwitch = ({ explorer, small }) => {
    const { t } = useI18n();
    const { mode, setMode } = explorer;
    return (
        <div className="flex space-x-1 shrink-0">
            {["hyper", "matrix", "graph"].map((m) => (
                <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`${small ? "px-2.5" : "px-3"} py-1 text-xs rounded-full transition-all duration-200 ${
                        mode === m ? "bg-primary-500 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                    {t(MODE_KEYS[m][0])}
                </button>
            ))}
        </div>
    );
};

const LanguageSwitch = () => {
    const { lang, setLang } = useI18n();
    if (!setLang) return null;
    return (
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs shrink-0" role="group" aria-label="Language">
            {LANGUAGES.map(([code, name]) => (
                <button
                    key={code}
                    onClick={() => setLang(code)}
                    className={`px-2.5 py-1 ${lang === code ? "bg-primary-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                    {name}
                </button>
            ))}
        </div>
    );
};

const IconButton = ({ path, label, active, onClick }) => (
    <button
        onClick={onClick}
        title={label}
        aria-label={label}
        className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-lg ${active ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-100"}`}
    >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d={path} />
        </svg>
    </button>
);

const ICONS = {
    list: "M4 6h16M4 12h16M4 18h16",
    panel: "M4 4h16v16H4zM14 4v16",
    stats: "M5 20V10M12 20V4M19 20v-7",
    info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
    more: "M5 12h.01M12 12h.01M19 12h.01",
};

// 画布上方的标题栏：当前模式与中心实体、模式切换、实体 / 超边计数、宿主插槽、语言切换（传了 onLocaleChange 时）。
// medium 时两侧多出打开左栏抽屉、右栏浮层的按钮；compact（手机）时只留一行，计数、插槽、语言收进「更多」
const Header = ({ explorer, extra, layout, onOpenDatabase, inspectorOpen, onToggleInspector }) => {
    const { t } = useI18n();
    const { mode, centerNode } = explorer;
    const [menuOpen, setMenuOpen] = useState(false);

    if (layout === "compact") {
        return (
            <div className="relative bg-white/95 px-3 py-2 border-b border-gray-200/50 flex items-center gap-2 shadow-sm shrink-0">
                <h3 className="flex-1 min-w-0 text-base font-semibold text-gray-800 m-0 truncate">
                    {centerNode || t(MODE_KEYS[mode][1])}
                </h3>
                <ModeSwitch explorer={explorer} small />
                <IconButton path={ICONS.more} label={t("more")} active={menuOpen} onClick={() => setMenuOpen((o) => !o)} />
                {menuOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                        <div className="absolute right-2 top-full mt-1 z-50 w-max max-w-[calc(100%-1rem)] p-3 space-y-3 bg-white rounded-xl border border-gray-200 shadow-xl">
                            <Counts explorer={explorer} />
                            {extra}
                            <LanguageSwitch />
                        </div>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className={`bg-white/95 border-b border-gray-200/50 flex justify-between items-center shadow-sm shrink-0 ${layout === "medium" ? "px-3 py-3 gap-3" : "p-4"}`}>
            <div className="flex items-center gap-4 min-w-0">
                {onOpenDatabase && <IconButton path={ICONS.list} label={t("navVertices")} onClick={onOpenDatabase} />}
                <h3 className={`${layout === "medium" ? "text-lg" : "text-xl"} font-semibold text-gray-800 m-0 truncate`}>
                    {t(MODE_KEYS[mode][1])} {centerNode && `- ${centerNode}`}
                </h3>

                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-gray-600">{t("modeLabel")}</span>
                    <ModeSwitch explorer={explorer} />
                </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
                <Counts explorer={explorer} className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200" />
                {extra}
                <LanguageSwitch />
                {onToggleInspector && (
                    <IconButton path={ICONS.panel} label={t("navSubgraph")} active={inspectorOpen} onClick={onToggleInspector} />
                )}
            </div>
        </div>
    );
};

// 手机上点画布元素后，画布顶部露出它的名称，点「详情」打开详情面板（代替电脑上的悬停卡片）
const detailName = (kind, item) =>
    kind === "node"
        ? item.label ?? item.id
        : String(item.description || item.summary || item.keywords || item.members?.join("、") || "").replace(/<SEP>/g, " | ");

// 手机底部的三个按钮：实体（左栏）、子图（右栏）、详情
const TabBar = ({ items, active, onSelect }) => (
    <div className="shrink-0 flex border-t border-gray-200 bg-white" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {items.map(([key, label, icon]) => (
            <button
                key={key}
                onClick={() => onSelect(active === key ? null : key)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 text-xs ${active === key ? "text-primary-600 font-semibold" : "text-gray-500"}`}
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d={icon} />
                </svg>
                {label}
            </button>
        ))}
    </div>
);

const ExplorerLayout = forwardRef(function ExplorerLayout(
    { panels, layout: fixedLayout, title, databaseHeader, headerExtra, loading: sourceLoading, className, style, ...options },
    ref
) {
    const { lang, t } = useI18n();
    const explorer = useHypergraphExplorer(options);
    // 换子图时画布重新挂载，对外给一个转发到当前视图的对象
    const { viewRef } = explorer;
    useImperativeHandle(
        ref,
        () => ({
            get graph() {
                return viewRef.current?.graph;
            },
            hover: (target) => viewRef.current?.hover(target),
            select: (id) => viewRef.current?.select(id),
            fitView: async (animate) => viewRef.current?.fitView(animate),
        }),
        [viewRef]
    );
    const rootRef = useRef(null);
    const layout = useLayout(rootRef, fixedLayout);
    const [sheet, setSheet] = useState(null); // compact：打开的底部面板 database | inspector | details
    const [drawerOpen, setDrawerOpen] = useState(false); // medium：左栏抽屉
    const [inspectorOpen, setInspectorOpen] = useState(false); // medium：右栏浮层

    // 有数据源（或宿主在左栏放了插槽，如数据源选择，数据源载入前也显示）时才有左栏
    const showDatabase = (panels?.database ?? true) && (!!options.source || !!databaseHeader);
    const showInspector = panels?.inspector ?? true;
    const showHeader = panels?.header ?? true;
    const { loading, error } = explorer;

    // 最后悬停 / 点选的是实体还是超边（手机上画布顶部显示它的名称）
    const { hoverNode, hoverHyperedge } = explorer.inspectorProps;
    const [lastKind, setLastKind] = useState(null);
    useEffect(() => {
        if (hoverNode) setLastKind("node");
    }, [hoverNode]);
    useEffect(() => {
        if (hoverHyperedge) setLastKind("hyperedge");
    }, [hoverHyperedge]);
    const lastItem = lastKind === "node" ? hoverNode : lastKind === "hyperedge" ? hoverHyperedge : null;

    // 抽屉、底部面板中选了实体或超边后收起，回到画布
    const closePanels = () => {
        setSheet(null);
        setDrawerOpen(false);
    };
    const databaseProps = {
        ...explorer.databaseProps,
        setSelectedVertex: (id) => {
            explorer.databaseProps.setSelectedVertex(id);
            closePanels();
        },
        onPickHyperedge: (he) => {
            explorer.databaseProps.onPickHyperedge(he);
            closePanels();
        },
    };
    const databasePanel = (fill) => (
        <DatabasePanel
            {...databaseProps}
            loadingVertices={explorer.databaseProps.loadingVertices || !!sourceLoading}
            // 手机上底部面板自带标题
            title={layout === "compact" ? undefined : title}
            header={databaseHeader}
            fill={fill}
        />
    );

    const canvasArea = (
        <>
            {error && (
                <div className="bg-red-50 text-red-700 p-4 m-4 rounded-lg border-l-4 border-red-500 shadow-sm">
                    <div className="flex items-center">
                        <span className="text-xl mr-2">⚠️</span>
                        <span className="font-medium">{t(error)}</span>
                    </div>
                </div>
            )}

            {loading && (
                <div className="absolute inset-0 flex justify-center items-center bg-white/80 backdrop-blur-sm z-50 text-lg text-gray-600">
                    <div className="text-center">
                        <div className="text-2xl mb-4">🔄</div>
                        <div className="font-semibold">{t("loadingGraph")}</div>
                        <div className="text-sm mt-2 text-gray-500">{t("loadingHint")}</div>
                    </div>
                </div>
            )}
        </>
    );

    let body;
    if (layout === "compact") {
        const tabs = [
            showDatabase && ["database", t("navVertices"), ICONS.list],
            showInspector && ["inspector", t("navSubgraph"), ICONS.stats],
            ["details", t("navDetails"), ICONS.info],
        ].filter(Boolean);
        const sheetTitle = tabs.find(([key]) => key === sheet)?.[1];
        body = (
            <div className="flex flex-col w-full h-full bg-white">
                {showHeader && <Header explorer={explorer} extra={headerExtra} layout={layout} />}
                <div className="flex-1 min-h-0 relative">
                    {canvasArea}
                    <div className="flex h-full">
                        <GraphCanvas {...explorer.canvasProps} compact />
                    </div>
                    {lastItem && !sheet && (
                        <button
                            onClick={() => setSheet("details")}
                            className="absolute top-2 left-2 z-10 max-w-[calc(100%-188px)] flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg bg-white/95 border border-gray-200 shadow-sm text-sm"
                        >
                            <span className="truncate text-gray-800">{detailName(lastKind, lastItem)}</span>
                            <span className="shrink-0 text-primary-600 font-medium">{t("openDetails")}</span>
                        </button>
                    )}
                    {sheet && (
                        <BottomSheet title={sheetTitle} onClose={() => setSheet(null)}>
                            {sheet === "database" && databasePanel(true)}
                            {sheet === "inspector" && <InspectorPanel {...explorer.inspectorProps} fill compact />}
                            {sheet === "details" && (
                                <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
                                    {hoverNode || hoverHyperedge ? (
                                        <DetailsPanel hoverHyperedge={hoverHyperedge} hoverNode={hoverNode} />
                                    ) : (
                                        <div className="text-sm text-gray-400 text-center pt-6">{t("tapToInspect")}</div>
                                    )}
                                </div>
                            )}
                        </BottomSheet>
                    )}
                </div>
                <TabBar items={tabs} active={sheet} onSelect={setSheet} />
            </div>
        );
    } else if (layout === "medium") {
        body = (
            <div className="relative flex w-full h-full bg-linear-to-br from-gray-50 to-gray-100">
                <div className="flex-1 min-w-0 flex flex-col">
                    {showHeader && (
                        <Header
                            explorer={explorer}
                            extra={headerExtra}
                            layout={layout}
                            onOpenDatabase={showDatabase ? () => setDrawerOpen(true) : undefined}
                            inspectorOpen={inspectorOpen}
                            onToggleInspector={showInspector ? () => setInspectorOpen((o) => !o) : undefined}
                        />
                    )}
                    <div className="flex-1 min-h-0 relative bg-white">
                        {canvasArea}
                        <div className="flex h-full">
                            <GraphCanvas {...explorer.canvasProps} />
                        </div>
                        {showInspector && inspectorOpen && (
                            <div className="absolute top-0 right-0 z-20 h-full w-96 max-w-full shadow-2xl">
                                <InspectorPanel {...explorer.inspectorProps} fill onCollapse={() => setInspectorOpen(false)} />
                            </div>
                        )}
                    </div>
                </div>
                {showDatabase && drawerOpen && (
                    <>
                        <div className="absolute inset-0 z-30 bg-black/20" onClick={() => setDrawerOpen(false)} />
                        <div className="absolute inset-y-0 left-0 z-40 w-80 max-w-[85%] shadow-2xl">{databasePanel(true)}</div>
                    </>
                )}
            </div>
        );
    } else {
        body = (
            <div className="flex w-full h-full bg-linear-to-br from-gray-50 to-gray-100">
                {showDatabase && databasePanel(false)}

                <div className="flex-1 min-w-0 flex flex-col bg-white/10 backdrop-blur-sm">
                    {showHeader && <Header explorer={explorer} extra={headerExtra} layout={layout} />}

                    <div className="flex-1 min-h-0 relative bg-white">
                        {canvasArea}
                        <div className="flex h-full">
                            <GraphCanvas {...explorer.canvasProps} />
                            {showInspector && <InspectorPanel {...explorer.inspectorProps} />}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={rootRef}
            className={`hv-root ${className ?? ""}`}
            lang={lang === "zh" ? "zh-CN" : "en"}
            style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...style }}
        >
            {body}
        </div>
    );
});

/**
 * 超图浏览器：左栏（数据源统计、实体与超边列表）、画布（悬停卡片、工具栏、已隐藏标签条）、右栏（子图统计、实体与超边表、渲染设置、详情），
 * 面板用 panels 开关。ref 为画布的 HypergraphView（hover / fitView / graph 等）
 */
const HypergraphExplorer = forwardRef(function HypergraphExplorer({ locale, onLocaleChange, localeStorageKey, messages, ...props }, ref) {
    // 不传 locale 时自己管理语言：初始为 localeStorageKey 记住的或浏览器语言，标题栏可切换，切换后记住并通知 onLocaleChange
    const [lang, setLang] = useLocale({ locale, onLocaleChange, localeStorageKey });
    return (
        <I18nProvider locale={lang} messages={messages} setLang={setLang}>
            <ExplorerLayout ref={ref} {...props} />
        </I18nProvider>
    );
});

export default HypergraphExplorer;
