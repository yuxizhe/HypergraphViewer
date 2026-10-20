import React, { useEffect, useMemo, useRef, useState } from 'react';
import Section from './panel/Section.jsx';
import StatsTab from './panel/StatsTab.jsx';
import TypeChips from './panel/TypeChips.jsx';
import { useI18n } from './i18n.jsx';

const ROW = "grid grid-cols-[58px_minmax(0,1fr)] items-center gap-2";

const SearchBox = ({ value, onChange, placeholder }) => (
    <div className="relative mb-2 shrink-0">
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-7 pr-6 py-1 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
        />
        <svg className="absolute left-2 top-1.5 h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {value && (
            <button onClick={() => onChange("")} className="absolute right-2 top-1 text-gray-400 hover:text-gray-600 text-xs">
                ×
            </button>
        )}
    </div>
);

const Bar = ({ value, max }) => (
    <span className="flex items-center gap-1 text-xs text-gray-600">
        <span className="h-2 bg-gray-400 rounded-sm" style={{ width: `${(value / Math.max(1, max)) * 30}px` }} />
        <span className="tabular-nums">{value}</span>
    </span>
);

// 选中集合中增删一个类型
const toggleIn = (list, type) => (list.includes(type) ? list.filter((x) => x !== type) : [...list, type]);

