import React, { useMemo } from 'react';
import MetricTag from './MetricTag.jsx';
import MiniHistogram, { binsOf } from './MiniHistogram.jsx';
import { useI18n } from '../../i18n.jsx';

const NO_HIDDEN = { nodes: [], hyperedges: [] };

// 超图统计：数字、类型构成、度数 / 大小分布、枢纽实体。
// 传 onPick 时点柱子、色段选中对应元素，枢纽可隐藏 / 选中；onTypeClick 覆盖色段的点击（左侧栏用来按类型筛选）；
// showHubs 为 false 时不显示枢纽提示
const StatsTab = ({
    stats,
    visibleStats = stats,
    typeOf,
    colorOfType,
    centerNode,
    hidden = NO_HIDDEN,
    onPick,
    onHideHubs,
    onTypeClick,
    showHubs = true,
}) => {
    const { t } = useI18n();
    const degreeBins = useMemo(() => binsOf([...stats.degree]), [stats]);
    const sizeBins = useMemo(() => binsOf([...stats.members].map(([id, m]) => [id, m.length])), [stats]);
    const typeIds = useMemo(() => {
        const out = new Map();
        stats.degree.forEach((_, id) => {
            const type = typeOf(id);
            out.set(type, [...(out.get(type) || []), id]);
        });
        return out;
    }, [stats, typeOf]);
    const hubs = stats.hubs.filter((id) => id !== centerNode);
    const total = stats.members.size;
    const hiddenHubs = hubs.filter((id) => hidden.nodes.includes(id));

    return (
        <div className="space-y-2.5 text-sm">
            <div className="flex flex-wrap gap-1.5">
                <MetricTag tone="violet" label={t("statVertices")} value={visibleStats.vertexCount} total={stats.vertexCount} />
                <MetricTag tone="amber" label={t("statHyperedges")} value={visibleStats.hyperedgeCount} total={stats.hyperedgeCount} />
                <MetricTag tone="sky" label={t("statLines")} value={visibleStats.lineCount} total={stats.lineCount} />
                <MetricTag tone="amber" label={t("statMaxSize")} value={visibleStats.maxSize} />
                <MetricTag tone="emerald" label={t("statAvgDegree")} value={visibleStats.avgDegree.toFixed(1)} />
                <MetricTag tone="slate" label={t("statComponents")} value={visibleStats.components.length} />
            </div>

            <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">
                    {t("typeComposition")}
                    {(onPick || onTypeClick) && (
                        <span className="ml-2 font-normal text-[11px] text-gray-400">
                            {t(onPick ? "histogramHint" : "typeClickHint")}
                        </span>
                    )}
                </div>
                <div className="flex h-3 rounded overflow-hidden">
                    {stats.types.map(({ type, count }) => (
                        <div
                            key={type ?? "__none"}
                            className={onPick || onTypeClick ? "cursor-pointer hover:opacity-70" : ""}
                            style={{ width: `${(count / stats.vertexCount) * 100}%`, background: colorOfType(type) }}
                            title={`${type ?? t("untyped")}: ${count}`}
                            onClick={() =>
                                onTypeClick
                                    ? onTypeClick(type)
                                    : onPick?.({ nodes: typeIds.get(type) || [], hyperedges: [] }, "nodes")
                            }
                        />
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <MiniHistogram
                    title={t("degreeDistribution")}
                    bins={degreeBins}
                    onPick={onPick && ((b) => onPick({ nodes: b.ids, hyperedges: [] }, "nodes"))}
                />
                <MiniHistogram
                    title={t("sizeDistribution")}
                    bins={sizeBins}
                    color="#F6BD16"
                    onPick={onPick && ((b) => onPick({ nodes: [], hyperedges: b.ids }, "hyperedges"))}
                />
            </div>

            {showHubs && hubs.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold mr-auto">{t("hubWarning", { n: hubs.length })}</span>
                        {onHideHubs && (
                            <>
                                <button
                                    className="px-2 py-0.5 rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                                    disabled={hiddenHubs.length === hubs.length}
                                    onClick={() => onHideHubs(hubs)}
                                >
                                    {t("hideAllHubs")}
                                </button>
                                <button
                                    className="px-2 py-0.5 rounded border border-amber-400 hover:bg-amber-100"
                                    onClick={() => onPick({ nodes: hubs.filter((id) => !hidden.nodes.includes(id)), hyperedges: [] }, "nodes")}
                                >
                                    {t("selectOnly")}
                                </button>
                            </>
                        )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3">
                        {hubs.map((id) => (
                            <span key={id} className={hidden.nodes.includes(id) ? "line-through text-amber-600" : ""}>
                                {id} <span className="tabular-nums">{stats.degree.get(id)}/{total}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatsTab;
