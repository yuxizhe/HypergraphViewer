import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HypergraphView } from 'hypergraph-viz/react';
import HoverTip from './HoverTip.jsx';
import { HYPEREDGE_FIELD_LIMIT, HYPEREDGE_PRIORITY, HYPEREDGE_TIP_EXCLUDED } from '../constants.js';
import { useI18n } from '../i18n.jsx';

// 悬停目标 → 悬停卡片内容：顶点 → 顶点属性（另列只剩它一个成员的、与枢纽实体的超边）；连线（2 个顶点的超边）/ 超边轮廓 → 超边属性
const tipOf = (hit, hiddenIds) => {
    if (hit.kind === "node") {
        const related = hit.fadedHyperedges?.map((he) => ({
            id: he.id,
            with: he.members.filter((m) => hiddenIds.has(m)),
            // 描述：edgeName、description、keywords 依次拼接（缺的跳过）
            text: [he.edgeName, he.description, he.keywords]
                .map((v) => (Array.isArray(v) ? v.join(", ") : v))
                .filter(Boolean)
                .join(" | ")
                .replace(/<SEP>/g, " | "),
        }));
        return { title: "node", item: hit.item, related };
    }
    return {
        title: hit.kind,
        item: hit.item,
        priority: HYPEREDGE_PRIORITY,
        // 没有 type 的超边（如 Hyper-RAG 原版抽取的图）仍显示 keywords
        exclude: hit.item.type ? HYPEREDGE_TIP_EXCLUDED : [],
        limit: HYPEREDGE_FIELD_LIMIT,
    };
};

const MAX_CHIPS = 12;

// 子图编号：换子图时视图以新的 key 重新挂载
let graphSeq = 0;

// 工具栏图标（24×24 线条）
const ICONS = {
    zoomIn: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm9 16-4-4M11 8v6M8 11h6",
    zoomOut: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm9 16-4-4M8 11h6",
    fitView: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z",
    fullscreen: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
    exitFullscreen: "M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5",
};

const ToolButton = ({ icon, title, onClick }) => (
    <button
        onClick={onClick}
        title={title}
        aria-label={title}
        className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    >
        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d={ICONS[icon]} />
        </svg>
    </button>
);

// 画布右上角工具栏：放大、缩小、视图居中、全屏
const Toolbar = ({ viewRef, fullscreen, onToggleFullscreen }) => {
    const { t } = useI18n();
    const zoom = (ratio) => viewRef.current?.graph.zoomBy(ratio, { duration: 200 });
    return (
        <div className="absolute top-2 right-2 z-10 flex rounded-md border border-gray-200 bg-white/90 shadow-sm overflow-hidden divide-x divide-gray-200">
            <ToolButton icon="zoomIn" title={t("zoomIn")} onClick={() => zoom(1.25)} />
            <ToolButton icon="zoomOut" title={t("zoomOut")} onClick={() => zoom(0.8)} />
            <ToolButton icon="fitView" title={t("fitView")} onClick={() => viewRef.current?.fitView()} />
            <ToolButton
                icon={fullscreen ? "exitFullscreen" : "fullscreen"}
                title={t(fullscreen ? "exitFullscreen" : "fullscreen")}
                onClick={onToggleFullscreen}
            />
        </div>
    );
};

