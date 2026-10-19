import React, { useState, useEffect, useMemo, useRef } from 'react';
import { centerSizes, fetchGraphData, fetchHyperedges, fetchLoadedHypergraph, fetchVertices, dataSourceManager } from '../api.js';
import {
    DEFAULT_THEME, EMPTY_SELECTION, filterHypergraph, fromKeyedEdges, hyperedgeColorsOf, hyperedgeIdOf,
    hypergraphStats, isEmptySelection, pairId, typeColorsOf,
} from 'hypergraph-viz';
import Sidebar from './Sidebar.jsx';
import GraphContainer from './GraphContainer.jsx';
import InspectorPanel from './panel/InspectorPanel.jsx';
import { LANGUAGES, useI18n } from '../i18n.jsx';
import { DEFAULT_RENDER_SETTINGS, EMPTY_COLOR_OVERRIDES, useStoredState } from '../viewSettings.js';

const EMPTY_HIDDEN = { nodes: [], hyperedges: [] };

// 在 map 中设置 / 删除（value 为 null）一项，返回新对象
const put = (map, key, value) => {
    const next = { ...map };
    if (value === null) delete next[key];
    else next[key] = value;
    return next;
};

export default function HypergraphViewer() {
    const { lang, setLang, t } = useI18n();
    const searchTimeoutRef = useRef(null);

    // 左侧栏：已载入超图（用于统计）、超边列表、实体类型筛选（dataVersion 在换数据源后递增，触发重新读取）
    const [loadedHypergraph, setLoadedHypergraph] = useState(null);
    const [vertexTypes, setVertexTypes] = useState([]);
    const vertexTypesRef = useRef(vertexTypes);
    vertexTypesRef.current = vertexTypes;
    const [hyperedgeList, setHyperedgeList] = useState([]);
    const [hyperedgeSearch, setHyperedgeSearch] = useState("");
    const [dataVersion, setDataVersion] = useState(0);
    // 从左侧超边列表跳到另一个子图时，子图加载后要选中的超边
    const pendingSelectionRef = useRef(null);
    const [vertices, setVertices] = useState([]);
    const [pagination, setPagination] = useState({
        page: 1,
        page_size: 50,
        total: 0,
        total_pages: 0,
    });
    const [selectedVertex, setSelectedVertex] = useState("");
    const [graphData, setGraphData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingVertices, setLoadingVertices] = useState(false);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState("degree");
    const [sortOrder, setSortOrder] = useState("desc");
    const [visualizationMode, setVisualizationMode] = useState("hyper");
    const [hoverHyperedge, setHoverHyperedge] = useState(null);
    const [hoverNode, setHoverNode] = useState(null);
    const [currentDataSource, setCurrentDataSource] = useState({ type: 'static' });
    const [dataSourceLoading, setDataSourceLoading] = useState(false);
    const [dataSourceError, setDataSourceError] = useState("");

    // 子图统计、选择与隐藏、渲染设置与颜色（右侧面板）
    const [selection, setSelection] = useState(EMPTY_SELECTION);
    const [hidden, setHidden] = useState(EMPTY_HIDDEN);
    const [focusId, setFocusId] = useState(null);
    const [renderSettings, setRenderSettings] = useStoredState("hypergraph-viewer-render", DEFAULT_RENDER_SETTINGS);
    const [colorOverrides, setColorOverrides] = useStoredState("hypergraph-viewer-colors", EMPTY_COLOR_OVERRIDES);
    const viewRef = useRef(null);

    // Generate entity type color mapping
    // 按整个数据源（已载入的实体）分配类型颜色，不随列表翻页、筛选变化；左右两栏共用
    const entityTypeColors = useMemo(() => {
        return typeColorsOf(loadedHypergraph ? Object.values(loadedHypergraph.vertices) : vertices);
    }, [loadedHypergraph, vertices]);

    // Handle data source change
    const handleDataSourceChange = async (newSource) => {
        setDataSourceLoading(true);
        setDataSourceError("");

        try {
            const result = await dataSourceManager.setDataSource(newSource);

            if (result.success) {
                setCurrentDataSource(newSource);

                // Refresh all data after successful data source change
                setDataVersion((v) => v + 1);

                // 先清空上一份数据的选中与详情，再加载列表（加载后会选中第一个实体）
                setSelectedVertex("");
                setGraphData(null);
                setHoverNode(null);
                setHoverHyperedge(null);
                // 新数据的类型不同，清掉类型筛选
                vertexTypesRef.current = [];
                setVertexTypes((v) => (v.length ? [] : v));

                // Reload vertices with current search/sort settings
                await loadVertices(1, searchTerm, sortBy, sortOrder);
            } else {
                setDataSourceError(result.error);
            }
        } catch (error) {
            console.error("Data source switch failed:", error);
            setDataSourceError(error.message);
        } finally {
            setDataSourceLoading(false);
        }
    };

    // Load database info
    useEffect(() => {
        fetchLoadedHypergraph().then(setLoadedHypergraph).catch(console.error);
    }, []);

    // Load vertices list
    const loadVertices = async (page, search, sortBy, sortOrder) => {
        setLoadingVertices(true);
        try {
            const result = await fetchVertices(
                page,
                pagination.page_size,
                search,
                sortBy,
                sortOrder,
                vertexTypesRef.current
            );
            setVertices(result.data);
            setPagination(result.pagination);

            // If no vertex selected and data exists, select the first one
            if (result.data.length > 0) {
                setSelectedVertex(result.data[0].id);
            }
        } catch (err) {
            console.error("Failed to load vertices:", err);
        } finally {
            setLoadingVertices(false);
        }
    };

    // Initial load of vertices
    useEffect(() => {
        loadVertices(1, "", sortBy, sortOrder);
    }, []);

    // Search debounce
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            loadVertices(1, searchTerm, sortBy, sortOrder);
        }, 300);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchTerm]);

    // Reload when sort changes
    useEffect(() => {
        if (vertices.length > 0) {
            loadVertices(pagination.page, searchTerm, sortBy, sortOrder);
        }
    }, [sortBy, sortOrder]);

    // Load when page changes
    const handlePageChange = (newPage) => {
        loadVertices(newPage, searchTerm, sortBy, sortOrder);
    };

    // Load graph data
    useEffect(() => {
        if (selectedVertex) {
            setLoading(true);
            setError("");

            fetchGraphData(selectedVertex)
                .then((data) => {
                    if (data.error) {
                        setError(data.error);
                    } else {
                        setGraphData(data);
                    }
                })
                .catch((err) => {
                    // 存翻译键，显示时翻译
                    setError("loadFailed");
                    console.error(err);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [selectedVertex]);

    // 换数据源后重新读取全库概览
    useEffect(() => {
        if (!dataVersion) return;
        fetchLoadedHypergraph().then(setLoadedHypergraph).catch(console.error);
    }, [dataVersion]);

    // 可浏览超边列表：搜索或换数据源时重新筛选
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchHyperedges(hyperedgeSearch).then(setHyperedgeList).catch(console.error);
        }, 200);
        return () => clearTimeout(timer);
    }, [hyperedgeSearch, dataVersion]);

    const loadedStats = useMemo(() => loadedHypergraph && hypergraphStats(loadedHypergraph), [loadedHypergraph]);

    // 实体类型筛选变化时回到第一页
    const typesLoadedRef = useRef(false);
    useEffect(() => {
        if (!typesLoadedRef.current) {
            typesLoadedRef.current = true;
            return;
        }
        loadVertices(1, searchTerm, sortBy, sortOrder);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vertexTypes]);

    // 列表排序：点同一列切换升降序；邻域默认降序，名称默认升序
    const onSort = (key) => {
        if (sortBy === key) setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
        else {
            setSortBy(key);
            setSortOrder(key === "degree" ? "desc" : "asc");
        }
    };

    // 超边 key 为用 |#| 拼接的成员，转为 hypergraph-viz 的输入格式
    const hypergraph = useMemo(() => graphData && fromKeyedEdges(graphData), [graphData]);

    // 换子图时清空选择与隐藏（从左侧超边列表跳转来的选中该超边）
    useEffect(() => {
        setSelection(pendingSelectionRef.current ?? EMPTY_SELECTION);
        pendingSelectionRef.current = null;
        setHidden(EMPTY_HIDDEN);
        setFocusId(null);
    }, [hypergraph]);

    // 被隐藏的元素移出选择
    useEffect(() => {
        setSelection((s) => {
            const nodes = s.nodes.filter((id) => !hidden.nodes.includes(id));
            const hyperedges = s.hyperedges.filter((id) => !hidden.hyperedges.includes(id));
            return nodes.length === s.nodes.length && hyperedges.length === s.hyperedges.length
                ? s
                : { nodes, hyperedges };
        });
    }, [hidden]);

    const stats = useMemo(() => hypergraph && hypergraphStats(hypergraph), [hypergraph]);
    const visibleHypergraph = useMemo(
        () => hypergraph && filterHypergraph(hypergraph, hidden),
        [hypergraph, hidden]
    );
    const visibleStats = useMemo(
        () => visibleHypergraph && hypergraphStats(visibleHypergraph),
        [visibleHypergraph]
    );

    // 实体类型颜色：左侧列表中的类型沿用 entityTypeColors，子图中其余类型接着取色；再叠加用户改过的颜色
    const typeColors = useMemo(() => {
        if (renderSettings.nodeColorBy === "uniform") return {};
        const colors = { ...entityTypeColors };
        let i = Object.keys(colors).length;
        const palette = DEFAULT_THEME.typePalette;
        stats?.types.forEach(({ type }) => {
            if (type && !(type in colors)) colors[type] = palette[i++ % palette.length];
        });
        return { ...colors, ...colorOverrides.types };
    }, [entityTypeColors, stats, colorOverrides.types, renderSettings.nodeColorBy]);

    // 超边颜色按 id 固定（在未隐藏的完整子图上分配），隐藏部分超边后其余颜色不变
    const hyperedgeTypeColors = useMemo(
        () => ({
            ...typeColorsOf(hypergraph?.hyperedges || [], "type", DEFAULT_THEME.hyperedgeColors),
            ...colorOverrides.hyperedgeTypes,
        }),
        [hypergraph, colorOverrides.hyperedgeTypes]
    );
    const hyperedgeColors = useMemo(() => {
        if (!hypergraph) return undefined;
        const base = hyperedgeColorsOf(hypergraph);
        const byType = renderSettings.hyperedgeColorBy === "type";
        hypergraph.hyperedges.forEach((he) => {
            const id = hyperedgeIdOf(he);
            if (byType && he.type) base[id] = hyperedgeTypeColors[he.type];
            if (colorOverrides.hyperedges[id]) base[id] = colorOverrides.hyperedges[id];
        });
        return base;
    }, [hypergraph, hyperedgeTypeColors, colorOverrides.hyperedges, renderSettings.hyperedgeColorBy]);

    const colors = useMemo(() => {
        const setIn = (field) => (key, value) => setColorOverrides((o) => ({ ...o, [field]: put(o[field], key, value) }));
        return {
            typeColorOf: (type) => (type && typeColors[type]) || DEFAULT_THEME.nodeColor,
            typeOverridden: (type) => !!type && type in colorOverrides.types,
            nodeColorOf: (id) =>
                colorOverrides.nodes[id] ??
                (id === selectedVertex
                    ? DEFAULT_THEME.centerColor
                    : typeColors[hypergraph?.vertices[id]?.entity_type] || DEFAULT_THEME.nodeColor),
            nodeOverridden: (id) => id in colorOverrides.nodes,
            hyperedgeColorOf: (id) => hyperedgeColors?.[id] ?? DEFAULT_THEME.hyperedgeColors[0],
            hyperedgeOverridden: (id) => id in colorOverrides.hyperedges,
            hyperedgeTypeColorOf: (type) => hyperedgeTypeColors[type],
            hyperedgeTypeOverridden: (type) => type in colorOverrides.hyperedgeTypes,
            setTypeColor: setIn("types"),
            setNodeColor: setIn("nodes"),
            setHyperedgeColor: setIn("hyperedges"),
            setHyperedgeTypeColor: setIn("hyperedgeTypes"),
            reset: () => setColorOverrides(EMPTY_COLOR_OVERRIDES),
        };
    }, [typeColors, hyperedgeColors, hyperedgeTypeColors, colorOverrides, setColorOverrides, hypergraph, selectedVertex]);

    const theme = useMemo(
        () => ({
            labelFontSize: renderSettings.labelFontSize,
            bubble: {
                ...DEFAULT_THEME.bubble,
                normal: { ...DEFAULT_THEME.bubble.normal, fillOpacity: renderSettings.fillOpacity },
            },
        }),
        [renderSettings.labelFontSize, renderSettings.fillOpacity]
    );
    const layout = useMemo(
        () => ({
            type: renderSettings.layout,
            nodeSpacing: renderSettings.nodeSpacing,
            preventLabelOverlap: renderSettings.preventLabelOverlap,
            useCenter: renderSettings.useCenter,
        }),
        [renderSettings.layout, renderSettings.nodeSpacing, renderSettings.preventLabelOverlap, renderSettings.useCenter]
    );
    // 标签：全部 / 仅中心与枢纽 / 不显示
    const labelText = useMemo(() => {
        if (renderSettings.labelMode === "none") return () => "";
        if (renderSettings.labelMode === "key") {
            const keep = new Set(stats?.hubs);
            return (d) => (d.id === selectedVertex || keep.has(d.id) ? String(d.id) : "");
        }
        return undefined;
    }, [renderSettings.labelMode, stats, selectedVertex]);

    const viewOptions = {
        mode: visualizationMode,
        centerNode: selectedVertex,
        typeColors,
        nodeColors: colorOverrides.nodes,
        hyperedgeColors,
        graphEdges: renderSettings.graphEdges,
        contours: renderSettings.contours,
        contourBounds: renderSettings.contourBounds,
        nodeSizeBy: renderSettings.nodeSizeBy,
        layout,
        labelText,
        theme,
    };

    const onSelectionChange = (next, { hit }) => {
        setSelection(next);
        if (!hit) return;
        if (hit.kind === "node") {
            setFocusId(hit.id);
            setHoverNode(hit.item);
        } else {
            setFocusId(hit.kind === "hyperedge" ? hit.id : hit.hyperedges?.[0]);
            setHoverHyperedge(hit.item);
        }
    };

    // 左侧超边列表：当前子图含该超边时直接选中；否则以其成员中子图最大的实体为中心，加载后选中
    const onPickHyperedge = (he) => {
        const target = { nodes: [], hyperedges: [he.id] };
        setHoverHyperedge(he);
        if (hypergraph?.hyperedges.some((h) => hyperedgeIdOf(h) === he.id)) {
            setHidden((h) => (h.hyperedges.includes(he.id) ? { ...h, hyperedges: h.hyperedges.filter((x) => x !== he.id) } : h));
            setSelection(target);
            return;
        }
        const sizes = centerSizes();
        const center = he.members
            .filter((m) => sizes.has(m))
            .sort((a, b) => sizes.get(b) - sizes.get(a))[0];
        if (center === undefined) return;
        pendingSelectionRef.current = target;
        setSelectedVertex(center);
    };

    // 表格行悬停：画布上临时高亮
    const onRowHover = (target) => viewRef.current?.hover(target);

    // 点表格行名称：在详情区显示
    const onShowDetails = (kind, id) => {
        if (kind === "node") {
            setHoverNode({ ...hypergraph.vertices[id], id, label: id });
        } else {
            const he = hypergraph.hyperedges.find((h) => hyperedgeIdOf(h) === id);
            if (he) setHoverHyperedge({ ...he, id, members: stats.members.get(id) });
        }
    };

    const hiddenChips = useMemo(() => {
        const label = (id) => {
            const he = hypergraph?.hyperedges.find((h) => hyperedgeIdOf(h) === id);
            return String(he?.description || he?.summary || stats?.members.get(id)?.join("、") || id);
        };
        return [
            ...hidden.nodes.map((id) => ({ kind: "nodes", id, label: id })),
            ...hidden.hyperedges.map((id) => ({ kind: "hyperedges", id, label: label(id) })),
        ];
    }, [hidden, hypergraph, stats]);

    // 图模式只画 2 个顶点的超边，按顶点对去重后的连线数
    const lineCount = useMemo(() => {
        if (!visibleHypergraph) return 0;
        const pairs = visibleHypergraph.hyperedges.filter((he) => new Set(he.members).size === 2);
        return new Set(pairs.map((he) => pairId(...new Set(he.members)))).size;
    }, [visibleHypergraph]);

    // Select the "largest" node and hyperedges by default
    useEffect(() => {
        if (!hypergraph) return;

        const nodes = Object.entries(hypergraph.vertices).map(([id, v]) => ({ ...v, id, label: id }));
        if (!hoverNode && nodes.length > 0) {
            const nodeWithMax = nodes.reduce((best, cur) =>
                (cur.degree || 0) > (best.degree || 0) ? cur : best
            );
            setHoverNode(nodeWithMax);
        }

        if (visualizationMode === "hyper") {
            const hyperEdges = hypergraph.hyperedges.filter((he) => new Set(he.members).size > 2);
            if (!hoverHyperedge && hyperEdges.length > 0) {
                const getWeight = (edge) =>
                    edge.weight || edge.members?.length || 0;
                const hyperWithMax = hyperEdges.reduce((best, cur) =>
                    getWeight(cur) > getWeight(best) ? cur : best
                );

                setHoverHyperedge({
                    ...hyperWithMax,
                    description:
                        hyperWithMax.description || hyperWithMax.summary || "",
                    members: hyperWithMax.members || [],
                    weight: getWeight(hyperWithMax),
                });
            }
        }
    }, [hypergraph, visualizationMode, hoverNode, hoverHyperedge]);

    return (
        <div className="flex h-screen bg-linear-to-br from-gray-50 to-gray-100">
            {/* Sidebar with integrated Data Source Selector */}
            <Sidebar
                loadedHypergraph={loadedHypergraph}
                loadedStats={loadedStats}
                vertexTypes={vertexTypes}
                setVertexTypes={setVertexTypes}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                vertices={vertices}
                loadingVertices={loadingVertices || dataSourceLoading}
                selectedVertex={selectedVertex}
                setSelectedVertex={setSelectedVertex}
                pagination={pagination}
                handlePageChange={handlePageChange}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
                hyperedges={hyperedgeList}
                hyperedgeSearch={hyperedgeSearch}
                setHyperedgeSearch={setHyperedgeSearch}
                onPickHyperedge={onPickHyperedge}
                selectedHyperedges={selection.hyperedges}
                typeColorOf={colors.typeColorOf}
                // Data source props
                onDataSourceChange={handleDataSourceChange}
                currentDataSource={currentDataSource}
                dataSourceLoading={dataSourceLoading}
                dataSourceError={dataSourceError}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-white/10 backdrop-blur-sm">
                <div className="bg-white/95 p-4 border-b border-gray-200/50 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-4">
                        <h3 className="text-xl font-semibold text-gray-800 m-0">
                            {t(visualizationMode === "hyper" ? "titleHyper" : "titleGraph")}{" "}
                            {selectedVertex && `- ${selectedVertex}`}
                        </h3>

                        {/* Visualization Mode Selector */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">{t("modeLabel")}</span>
                            <div className="flex space-x-1">
                                {["hyper", "graph"].map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => setVisualizationMode(mode)}
                                        className={`px-3 py-1 text-xs rounded-full transition-all duration-200 ${visualizationMode === mode
                                            ? "bg-primary-500 text-white shadow-md"
                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                            }`}
                                    >
                                        {t(mode === "hyper" ? "modeHyper" : "modeGraph")}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                    {graphData && visibleHypergraph && (
                        <div className="bg-white px-4 py-2 text-sm text-gray-600 rounded-lg shadow-sm border border-gray-200">
                            <span className="font-semibold">{t("verticesLabel")}</span>{" "}
                            {Object.keys(visibleHypergraph.vertices).length}
                            {hidden.nodes.length > 0 && ` / ${Object.keys(graphData.vertices).length}`} |
                            <span className="font-semibold ml-1">
                                {t(visualizationMode === "hyper" ? "hyperedgesLabel" : "edgesLabel")}
                            </span>{" "}
                            {visualizationMode === "hyper"
                                ? visibleHypergraph.hyperedges.length
                                : lineCount}
                            {visualizationMode === "hyper" &&
                                visibleHypergraph.hyperedges.length !== hypergraph.hyperedges.length &&
                                ` / ${hypergraph.hyperedges.length}`}
                        </div>
                    )}
                        <div
                            className="flex rounded-lg border border-gray-200 overflow-hidden text-xs"
                            role="group"
                            aria-label="Language"
                        >
                            {LANGUAGES.map(([code, name]) => (
                                <button
                                    key={code}
                                    onClick={() => setLang(code)}
                                    className={`px-2.5 py-1 ${lang === code
                                        ? "bg-primary-500 text-white"
                                        : "bg-white text-gray-600 hover:bg-gray-50"
                                        }`}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex-1 relative bg-white">
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
                                <div className="font-semibold">
                                    {t("loadingGraph")}
                                </div>
                                <div className="text-sm mt-2 text-gray-500">
                                    {t("loadingHint")}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex h-[calc(100vh-71px)]">
                        <GraphContainer
                            hypergraph={hypergraph}
                            data={visibleHypergraph}
                            viewRef={viewRef}
                            viewOptions={viewOptions}
                            selection={selection}
                            onSelectionChange={onSelectionChange}
                            pinned={!isEmptySelection(selection)}
                            hiddenChips={hiddenChips}
                            onRestore={(kind, id) =>
                                setHidden((h) => ({ ...h, [kind]: h[kind].filter((x) => x !== id) }))
                            }
                            onRestoreAll={() => setHidden(EMPTY_HIDDEN)}
                            setHoverHyperedge={setHoverHyperedge}
                            setHoverNode={setHoverNode}
                        />
                        <InspectorPanel
                            hypergraph={hypergraph}
                            visibleHypergraph={visibleHypergraph}
                            stats={stats}
                            visibleStats={visibleStats}
                            centerNode={selectedVertex}
                            mode={visualizationMode}
                            settings={renderSettings}
                            setSettings={setRenderSettings}
                            onResetSettings={() => setRenderSettings(DEFAULT_RENDER_SETTINGS)}
                            colors={colors}
                            selection={selection}
                            setSelection={setSelection}
                            hidden={hidden}
                            setHidden={setHidden}
                            onRowHover={onRowHover}
                            onShowDetails={onShowDetails}
                            focusId={focusId}
                            hoverHyperedge={hoverHyperedge}
                            hoverNode={hoverNode}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}