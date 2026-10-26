import React, { useMemo } from 'react';
import MetricTag from './MetricTag.jsx';
import MiniHistogram, { binsOf } from './MiniHistogram.jsx';
import { useI18n } from '../i18n.jsx';

// 超图统计：数字、类型构成、度数 / 大小分布。
// 传 onPick 时点柱子、色段选中对应元素；onTypeClick 覆盖色段的点击（左侧栏用来按类型筛选）
const StatsTab = ({
    stats,
    visibleStats = stats,
    typeOf,
    colorOfType,
    onPick,
    onTypeClick,
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

        </div>
    );
};

export default StatsTab;