// 画布下方的「已隐藏」标签条：点 × 恢复单个，「全部恢复」清空。淡出的实体为虚线框
const HiddenChips = ({ chips, onRestore, onRestoreAll }) => {
    const { t } = useI18n();
    if (!chips.length) return null;
    return (
        <div className="absolute bottom-2 left-2 right-2 z-10 flex flex-wrap items-center gap-1 text-xs pointer-events-none">
            <span className="px-1.5 py-0.5 rounded bg-gray-800/80 text-white pointer-events-auto">{t("hiddenLabel")}</span>
            {chips.slice(0, MAX_CHIPS).map((c) => (
                <span
                    key={`${c.kind}:${c.id}`}
                    className={`inline-flex items-center gap-1 max-w-48 pl-2 pr-1 py-0.5 rounded-full bg-white/90 border shadow-sm pointer-events-auto ${c.faded ? "border-dashed border-primary-500 text-primary-700" : "border-gray-300"}`}
                    title={c.faded ? `${c.label}（${t("fadedHint")}）` : c.label}
                >
                    {c.kind === "hyperedges" && <span className="text-gray-400">⬭</span>}
                    <span className="truncate">{c.label}</span>
                    <button
                        onClick={() => onRestore(c.kind, c.id)}
                        className="w-4 h-4 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 leading-4"
                        aria-label={t("show")}
                    >
                        ×
                    </button>
                </span>
            ))}
            {chips.length > MAX_CHIPS && (
                <span className="px-1.5 py-0.5 rounded bg-white/90 border border-gray-300 pointer-events-auto">
                    +{chips.length - MAX_CHIPS}
                </span>
            )}
            <button
                onClick={onRestoreAll}
                className="px-2 py-0.5 rounded bg-primary-500 text-white hover:bg-primary-600 pointer-events-auto"
            >
                {t("restoreAll")}
            </button>
        </div>
    );
};

const GraphContainer = ({
    hypergraph,
    data,
    viewRef,
    viewOptions,
    selection,
    onSelectionChange,
    pinned,
    hiddenChips,
    onRestore,
    onRestoreAll,
    setHoverHyperedge,
    setHoverNode
}) => {
    const [tip, setTip] = useState(null);
    const rootRef = useRef(null);
    const [fullscreen, setFullscreen] = useState(false);
    // 换子图后重新创建视图（新的 G6 实例）：同一条超边在前后两个子图中的成员可能不同（淡出的实体不同），
    // 在原实例上换数据时，轮廓、元素状态、未完成的布局都会沿用上一个子图的；隐藏、淡出实体仍在原实例上更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const viewKey = useMemo(() => ++graphSeq, [hypergraph]);

    // 全屏：整个画布区域（含悬停卡片、已隐藏标签条）进入全屏；进出全屏后画布尺寸变化，重新撑满
    useEffect(() => {
        const onChange = () => {
            setFullscreen(document.fullscreenElement === rootRef.current);
            setTimeout(() => viewRef.current?.fitView(false), 100);
        };
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
    }, [viewRef]);
    const toggleFullscreen = () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else rootRef.current?.requestFullscreen?.();
    };

    // 换子图或模式时清空悬停（隐藏元素不算换子图）
    useEffect(() => {
        setHoverHyperedge(null);
        setTip(null);
    }, [hypergraph, viewOptions.mode, setHoverHyperedge]);

    const onHover = (hit) => {
        // 有选中时详情区固定显示点选的元素，不随悬停变化
        if (hit?.kind !== "node" && hit && !pinned) {
            setHoverHyperedge((prev) => (prev?.id === hit.item.id ? prev : hit.item));
        }
        if (hit?.kind === "node" && !pinned) {
            setHoverNode((prev) => (prev?.id === hit.item.id ? prev : hit.item));
        }
        // 悬停卡片只在指针位于元素上时显示
        setTip(hit ? { ...tipOf(hit, new Set(viewOptions.fadedNodes)), x: hit.client.x, y: hit.client.y } : null);
    };

    return (
        <div ref={rootRef} className="relative flex-1 min-w-0 h-full bg-white">
            {data && (
                <HypergraphView
                    key={viewKey}
                    ref={viewRef}
                    className="w-full rounded-xl h-full"
                    data={data}
                    {...viewOptions}
                    selection={selection}
                    fallbackHeight={800}
                    autoFit="view"
                    fixLabelSize
                    hoverHighlight
                    onHover={onHover}
                    onSelectionChange={onSelectionChange}
                />
            )}
            {data && <Toolbar viewRef={viewRef} fullscreen={fullscreen} onToggleFullscreen={toggleFullscreen} />}
            <HiddenChips chips={hiddenChips} onRestore={onRestore} onRestoreAll={onRestoreAll} />
            {tip && (
                <HoverTip
                    title={tip.title}
                    item={tip.item}
                    priority={tip.priority}
                    exclude={tip.exclude}
                    limit={tip.limit}
                    related={tip.related}
                    x={tip.x}
                    y={tip.y}
                />
            )}
        </div>
    );
};

export default GraphContainer;
