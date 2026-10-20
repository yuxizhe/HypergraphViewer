import React, { forwardRef, useImperativeHandle } from 'react';
import DatabasePanel from './DatabasePanel.jsx';
import GraphCanvas from './GraphCanvas.jsx';
import InspectorPanel from './panel/InspectorPanel.jsx';
import { I18nProvider, LANGUAGES, useI18n, useLocale } from './i18n.jsx';
import { useHypergraphExplorer } from './useHypergraphExplorer.js';

// 画布上方的标题栏：当前模式与中心实体、模式切换、实体 / 超边计数、宿主插槽、语言切换（传了 onLocaleChange 时）
const Header = ({ explorer, extra }) => {
    const { lang, setLang, t } = useI18n();
    const { mode, setMode, centerNode, hypergraph, visibleHypergraph, hidden, lineCount } = explorer;
    return (
        <div className="bg-white/95 p-4 border-b border-gray-200/50 flex justify-between items-center shadow-sm shrink-0">
            <div className="flex items-center gap-4 min-w-0">
                <h3 className="text-xl font-semibold text-gray-800 m-0 truncate">
                    {t(mode === "hyper" ? "titleHyper" : "titleGraph")} {centerNode && `- ${centerNode}`}
                </h3>

                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-gray-600">{t("modeLabel")}</span>
                    <div className="flex space-x-1">
                        {["hyper", "graph"].map((m) => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={`px-3 py-1 text-xs rounded-full transition-all duration-200 ${mode === m
                                    ? "bg-primary-500 text-white shadow-md"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    }`}
                            >
                                {t(m === "hyper" ? "modeHyper" : "modeGraph")}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
                {visibleHypergraph && (
                    <div className="bg-white px-4 py-2 text-sm text-gray-600 rounded-lg shadow-sm border border-gray-200">
                        <span className="font-semibold">{t("verticesLabel")}</span>{" "}
                        {Object.keys(visibleHypergraph.vertices).length}
                        {hidden.nodes.length > 0 && ` / ${Object.keys(hypergraph.vertices).length}`} |
                        <span className="font-semibold ml-1">{t(mode === "hyper" ? "hyperedgesLabel" : "edgesLabel")}</span>{" "}
                        {mode === "hyper" ? visibleHypergraph.hyperedges.length : lineCount}
                        {mode === "hyper" &&
                            visibleHypergraph.hyperedges.length !== hypergraph.hyperedges.length &&
                            ` / ${hypergraph.hyperedges.length}`}
                    </div>
                )}
                {extra}
                {setLang && (
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs" role="group" aria-label="Language">
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
                )}
            </div>
        </div>
    );
};

const ExplorerLayout = forwardRef(function ExplorerLayout(
    { panels, title, databaseHeader, headerExtra, loading: sourceLoading, className, style, ...options },
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
    // 有数据源（或宿主在左栏放了插槽，如数据源选择，数据源载入前也显示）时才有左栏
    const showDatabase = (panels?.database ?? true) && (!!options.source || !!databaseHeader);
    const showInspector = panels?.inspector ?? true;
    const showHeader = panels?.header ?? true;
    const { loading, error } = explorer;

    return (
        <div className={`hv-root ${className ?? ""}`} lang={lang === "zh" ? "zh-CN" : "en"} style={{ width: "100%", height: "100%", ...style }}>
            <div className="flex w-full h-full bg-linear-to-br from-gray-50 to-gray-100">
                {showDatabase && (
                    <DatabasePanel
                        {...explorer.databaseProps}
                        loadingVertices={explorer.databaseProps.loadingVertices || !!sourceLoading}
                        title={title}
                        header={databaseHeader}
                    />
                )}

                <div className="flex-1 min-w-0 flex flex-col bg-white/10 backdrop-blur-sm">
                    {showHeader && <Header explorer={explorer} extra={headerExtra} />}

                    <div className="flex-1 min-h-0 relative bg-white">
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

                        <div className="flex h-full">
                            <GraphCanvas {...explorer.canvasProps} />
                            {showInspector && <InspectorPanel {...explorer.inspectorProps} />}
                        </div>
                    </div>
                </div>
            </div>
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
