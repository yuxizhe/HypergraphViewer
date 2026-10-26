import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HypergraphView, IncidenceMatrixView } from '../react';
import HoverTip, { tipOf } from './HoverTip.jsx';
import { useI18n } from './i18n.jsx';

const MAX_CHIPS = 12;

// 子图编号：换子图时视图以新的 key 重新挂载
let graphSeq = 0;

// 画布下方的「已隐藏」标签条：点 × 恢复单个，「全部恢复」清空。淡出的实体为虚线框；compact（手机）时为可左右滑动的一行
const HiddenChips = ({ chips, onRestore, onRestoreAll, compact }) => {
    const { t } = useI18n();
    if (!chips.length) return null;
    return (
        <div
            className={`absolute bottom-2 left-2 right-2 z-10 flex items-center gap-1 text-xs ${
                compact ? "flex-nowrap overflow-x-auto whitespace-nowrap [&>*]:shrink-0" : "flex-wrap pointer-events-none"
            }`}
        >
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
    matrixOrder,
    selection,
    onSelectionChange,
    pinned,
    hiddenChips,
    onRestore,
    onRestoreAll,
    setHoverHyperedge,
    setHoverNode,
    onCanvasHover,
    compact = false,
}) => {
    const [tip, setTip] = useState(null);
    const { lang } = useI18n();
    const rootRef = useRef(null);
    // 换子图后重新创建视图（新的 G6 实例）：同一条超边在前后两个子图中的成员可能不同（淡出的实体不同），
    // 在原实例上换数据时，轮廓、元素状态、未完成的布局都会沿用上一个子图的；隐藏、淡出实体仍在原实例上更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const viewKey = useMemo(() => ++graphSeq, [hypergraph]);

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
        onCanvasHover?.(
            !hit
                ? null
                : hit.kind === "node"
                  ? { nodes: [hit.id] }
                  : { hyperedges: hit.kind === "hyperedge" ? [hit.id] : hit.hyperedges || [] }
        );
        // 悬停卡片只在指针位于元素上时显示
        setTip(hit ? { ...tipOf(hit, new Set(viewOptions.fadedNodes)), x: hit.client.x, y: hit.client.y } : null);
    };

    return (
        <div ref={rootRef} className="relative flex-1 min-w-0 h-full bg-white">
            {data && viewOptions.mode === "matrix" && (
                // 关联矩阵：淡出的枢纽也列出（行首虚线圈），选择、悬停、颜色与画布共用
                <IncidenceMatrixView
                    key={viewKey}
                    ref={viewRef}
                    className="w-full h-full"
                    data={data}
                    order={matrixOrder}
                    centerNode={viewOptions.centerNode}
                    typeColors={viewOptions.typeColors}
                    nodeColors={viewOptions.nodeColors}
                    hyperedgeColors={viewOptions.hyperedgeColors}
                    hubNodes={viewOptions.fadedNodes}
                    rowHeaderWidth={compact ? 120 : 168}
                    // 底部「已隐藏」标签条不挡住最后几行
                    bottomPadding={hiddenChips.length ? (compact ? 40 : 64) : 8}
                    selection={selection}
                    onSelectionChange={onSelectionChange}
                    onHover={onHover}
                    toolbar={{ locale: lang, fullscreen: rootRef, size: compact ? "large" : "default" }}
                />
            )}
            {data && viewOptions.mode !== "matrix" && (
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
                    // 全屏：整个画布区域（含悬停卡片、已隐藏标签条）进入全屏
                    toolbar={{ locale: lang, fullscreen: rootRef, size: compact ? "large" : "default" }}
                />
            )}
            <HiddenChips chips={hiddenChips} onRestore={onRestore} onRestoreAll={onRestoreAll} compact={compact} />
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