// 左侧栏：宿主的插槽（如数据源选择）、已载入超图的统计、实体列表（点选切换中心实体）、超边列表（点选跳到含该超边的子图并选中）；
// 实体、超边列表均可按类型筛选。title：栏顶标题，不传时不显示；header：插在统计卡片之前（可用 Section 做成同样的卡片）
const DatabasePanel = ({
    title,
    header,
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
    hyperedges,
    hyperedgeSearch,
    setHyperedgeSearch,
    onPickHyperedge,
    hasHyperedgeList = true,
    selectedHyperedges,
    typeColorOf,
    className = "",
}) => {
    const { t } = useI18n();
    const [open, setOpen] = useState({ stats: true, nodes: true, hyperedges: false });
    const [hyperedgeTypes, setHyperedgeTypes] = useState([]);
    const toggle = (key) => () => setOpen((o) => ({ ...o, [key]: !o[key] }));
    // 换数据源、换页、搜索后列表回到顶部
    const vertexListRef = useRef(null);
    const hyperedgeListRef = useRef(null);
    useEffect(() => {
        if (vertexListRef.current) vertexListRef.current.scrollTop = 0;
    }, [vertices]);
    useEffect(() => {
        if (hyperedgeListRef.current) hyperedgeListRef.current.scrollTop = 0;
    }, [hyperedges, hyperedgeTypes]);

    const typeOfHyperedge = (he) => he.type || null;
    const hyperedgeTypeChips = useMemo(() => {
        const count = new Map();
        hyperedges.forEach((he) => {
            const type = typeOfHyperedge(he);
            if (type) count.set(type, (count.get(type) || 0) + 1);
        });
        return [...count].sort((a, b) => b[1] - a[1]).map(([type, n]) => ({ type, label: type, count: n }));
    }, [hyperedges]);
    // 换数据源后已不存在的超边类型筛选作废
    useEffect(() => {
        setHyperedgeTypes((prev) => {
            const next = prev.filter((x) => hyperedgeTypeChips.some((c) => c.type === x));
            return next.length === prev.length ? prev : next;
        });
    }, [hyperedgeTypeChips]);
    const shownHyperedges = useMemo(
        () => (hyperedgeTypes.length ? hyperedges.filter((he) => hyperedgeTypes.includes(typeOfHyperedge(he))) : hyperedges),
        [hyperedges, hyperedgeTypes]
    );
    const vertexTypeChips = (loadedHypergraph?.listedTypes || []).map(({ type, count }) => ({
        type,
        label: type ?? t("untyped"),
        count,
        color: typeColorOf(type),
    }));
    const typeOf = useMemo(() => (id) => loadedHypergraph?.vertices[id]?.entity_type || null, [loadedHypergraph]);
    const database = loadedHypergraph?.database;
    const partial =
        database && loadedStats && (database.vertices > loadedStats.vertexCount || database.edges > loadedStats.members.size);

    const maxNeighborhood = Math.max(1, ...vertices.map((v) => v.degree || 0));
    const maxSize = Math.max(1, ...shownHyperedges.map((h) => h.members.length));
    const sortHeader = (key, label) => (
        <button
            className={`text-left truncate hover:text-gray-900 ${sortBy === key ? "text-gray-900" : ""}`}
            onClick={() => onSort(key)}
        >
            {label}
            {sortBy === key && (sortOrder === "desc" ? " ▾" : " ▴")}
        </button>
    );

    return (
        <div className={`w-80 h-full bg-white/95 backdrop-blur-sm border-r border-gray-200/50 shadow-xl shrink-0 flex flex-col ${className}`}>
            {title && (
                <h2 className="text-xl font-bold text-gray-800 px-3 py-3 border-b border-gray-200 shrink-0">
                    {title}
                </h2>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
                {header}

                <Section title={t("databaseInfo")} open={open.stats} onToggle={toggle("stats")}>
                    {!loadedStats && database && (
                        <div className="text-xs text-gray-600">
                            {t("verticesLabel")} {database.vertices} · {t("hyperedgesLabel")} {database.edges}
                        </div>
                    )}
                    {loadedStats && (
                        <>
                            {partial && (
                                <div className="mb-2 text-[11px] text-gray-400">
                                    {t("partialDataNote", { v: database.vertices, e: database.edges })}
                                </div>
                            )}
                            <StatsTab
                                stats={loadedStats}
                                typeOf={typeOf}
                                colorOfType={typeColorOf}
                                onTypeClick={(type) => setVertexTypes((list) => toggleIn(list, type))}
                                showHubs={false}
                            />
                        </>
                    )}
                </Section>

                {/* 实体列表下方还有分页，最小高度多留一行 */}
                <Section title={t("tab_nodes")} count={pagination.total} open={open.nodes} onToggle={toggle("nodes")} grow minH="min-h-[268px]">
                    <SearchBox value={searchTerm} onChange={setSearchTerm} placeholder={t("searchPlaceholder")} />
                    <TypeChips
                        chips={vertexTypeChips}
                        selected={vertexTypes}
                        onToggle={(type) => setVertexTypes((list) => toggleIn(list, type))}
                        onClear={() => setVertexTypes([])}
                    />
                    <div className={`${ROW} shrink-0 px-1 pb-1 text-xs font-semibold text-gray-500 border-b border-gray-200`}>
                        {sortHeader("degree", t("neighborhoodCol"))}
                        {sortHeader("id", t("nameCol"))}
                    </div>
                    <div ref={vertexListRef} className="flex-1 min-h-0 overflow-y-auto">
                        {loadingVertices ? (
                            <div className="p-3 text-center text-xs text-gray-400">{t("loadingVertices")}</div>
                        ) : vertices.length === 0 ? (
                            <div className="p-3 text-center text-xs text-gray-400">{t("noMatch")}</div>
                        ) : (
                            vertices.map((v) => (
                                <button
                                    key={v.id}
                                    onClick={() => setSelectedVertex(v.id)}
                                    title={v.description ? `${v.id}\n${v.description}` : v.id}
                                    className={`${ROW} w-full text-left px-1 py-1 text-xs border-b border-gray-50 ${String(selectedVertex) === String(v.id)
                                        ? "bg-primary-50 shadow-[inset_3px_0_0] shadow-primary-500"
                                        : "hover:bg-gray-50"
                                        }`}
                                >
                                    <Bar value={v.degree || 0} max={maxNeighborhood} />
                                    <span className="flex items-center gap-1 min-w-0">
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: typeColorOf(v.entity_type || null) }} />
                                        <span className={`truncate ${String(selectedVertex) === String(v.id) ? "font-semibold text-primary-700" : "text-gray-800"}`}>
                                            {v.id}
                                        </span>
                                        {v.entity_type && (
                                            <span className="shrink-0 px-1 rounded bg-gray-100 text-gray-500 text-[10px]">{v.entity_type}</span>
                                        )}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                    {pagination.total_pages > 1 && (
                        <div className="flex items-center justify-between pt-1.5 text-xs text-gray-600 shrink-0">
                            <button
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={pagination.page === 1}
                                className="px-2 py-0.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                            >
                                {t("prev")}
                            </button>
                            <span className="tabular-nums">
                                {pagination.page} / {pagination.total_pages}
                            </span>
                            <button
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={pagination.page === pagination.total_pages}
                                className="px-2 py-0.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                            >
                                {t("next")}
                            </button>
                        </div>
                    )}
                </Section>

                {hasHyperedgeList && <Section
                    title={t("tab_hyperedges")}
                    count={shownHyperedges.length}
                    open={open.hyperedges}
                    onToggle={toggle("hyperedges")}
                    grow
                >
                    <SearchBox value={hyperedgeSearch} onChange={setHyperedgeSearch} placeholder={t("hyperedgeSearchPlaceholder")} />
                    <TypeChips
                        chips={hyperedgeTypeChips}
                        selected={hyperedgeTypes}
                        onToggle={(type) => setHyperedgeTypes((list) => toggleIn(list, type))}
                        onClear={() => setHyperedgeTypes([])}
                    />
                    <div className={`${ROW} shrink-0 px-1 pb-1 text-xs font-semibold text-gray-500 border-b border-gray-200`}>
                        <span>{t("sizeCol")} ▾</span>
                        <span>{t("nameCol")}</span>
                    </div>
                    <div ref={hyperedgeListRef} className="flex-1 min-h-0 overflow-y-auto">
                        {shownHyperedges.length === 0 && <div className="p-3 text-center text-xs text-gray-400">{t("noRows")}</div>}
                        {shownHyperedges.map((he) => {
                            const name = String(he.description || he.summary || he.keywords || he.members.join("、")).replace(/<SEP>/g, " | ");
                            const active = selectedHyperedges.includes(he.id);
                            return (
                                <button
                                    key={he.id}
                                    onClick={() => onPickHyperedge(he)}
                                    title={`${name}\n${he.members.join("、")}`}
                                    className={`${ROW} w-full text-left px-1 py-1 text-xs border-b border-gray-50 ${active
                                        ? "bg-primary-50 shadow-[inset_3px_0_0] shadow-primary-500"
                                        : "hover:bg-gray-50"
                                        }`}
                                >
                                    <Bar value={he.members.length} max={maxSize} />
                                    <span className="flex items-center gap-1 min-w-0">
                                        {he.type && (
                                            <span className="shrink-0 px-1 rounded bg-gray-100 text-gray-600 text-[10px]">{he.type}</span>
                                        )}
                                        <span className="truncate text-gray-800">{name}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </Section>}
            </div>
        </div>
    );
};

export default DatabasePanel;
