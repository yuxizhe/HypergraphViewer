import React, { useMemo, useRef, useState } from 'react';
import { hyperedgeIdOf } from '../../analysis';
import DetailsPanel from '../DetailsPanel.jsx';
import ElementTable from './ElementTable.jsx';
import Section, { Chevron } from './Section.jsx';
import RenderTab from './RenderTab.jsx';
import StatsTab from './StatsTab.jsx';
import { useI18n } from '../i18n.jsx';

// 超边在表格中的名称：description / summary / keywords，都没有时列出成员
const hyperedgeName = (item, members) =>
    String(item.description || item.summary || item.keywords || members.join("、")).replace(/<SEP>/g, " | ");

// 右侧面板：当前子图的统计、实体 / 超边表（选择、显隐、颜色）、渲染设置，各为一张可收起的卡片；
// 实体、超边默认展开并分享剩余高度，渲染、详情默认收起
// 整个面板（文字、表格、间距）缩小 10%，给画布多留空间
const PANEL_ZOOM = { zoom: 0.9 };

const InspectorPanel = ({
    hypergraph,
    visibleHypergraph,
    stats,
    visibleStats,
    centerNode,
    mode,
    settings,
    setSettings,
    onResetSettings,
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
}) => {
    const { t } = useI18n();
    const [open, setOpen] = useState({ stats: true, nodes: true, hyperedges: true, render: false });
    const [collapsed, setCollapsed] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const sectionRefs = { nodes: useRef(null), hyperedges: useRef(null) };
    const toggle = (key) => () => setOpen((o) => ({ ...o, [key]: !o[key] }));

    const itemOf = useMemo(() => {
        const map = new Map();
        hypergraph?.hyperedges.forEach((he) => {
            const id = hyperedgeIdOf(he);
            if (!map.has(id)) map.set(id, he);
        });
        return map;
    }, [hypergraph]);
    const visibleHyperedgeIds = useMemo(
        () => new Set(visibleHypergraph?.hyperedges.map(hyperedgeIdOf)),
        [visibleHypergraph]
    );
    const typeOf = useMemo(() => (id) => hypergraph?.vertices[id]?.entity_type || null, [hypergraph]);

    const selectedNodes = useMemo(() => new Set(selection.nodes), [selection]);
    const selectedHyperedges = useMemo(() => new Set(selection.hyperedges), [selection]);
    const hiddenNodes = useMemo(() => new Set(hidden.nodes), [hidden]);
    const hiddenHyperedges = useMemo(() => new Set(hidden.hyperedges), [hidden]);
    const hubs = useMemo(() => new Set(stats?.hubs), [stats]);

    const nodeRows = useMemo(() => {
        if (!hypergraph) return [];
        return Object.entries(hypergraph.vertices).map(([id, v]) => {
            const type = v.entity_type || null;
            const badges = [];
            if (id === centerNode) badges.push({ text: t("badgeCenter"), cls: "bg-primary-50 text-primary-700" });
            if (hubs.has(id)) badges.push({ text: t("badgeHub"), cls: "bg-amber-100 text-amber-700" });
            return {
                id,
                name: id,
                value: stats.degree.get(id) || 0,
                type,
                color: colors.nodeColorOf(id),
                colorOverridden: colors.nodeOverridden(id),
                hidden: hiddenNodes.has(id),
                badges,
                title: v.description ? `${id}\n${v.description}` : id,
                search: `${id} ${type ?? ""} ${v.description ?? ""}`,
            };
        });
    }, [hypergraph, stats, colors, hiddenNodes, centerNode, hubs, t]);

    const notDrawnInGraph = mode === "graph" && settings.graphEdges === "binary";
    const hyperedgeRows = useMemo(() => {
        if (!stats) return [];
        return [...stats.members].map(([id, members]) => {
            const item = itemOf.get(id) || {};
            const isHidden = hiddenHyperedges.has(id);
            const dropped = !isHidden && !visibleHyperedgeIds.has(id);
            const name = hyperedgeName(item, members);
            return {
                id,
                name,
                value: members.length,
                type: item.type || null,
                prefix: item.type ? (
                    <span className="shrink-0 px-1 rounded bg-gray-100 text-gray-600 text-[10px]">{item.type}</span>
                ) : null,
                // 2 元超边画成连线，不用轮廓色
                color: members.length > 2 ? colors.hyperedgeColorOf(id) : undefined,
                colorOverridden: colors.hyperedgeOverridden(id),
                hidden: isHidden,
                dropped,
                note: dropped
                    ? t("noteMembersHidden")
                    : notDrawnInGraph && members.length > 2
                        ? t("noteNotDrawnInGraph")
                        : null,
                title: `${name}\n${members.join("、")}`,
                search: `${name} ${item.type ?? ""} ${members.join(" ")}`,
            };
        });
    }, [stats, itemOf, hiddenHyperedges, visibleHyperedgeIds, colors, notDrawnInGraph, t]);

    const hyperedgeTypeChips = useMemo(() => {
        const count = new Map();
        hyperedgeRows.forEach((r) => r.type && count.set(r.type, (count.get(r.type) || 0) + 1));
        return [...count]
            .sort((a, b) => b[1] - a[1])
            .map(([type, n]) => ({
                type,
                label: type,
                count: n,
                color: settings.hyperedgeColorBy === "type" ? colors.hyperedgeTypeColorOf(type) : null,
                overridden: colors.hyperedgeTypeOverridden(type),
            }));
    }, [hyperedgeRows, settings.hyperedgeColorBy, colors]);

    const nodeTypeChips = useMemo(
        () =>
            (stats?.types || []).map(({ type, count }) => ({
                type,
                label: type ?? t("untyped"),
                count,
                color: colors.typeColorOf(type),
                overridden: colors.typeOverridden(type),
            })),
        [stats, colors, t]
    );

    if (collapsed) {
        return (
            <div className="shrink-0 w-8 h-full bg-white/95 border-l border-gray-200/50 flex flex-col items-center pt-3" style={PANEL_ZOOM}>
                <button
                    onClick={() => setCollapsed(false)}
                    className="hover:[&>svg]:text-primary-600"
                    title={t("expandPanel")}
                >
                    <Chevron dir="left" />
                </button>
            </div>
        );
    }

    const toggleIn = (kind) => (id) =>
        setSelection((s) => ({
            ...s,
            [kind]: s[kind].includes(id) ? s[kind].filter((x) => x !== id) : [...s[kind], id],
        }));
    const selectMany = (kind) => (ids, on) =>
        setSelection((s) => {
            const set = new Set(s[kind]);
            ids.forEach((id) => (on ? set.add(id) : set.delete(id)));
            return { ...s, [kind]: [...set] };
        });
    // 手动隐藏为彻底隐藏，恢复时一并去掉淡出标记
    const toggleHidden = (kind) => (id) =>
        setHidden((h) => ({
            ...h,
            [kind]: h[kind].includes(id) ? h[kind].filter((x) => x !== id) : [...h[kind], id],
            faded: (h.faded || []).filter((x) => x !== id),
        }));

    // 统计卡片中点柱子 / 色段：选中并展开对应的表格
    const pick = (sel, kind) => {
        setSelection(sel);
        setOpen((o) => ({ ...o, [kind]: true }));
        requestAnimationFrame(() => sectionRefs[kind].current?.scrollIntoView({ block: "nearest" }));
    };

    const hideSelected = () => {
        setHidden((h) => ({
            faded: (h.faded || []).filter((id) => !selection.nodes.includes(id)),
            nodes: [...new Set([...h.nodes, ...selection.nodes])],
            hyperedges: [...new Set([...h.hyperedges, ...selection.hyperedges])],
        }));
    };

    // 只看所选：保留所选实体与所选超边的成员；选了超边时其余超边也隐藏
    const showOnlySelected = () => {
        const keep = new Set(selection.nodes);
        selection.hyperedges.forEach((id) => stats.members.get(id)?.forEach((m) => keep.add(m)));
        setHidden({
            nodes: Object.keys(hypergraph.vertices).filter((id) => !keep.has(id)),
            hyperedges: selection.hyperedges.length
                ? [...stats.members.keys()].filter((id) => !selectedHyperedges.has(id))
                : [],
        });
    };

    const nSel = selection.nodes.length + selection.hyperedges.length;
    const counts = { nodes: stats?.vertexCount ?? 0, hyperedges: stats?.members.size ?? 0 };

    return (
        <div className="shrink-0 w-96 h-full flex flex-col bg-white/95 backdrop-blur-sm border-l border-gray-200/50 shadow-xl" style={PANEL_ZOOM}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
                <span className="text-base font-bold text-gray-800">{t("panelTitle")}</span>
                <button
                    onClick={() => setCollapsed(true)}
                    className="hover:[&>svg]:text-primary-600"
                    title={t("collapsePanel")}
                >
                    <Chevron dir="right" />
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
                {!stats ? (
                    <div className="text-sm text-gray-400 text-center pt-6">{t("noGraph")}</div>
                ) : (
                    <>
                        <Section title={t("tab_stats")} open={open.stats} onToggle={toggle("stats")}>
                            <StatsTab
                                stats={stats}
                                visibleStats={visibleStats}
                                typeOf={typeOf}
                                colorOfType={colors.typeColorOf}
                                centerNode={centerNode}
                                hidden={hidden}
                                onPick={pick}
                                // 枢纽淡出：画布上不画，悬停、选中相关元素时显示关联
                                onToggleHubs={(ids, hide) => setHidden((h) => ({
                                    ...h,
                                    nodes: hide ? [...new Set([...h.nodes, ...ids])] : h.nodes.filter((id) => !ids.includes(id)),
                                    faded: hide
                                        ? [...new Set([...(h.faded || []), ...ids])]
                                        : (h.faded || []).filter((id) => !ids.includes(id)),
                                }))}
                            />
                        </Section>
                        <Section
                            title={t("tab_nodes")}
                            count={counts.nodes}
                            open={open.nodes}
                            onToggle={toggle("nodes")}
                            grow
                            sectionRef={sectionRefs.nodes}
                        >
                            <ElementTable
                                rows={nodeRows}
                                valueLabel={t("degreeCol")}
                                typeChips={nodeTypeChips}
                                onTypeColor={colors.setTypeColor}
                                onTypeColorReset={(type) => colors.setTypeColor(type, null)}
                                selectedIds={selectedNodes}
                                onToggleSelect={toggleIn("nodes")}
                                onSelectMany={selectMany("nodes")}
                                onToggleHidden={toggleHidden("nodes")}
                                onColor={colors.setNodeColor}
                                onColorReset={(id) => colors.setNodeColor(id, null)}
                                onRowHover={(id) => onRowHover(id === null ? null : { nodes: [id] })}
                                onRowClick={(id) => onShowDetails("node", id)}
                                focusId={focusId}
                            />
                        </Section>
                        <Section
                            title={t("tab_hyperedges")}
                            count={counts.hyperedges}
                            open={open.hyperedges}
                            onToggle={toggle("hyperedges")}
                            grow
                            sectionRef={sectionRefs.hyperedges}
                        >
                            <ElementTable
                                rows={hyperedgeRows}
                                valueLabel={t("sizeCol")}
                                typeChips={hyperedgeTypeChips}
                                onTypeColor={settings.hyperedgeColorBy === "type" ? colors.setHyperedgeTypeColor : null}
                                onTypeColorReset={(type) => colors.setHyperedgeTypeColor(type, null)}
                                selectedIds={selectedHyperedges}
                                onToggleSelect={toggleIn("hyperedges")}
                                onSelectMany={selectMany("hyperedges")}
                                onToggleHidden={toggleHidden("hyperedges")}
                                onColor={colors.setHyperedgeColor}
                                onColorReset={(id) => colors.setHyperedgeColor(id, null)}
                                onRowHover={(id) => onRowHover(id === null ? null : { hyperedges: [id] })}
                                onRowClick={(id) => {
                                    // 点超边行即选中 / 取消选中（隐藏的不能选，同勾选框），并在详情区显示
                                    if (!hiddenHyperedges.has(id)) toggleIn("hyperedges")(id);
                                    onShowDetails("hyperedge", id);
                                }}
                                focusId={focusId}
                            />
                        </Section>
                        <Section title={t("tab_render")} open={open.render} onToggle={toggle("render")}>
                            <RenderTab
                                settings={settings}
                                setSettings={setSettings}
                                mode={mode}
                                hasCenter={centerNode !== undefined && centerNode !== ""}
                                onResetSettings={onResetSettings}
                                onResetColors={colors.reset}
                            />
                        </Section>
                    </>
                )}
            </div>

            {nSel > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-2 border-t border-gray-200 bg-primary-50 text-xs">
                    <span className="text-primary-700 font-semibold mr-auto">
                        {t("selectedCount", { n: selection.nodes.length, m: selection.hyperedges.length })}
                    </span>
                    <button className="px-2 py-0.5 rounded bg-primary-500 text-white hover:bg-primary-600" onClick={showOnlySelected}>
                        {t("showOnlySelected")}
                    </button>
                    <button className="px-2 py-0.5 rounded border border-primary-500 text-primary-700 hover:bg-white" onClick={hideSelected}>
                        {t("hide")}
                    </button>
                    <button
                        className="px-2 py-0.5 rounded text-gray-600 hover:bg-white"
                        onClick={() => setSelection({ nodes: [], hyperedges: [] })}
                    >
                        {t("clearSelection")}
                    </button>
                </div>
            )}

            <div className={`border-t-2 border-primary-500 flex flex-col shrink-0 ${detailsOpen ? "h-[38%] min-h-40" : ""}`}>
                <button
                    onClick={() => setDetailsOpen((o) => !o)}
                    aria-expanded={detailsOpen}
                    className="flex items-center justify-between px-3 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50"
                >
                    {t("detail")}
                    <Chevron open={detailsOpen} />
                </button>
                {detailsOpen && (
                    <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
                        <DetailsPanel hoverHyperedge={hoverHyperedge} hoverNode={hoverNode} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default InspectorPanel;
