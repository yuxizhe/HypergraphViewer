import { useState, useEffect, useMemo, useRef } from 'react';
import { filterHypergraph, hyperedgeColorsOf, hyperedgeIdOf, hypergraphStats } from '../analysis';
import { EMPTY_SELECTION, isEmptySelection } from '../selection';
import { pairId } from '../spec';
import { DEFAULT_THEME, typeColorsOf } from '../theme';
import { DEFAULT_RENDER_SETTINGS, EMPTY_COLOR_OVERRIDES, useStoredState } from './settings.js';

// faded：隐藏的实体中“淡出”的部分（不参与布局，悬停、选中相关元素时在画布上显示与它们的关联），其余彻底隐藏
export const EMPTY_HIDDEN = { nodes: [], hyperedges: [], faded: [] };

// 在 map 中设置 / 删除（value 为 null）一项，返回新对象
const put = (map, key, value) => {
    const next = { ...map };
    if (value === null) delete next[key];
    else next[key] = value;
    return next;
};

/**
 * HypergraphExplorer 的全部状态：左栏（数据源的统计、实体列表、超边列表）、当前子图、选择与隐藏、渲染设置与颜色。
 * 返回 databaseProps / canvasProps / inspectorProps，分别交给 DatabasePanel / GraphCanvas / InspectorPanel，宿主可自行排布
 *
 * source：数据源（见 createLocalSource），换一个对象即重新载入；不传时用 data（单个超图）与 centerNode，没有左栏
 * defaultCenter：载入数据源后默认显示的中心实体（不设时为实体列表中的第一个）
 * hiddenTypes：打开子图时默认彻底隐藏的实体类型
 * defaultRenderSettings：「渲染」设置的默认值（覆盖 DEFAULT_RENDER_SETTINGS 中的项）
 * storageKey：渲染设置、颜色存到 localStorage 的键前缀；false 不存
 */
