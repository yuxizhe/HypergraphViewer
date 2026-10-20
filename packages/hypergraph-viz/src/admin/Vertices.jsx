import React, { useCallback, useEffect, useState } from 'react';
import { HypergraphView } from '../react';
import { fmtId, useAdmin } from './context.jsx';
import { Button, Card, Input, JsonEditor, jsonValid, Modal, Pagination, Select, VertexChip } from './ui.jsx';

// 实体列表：搜索、按实体类型筛选、排序、分页；点一行打开详情
export function VerticesPage({ version, filters, setFilters, openVertex, onCreate }) {
    const { api, t, lbl } = useAdmin();
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState(filters.search || "");
    const [types, setTypes] = useState([]);

    useEffect(() => {
        api.stats().then((s) => setTypes(s.entity_types.map(([type]) => type))).catch(() => {});
    }, [api, version]);
    useEffect(() => {
        const timer = setTimeout(() => search !== (filters.search || "") && setFilters({ ...filters, search, page: 1 }), 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);
    useEffect(() => {
        api.listVertices({ page_size: 25, ...filters })
            .then((r) => {
                setResult(r);
                setError(null);
            })
            .catch((e) => setError(e.message));
    }, [api, filters, version]);

    return (
        <Card title={t("navVertices")} actions={<Button variant="primary" onClick={onCreate}>{t("newVertex")}</Button>}>
            <div className="flex flex-wrap gap-2 mb-4">
                <Input placeholder={t("searchVertices")} value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
                <Select value={filters.entity_type || ""} onChange={(e) => setFilters({ ...filters, entity_type: e.target.value, page: 1 })}>
                    <option value="">{t("allEntityTypes")}</option>
                    {types.map((type) => <option key={type} value={type}>{lbl("entity_type", type)}</option>)}
                </Select>
                <Select
                    value={`${filters.sort_by || "degree"}:${filters.sort_order || "desc"}`}
                    onChange={(e) => {
                        const [sort_by, sort_order] = e.target.value.split(":");
                        setFilters({ ...filters, sort_by, sort_order, page: 1 });
                    }}
                >
                    <option value="degree:desc">{t("sortDegreeDesc")}</option>
                    <option value="degree:asc">{t("sortDegreeAsc")}</option>
                    <option value="id:asc">{t("sortIdAsc")}</option>
                    <option value="id:desc">{t("sortIdDesc")}</option>
                </Select>
            </div>
            {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
            <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-left">
                        <tr>
                            <th className="px-3 py-2 font-medium">{t("colId")}</th>
                            <th className="px-3 py-2 font-medium w-20">{t("colDegree")}</th>
                            <th className="px-3 py-2 font-medium w-40">{t("colEntityType")}</th>
                            <th className="px-3 py-2 font-medium">{t("colAttributes")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {result && result.data.map((v) => (
                            <tr key={fmtId(v.id)} className="border-t border-gray-100 hover:bg-primary-50/50 cursor-pointer" onClick={() => openVertex(v.id)}>
                                <td className="px-3 py-2 font-medium text-gray-800 max-w-xs truncate">{fmtId(v.id)}</td>
                                <td className="px-3 py-2 tabular-nums">{v.degree}</td>
                                <td className="px-3 py-2 text-gray-600 truncate max-w-[10rem]" title={v.entity_type}>{lbl("entity_type", v.entity_type)}</td>
                                <td className="px-3 py-2 text-gray-500 font-mono text-xs truncate max-w-md">{v.preview}</td>
                            </tr>
                        ))}
                        {result && result.data.length === 0 && (
                            <tr><td colSpan="4" className="px-3 py-8 text-center text-gray-400">{t("noVertices")}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Pagination pagination={result && result.pagination} onPage={(page) => setFilters({ ...filters, page })} />
        </Card>
    );
}

export function NewVertexModal({ onClose, onDone, notify }) {
    const { api, t } = useAdmin();
    const [id, setId] = useState("");
    const [idType, setIdType] = useState("string");
    const [data, setData] = useState('{\n  "entity_type": "",\n  "description": ""\n}');
    const [busy, setBusy] = useState(false);
    const idValue = idType === "number" ? Number(id) : id;
    const idOk = id.trim() !== "" && (idType === "string" || !Number.isNaN(idValue));
    const submit = async () => {
        setBusy(true);
        try {
            const res = await api.upsertVertex({ create: true, id: idValue, data: JSON.parse(data || "{}") });
            notify(t("vertexCreated", { id: fmtId(res.id) }));
            onDone(res.id);
        } catch (e) {
            notify(e.message, "error");
        } finally {
            setBusy(false);
        }
    };
    return (
        <Modal
            title={t("newVertexTitle")}
            onClose={onClose}
            footer={
                <>
                    <Button onClick={onClose}>{t("cancel")}</Button>
                    <Button variant="primary" disabled={!idOk || !jsonValid(data) || busy} onClick={submit}>{t("create")}</Button>
                </>
            }
        >
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("idLabel")}</label>
            <div className="flex gap-2 mb-4">
                <Input autoFocus value={id} onChange={(e) => setId(e.target.value)} className="flex-1" placeholder={t("idPlaceholder")} />
                <Select value={idType} onChange={(e) => setIdType(e.target.value)}>
                    <option value="string">string</option>
                    <option value="number">number</option>
                </Select>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("attributes")}</label>
            <JsonEditor value={data} onChange={setData} rows={8} />
        </Modal>
    );
}

// 实体详情中的关系图：以该实体为中心的子图（数据接口提供 subgraph 时才有）
function RelationGraph({ id, version }) {
    const { api, lang, t } = useAdmin();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        let cancelled = false;
        api.subgraph(id)
            .then((d) => !cancelled && setData(d))
            .catch((e) => !cancelled && setError(e.message));
        return () => {
            cancelled = true;
        };
    }, [api, id, version]);
    return (
        <div>
            <div className="text-sm font-medium text-gray-700 mb-2">{t("relationGraph")}</div>
            <div className="h-72 border border-gray-200 rounded-lg overflow-hidden">
                {error ? (
                    <div className="p-3 text-sm text-red-600">{error}</div>
                ) : data ? (
                    <HypergraphView data={data} centerNode={fmtId(id)} preset="explorer" toolbar={{ size: "small", locale: lang }} />
                ) : (
                    <div className="p-3 text-sm text-gray-500">{t("loading")}</div>
                )}
            </div>
        </div>
    );
}

export function VertexDetail({ id, onClose, openVertex, openEdge, onChanged, notify, confirm, version }) {
    const { api, t, viewerUrl } = useAdmin();
    const [detail, setDetail] = useState(null);
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const load = useCallback(() => {
        api.getVertex(id)
            .then((d) => {
                setDetail(d);
                setText(JSON.stringify(d.data, null, 2));
            })
            .catch((e) => {
                notify(e.message, "error");
                onClose();
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [api, id]);
    useEffect(load, [load]);

    const save = async () => {
        setBusy(true);
        try {
            await api.upsertVertex({ id, data: JSON.parse(text || "{}"), replace: true });
            notify(t("vertexSaved"));
            onChanged();
            load();
        } catch (e) {
            notify(e.message, "error");
        } finally {
            setBusy(false);
        }
    };
    const remove = () =>
        confirm({
            message: t("confirmDeleteVertex", { id: fmtId(id), degree: detail.degree }),
            onConfirm: async () => {
                try {
                    await api.deleteVertex(id);
                    notify(t("vertexDeleted"));
                    onChanged();
                    onClose();
                } catch (e) {
                    notify(e.message, "error");
                }
            },
        });

    const dirty = detail && text !== JSON.stringify(detail.data, null, 2);
    return (
        <Modal
            title={t("vertexTitle", { id: fmtId(id) })}
            onClose={onClose}
            wide
            footer={
                <>
                    <Button variant="danger" className="mr-auto" disabled={!detail} onClick={remove}>{t("delete")}</Button>
                    <Button onClick={onClose}>{t("close")}</Button>
                    <Button variant="primary" disabled={!dirty || !jsonValid(text) || busy} onClick={save}>{t("saveChanges")}</Button>
                </>
            }
        >
            {!detail ? (
                <div className="text-gray-500">{t("loading")}</div>
            ) : (
                <div className="space-y-5">
                    <div className="flex gap-6 text-sm">
                        <div><span className="text-gray-500">{t("degree")}</span> <b className="tabular-nums">{detail.degree}</b></div>
                        <div><span className="text-gray-500">{t("neighbors")}</span> <b className="tabular-nums">{detail.neighbors}</b></div>
                        {viewerUrl && (
                            <a className="text-primary-600 hover:underline ml-auto" href={`${viewerUrl}?vertex=${encodeURIComponent(fmtId(id))}`} target="_blank" rel="noreferrer">
                                {t("openViewer")}
                            </a>
                        )}
                    </div>
                    {api.subgraph && detail.degree > 0 && <RelationGraph id={id} version={version} />}
                    <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">{t("attributesJson")}</div>
                        <JsonEditor value={text} onChange={setText} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-700 mb-2">
                            {t("incidentEdges", { n: detail.degree })}{detail.edges_truncated && t("first200")}
                        </div>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                            {detail.edges.map((e) => (
                                <div key={JSON.stringify(e.vertices)} className="flex items-center gap-2 p-2 border border-gray-100 rounded-lg hover:bg-gray-50">
                                    <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                                        {e.vertices.map((v) => (
                                            <VertexChip key={fmtId(v)} id={v} onClick={JSON.stringify(v) === JSON.stringify(id) ? null : () => openVertex(v)} />
                                        ))}
                                    </div>
                                    <Button variant="ghost" onClick={() => openEdge(e.vertices)}>{t("open")}</Button>
                                </div>
                            ))}
                            {detail.edges.length === 0 && <div className="text-sm text-gray-400">{t("isolated")}</div>}
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
}
