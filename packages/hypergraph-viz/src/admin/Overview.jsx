import React, { useEffect, useState } from 'react';
import { fmtNum, useAdmin } from './context.jsx';
import { Card, Histogram, RankList } from './ui.jsx';

// 概览：计数卡片、度与超边大小分布、超边 / 实体类型（点击跳到筛选后的列表）、属性字段
export default function Overview({ version, gotoVertices, gotoEdges }) {
    const { api, t, lbl } = useAdmin();
    const [stats, setStats] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        api.stats().then(setStats).catch((e) => setError(e.message));
    }, [api, version]);
    if (error) return <div className="text-red-600">{error}</div>;
    if (!stats) return <div className="text-gray-500">{t("loading")}</div>;
    const cards = [
        [t("statVertices"), stats.num_v],
        [t("statEdges"), stats.num_e],
        [t("statAvgDegree"), stats.avg_degree],
        [t("statMaxDegree"), stats.max_degree],
        [t("statAvgSize"), stats.avg_edge_size],
        [t("statMaxSize"), stats.max_edge_size],
        [t("statIsolated"), stats.isolated_v],
    ];
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
                {cards.map(([label, value]) => (
                    <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <div className="text-xs text-gray-500">{label}</div>
                        <div className="text-2xl font-bold text-gray-800 mt-1 tabular-nums">{fmtNum(value)}</div>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title={t("degreeDist")}>
                    <Histogram data={stats.degree_hist} label={t("histDegree")} />
                </Card>
                <Card title={t("sizeDist")}>
                    <Histogram data={stats.edge_size_hist} label={t("histSize")} />
                </Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card title={t("edgeTypes")}>
                    <RankList items={stats.edge_types} label={(k) => lbl("edge_type", k)} onClick={(type) => gotoEdges({ edge_type: type })} />
                </Card>
                <Card title={t("entityTypes")}>
                    <RankList items={stats.entity_types} label={(k) => lbl("entity_type", k)} onClick={(type) => gotoVertices({ entity_type: type })} />
                </Card>
                <Card title={t("attributeKeys")}>
                    <div className="text-xs font-semibold text-gray-500 mb-2 uppercase">{t("vertices")}</div>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                        {stats.vertex_keys.map(([k, c]) => (
                            <span key={k} title={k} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                                {lbl("key", k)} <span className="text-gray-400">{fmtNum(c)}</span>
                            </span>
                        ))}
                        {stats.vertex_keys.length === 0 && <span className="text-sm text-gray-400">{t("none")}</span>}
                    </div>
                    <div className="text-xs font-semibold text-gray-500 mb-2 uppercase">{t("hyperedges")}</div>
                    <div className="flex flex-wrap gap-1.5">
                        {stats.edge_keys.map(([k, c]) => (
                            <span key={k} title={k} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                                {lbl("key", k)} <span className="text-gray-400">{fmtNum(c)}</span>
                            </span>
                        ))}
                        {stats.edge_keys.length === 0 && <span className="text-sm text-gray-400">{t("none")}</span>}
                    </div>
                </Card>
            </div>
        </div>
    );
}