export function useHypergraphExplorer({
    source,
    data,
    centerNode,
    defaultCenter,
    hiddenTypes,
    defaultRenderSettings,
    storageKey = "hypergraph-viewer",
    pageSize = 50,
    onCenterChange,
    onSelectionChange: onSelectionChangeProp,
} = {}) {
    const searchTimeoutRef = useRef(null);
    // 换数据源时才读取的选项，经 ref 取最新值
    const optionsRef = useRef({});
    optionsRef.current = { defaultCenter, hiddenTypes, onCenterChange, onSelectionChange: onSelectionChangeProp };

    // 左侧栏：数据源概览（用于统计）、超边列表、实体类型筛选
    const [overview, setOverview] = useState(null);
    const [vertexTypes, setVertexTypes] = useState([]);
    const vertexTypesRef = useRef(vertexTypes);
    vertexTypesRef.current = vertexTypes;
    const [hyperedgeList, setHyperedgeList] = useState([]);
    const [hyperedgeSearch, setHyperedgeSearch] = useState("");
    // 从左侧超边列表跳到另一个子图时，子图加载后要选中的超边
    const pendingSelectionRef = useRef(null);
    const [vertices, setVertices] = useState([]);
    const [pagination, setPagination] = useState({
        page: 1,
        page_size: pageSize,
        total: 0,
        total_pages: 0,
    });
    const [selectedVertex, setSelectedVertex] = useState("");
    const [sourceGraph, setSourceGraph] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingVertices, setLoadingVertices] = useState(false);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState("degree");
    const [sortOrder, setSortOrder] = useState("desc");
    const [visualizationMode, setVisualizationMode] = useState("hyper");
    const [hoverHyperedge, setHoverHyperedge] = useState(null);
    const [hoverNode, setHoverNode] = useState(null);

    // 子图统计、选择与隐藏、渲染设置与颜色（右侧面板）
    const [selection, setSelection] = useState(EMPTY_SELECTION);
    const selectionSeenRef = useRef(selection);
    useEffect(() => {
        if (selection === selectionSeenRef.current) return;
        selectionSeenRef.current = selection;
        optionsRef.current.onSelectionChange?.(selection);
    }, [selection]);
    // 手动调整过的隐藏；hiddenGraph 为它所属的子图（换子图后、同步前用自动隐藏的结果，见下方 hidden）
    const [hiddenState, setHidden] = useState(EMPTY_HIDDEN);
    const [hiddenGraph, setHiddenGraph] = useState(null);
    const [focusId, setFocusId] = useState(null);
    // 宿主可改默认值（如不自动隐藏），用户在「渲染」里改过的仍以存下的为准
    const renderDefaults = useMemo(
        () => ({ ...DEFAULT_RENDER_SETTINGS, ...defaultRenderSettings }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [JSON.stringify(defaultRenderSettings ?? {})]
    );
    const [renderSettings, setRenderSettings] = useStoredState(storageKey && `${storageKey}-render`, renderDefaults);
    const [colorOverrides, setColorOverrides] = useStoredState(storageKey && `${storageKey}-colors`, EMPTY_COLOR_OVERRIDES);
    const viewRef = useRef(null);

    // 没有数据源时显示传入的超图，中心由宿主指定
    const center = source ? selectedVertex : centerNode ?? "";
    const hypergraph = source ? sourceGraph : data ?? null;

    useEffect(() => {
        if (source && selectedVertex) optionsRef.current.onCenterChange?.(selectedVertex);
    }, [source, selectedVertex]);

    // Generate entity type color mapping
    // 按整个数据源（已载入的实体）分配类型颜色，不随列表翻页、筛选变化；左右两栏共用
    const entityTypeColors = useMemo(() => {
        return typeColorsOf(overview?.vertices ? Object.values(overview.vertices) : vertices);
    }, [overview, vertices]);

    // Load vertices list
    // （当前选中的实体仍可作为中心时保留：翻页、搜索、排序不换中心，指定的默认中心也不被覆盖）
    const loadVertices = async (page, search, sortBy, sortOrder, centers = overview?.centers) => {
        if (!source) return;
        setLoadingVertices(true);
        try {
            const result = await source.listVertices({
                page,
                pageSize,
                search,
                sortBy,
                sortOrder,
                types: vertexTypesRef.current,
            });
            setVertices(result.data);
            setPagination(result.pagination);

            // If no vertex selected and data exists, select the first one
            if (result.data.length > 0) {
                setSelectedVertex((cur) => (cur && (!centers || centers.has(cur)) ? cur : result.data[0].id));
            }
        } catch (err) {
            console.error("Failed to load vertices:", err);
        } finally {
            setLoadingVertices(false);
        }
    };

    // 换数据源：清空上一份数据的选中与详情，读取概览与实体列表（加载后选中第一个实体或默认中心）
    useEffect(() => {
        if (!source) return;
        let cancelled = false;
        setSelectedVertex("");
        setSourceGraph(null);
        setOverview(null);
        setHoverNode(null);
        setHoverHyperedge(null);
        // 新数据的类型不同，清掉类型筛选
        vertexTypesRef.current = [];
        setVertexTypes((v) => (v.length ? [] : v));
        (async () => {
            try {
                const next = await source.overview();
                if (cancelled) return;
                setOverview(next);
                await loadVertices(1, searchTerm, sortBy, sortOrder, next.centers);
                if (cancelled) return;
                const preferred = optionsRef.current.defaultCenter;
                if (preferred && (!next.centers || next.centers.has(preferred))) setSelectedVertex(preferred);
            } catch (err) {
                console.error("Failed to load data source:", err);
                if (!cancelled) setError("loadFailed");
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [source]);

    // Search debounce
    const searchLoadedRef = useRef(false);
    useEffect(() => {
        // 首次由换数据源的 effect 载入
        if (!searchLoadedRef.current) {
            searchLoadedRef.current = true;
            return;
        }
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm]);

    // Reload when sort changes
    useEffect(() => {
        if (vertices.length > 0) {
            loadVertices(pagination.page, searchTerm, sortBy, sortOrder);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortBy, sortOrder]);

    // Load when page changes
    const handlePageChange = (newPage) => {
        loadVertices(newPage, searchTerm, sortBy, sortOrder);
    };

    // Load graph data
    // 也随 source 重新读取：换数据源时先清空再选回同一个中心，React 合并更新后 selectedVertex 不变，
    // 只看 selectedVertex 时画布会一直是空的（StrictMode 下首次加载执行两遍，刷新时常出现）
    useEffect(() => {
        if (!source || !selectedVertex) return;
        let cancelled = false;
        setLoading(true);
        setError("");
        source
            .subgraph(selectedVertex)
            .then((graph) => {
                if (!cancelled) setSourceGraph(graph);
            })
            .catch((err) => {
                // 存翻译键，显示时翻译
                if (!cancelled) setError("loadFailed");
                console.error(err);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [source, selectedVertex]);

    // 可浏览超边列表：搜索或换数据源时重新筛选
    useEffect(() => {
        if (!source?.listHyperedges) {
            setHyperedgeList([]);
            return;
        }
        const timer = setTimeout(() => {
            source.listHyperedges({ search: hyperedgeSearch }).then(setHyperedgeList).catch(console.error);
        }, 200);
        return () => clearTimeout(timer);
    }, [hyperedgeSearch, source]);

    // 概览带了实体与超边时统计全库（已载入部分）；只有数据库计数时左栏只显示计数
    const loadedHypergraph = useMemo(
        () => overview && { ...overview, vertices: overview.vertices || {}, hyperedges: overview.hyperedges || [] },
        [overview]
    );
    const loadedStats = useMemo(
        () => overview?.vertices && overview?.hyperedges && hypergraphStats(loadedHypergraph),
        [overview, loadedHypergraph]
    );

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

    // 打开子图时自动隐藏的实体：子图内度数（所在超边数，同右侧实体表的“度数”）超过阈值的，中心也不例外；
    // 以及指定默认隐藏的类型（如金融数据的“财季”）
    const autoHidden = (graph, threshold) => {
        if (!graph) return EMPTY_HIDDEN;
        const { degree } = hypergraphStats(graph);
        const types = new Set(optionsRef.current.hiddenTypes || []);
        // 度数超过阈值的淡出，指定类型的彻底隐藏
        const faded = Object.keys(graph.vertices).filter((id) => threshold && (degree.get(id) || 0) > threshold);
        const typed = Object.keys(graph.vertices).filter(
            (id) => !faded.includes(id) && types.has(graph.vertices[id]?.entity_type)
        );
        return faded.length || typed.length ? { nodes: [...faded, ...typed], hyperedges: [], faded } : EMPTY_HIDDEN;
    };

    // 当前子图自动隐藏的实体（改阈值由下方的 effect 处理）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const autoHiddenOfGraph = useMemo(() => autoHidden(hypergraph, renderSettings.autoHideDegree), [hypergraph]);
    // 换子图后的第一次渲染就用自动隐藏的结果：否则视图先按完整子图布局一次，紧接着又按隐藏后的重新布局，
    // 前一次没算完的布局会去更新已删除的节点（G6 报 Node not found / Unknown element type）
    const hidden = hiddenGraph === hypergraph ? hiddenState : autoHiddenOfGraph;

    // 换子图时清空选择，隐藏重置为自动隐藏的实体（从左侧超边列表跳转来的选中该超边）
    useEffect(() => {
        setSelection(pendingSelectionRef.current ?? EMPTY_SELECTION);
        pendingSelectionRef.current = null;
        setHidden(autoHiddenOfGraph);
        setHiddenGraph(hypergraph);
        setFocusId(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hypergraph]);

    // 改了阈值：按新阈值重新隐藏当前子图的实体（手动隐藏的超边保留）
    const autoHideLoadedRef = useRef(false);
    useEffect(() => {
        if (!autoHideLoadedRef.current) {
            autoHideLoadedRef.current = true;
            return;
        }
        const { nodes, faded } = autoHidden(hypergraph, renderSettings.autoHideDegree);
        setHidden((h) => ({ ...h, nodes, faded }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [renderSettings.autoHideDegree]);

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
    // 画布的数据：淡出的实体留在数据里，由视图按 fadedNodes 处理
    const fadedNodes = useMemo(
        () => (hidden.faded || []).filter((id) => hidden.nodes.includes(id)),
        [hidden]
    );
    const viewData = useMemo(
        () =>
            hypergraph &&
            (fadedNodes.length
                ? filterHypergraph(hypergraph, {
                      nodes: hidden.nodes.filter((id) => !fadedNodes.includes(id)),
                      hyperedges: hidden.hyperedges,
                  })
                : visibleHypergraph),
        [hypergraph, hidden, fadedNodes, visibleHypergraph]
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
                (id === center
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
    }, [typeColors, hyperedgeColors, hyperedgeTypeColors, colorOverrides, setColorOverrides, hypergraph, center]);

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
            preventLabelOverlap: renderSettings.labelOverlap === "layout",
            useCenter: renderSettings.useCenter,
        }),
        [renderSettings.layout, renderSettings.nodeSpacing, renderSettings.labelOverlap, renderSettings.useCenter]
    );
    // 标签：全部 / 仅中心与枢纽 / 不显示；超过最大长度的截断（布局按截断后的宽度防重叠，悬停卡片仍显示全名）
    const labelText = useMemo(() => {
        if (renderSettings.labelMode === "none") return () => "";
        const max = renderSettings.labelMaxLength;
        const cut = (s) => (max && s.length > max ? `${s.slice(0, max - 1)}…` : s);
        if (renderSettings.labelMode === "key") {
            const keep = new Set(stats?.hubs);
            return (d) => (d.id === center || keep.has(d.id) ? cut(String(d.id)) : "");
        }
        return max ? (d) => cut(String(d.id)) : undefined;
    }, [renderSettings.labelMode, renderSettings.labelMaxLength, stats, center]);

    const viewOptions = {
        mode: visualizationMode,
        centerNode: center,
        typeColors,
        nodeColors: colorOverrides.nodes,
        hyperedgeColors,
        graphEdges: renderSettings.graphEdges,
        contours: renderSettings.contours,
        contourBounds: renderSettings.contourBounds,
        nodeSizeBy: renderSettings.nodeSizeBy,
        labelBy: renderSettings.labelBy,
        hideOverlappingLabels: renderSettings.labelOverlap === "hide",
        fadedNodes,
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
        // 数据源没有给出可作为中心的实体时，按全库度数取成员中最大的
        const sizes = overview?.centers ?? loadedStats?.degree ?? new Map();
        const pickable = he.members.filter((m) => !overview?.centers || sizes.has(m));
        const next = pickable.sort((a, b) => (sizes.get(b) || 0) - (sizes.get(a) || 0))[0];
        if (next === undefined) return;
        pendingSelectionRef.current = target;
        setSelectedVertex(next);
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
            ...hidden.nodes.map((id) => ({ kind: "nodes", id, label: id, faded: fadedNodes.includes(id) })),
            ...hidden.hyperedges.map((id) => ({ kind: "hyperedges", id, label: label(id) })),
        ];
    }, [hidden, hypergraph, stats, fadedNodes]);

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

    return {
        viewRef,
        hypergraph,
        visibleHypergraph,
        centerNode: center,
        mode: visualizationMode,
        setMode: setVisualizationMode,
        loading,
        error,
        lineCount,
        hidden,
        setHidden,
        selection,
        setSelection,
        databaseProps: {
            loadedHypergraph,
            loadedStats,
            vertexTypes,
            setVertexTypes,
            searchTerm,
            setSearchTerm,
            vertices,
            loadingVertices,
            selectedVertex,
            setSelectedVertex,
            pagination,
            handlePageChange,
            sortBy,
            sortOrder,
            onSort,
            hyperedges: hyperedgeList,
            hasHyperedgeList: !!source?.listHyperedges,
            hyperedgeSearch,
            setHyperedgeSearch,
            onPickHyperedge,
            selectedHyperedges: selection.hyperedges,
            typeColorOf: colors.typeColorOf,
        },
        canvasProps: {
            hypergraph,
            data: viewData,
            viewRef,
            viewOptions,
            selection,
            onSelectionChange,
            pinned: !isEmptySelection(selection),
            hiddenChips,
            onRestore: (kind, id) =>
                setHidden((h) => ({
                    ...h,
                    [kind]: h[kind].filter((x) => x !== id),
                    faded: (h.faded || []).filter((x) => x !== id),
                })),
            onRestoreAll: () => setHidden(EMPTY_HIDDEN),
            setHoverHyperedge,
            setHoverNode,
        },
        inspectorProps: {
            hypergraph,
            visibleHypergraph,
            stats,
            visibleStats,
            centerNode: center,
            mode: visualizationMode,
            settings: renderSettings,
            setSettings: setRenderSettings,
            onResetSettings: () => setRenderSettings(renderDefaults),
            colors,
            selection,
            setSelection,
            hidden,
            setHidden,
            onRowHover,
            onShowDetails,
            focusId,
            hoverHyperedge,
            hoverNode,
        },
    };
}
