import React, { useCallback, useEffect, useState } from 'react';
import { fmtId, useAdmin } from './context.jsx';
import { Button, Card, Input, JsonEditor, jsonValid, Modal, Pagination, Select, VertexChip } from './ui.jsx';

// 超边列表：搜索、按超边类型筛选、排序、分页；点一行打开详情，点实体标签打开实体
export function EdgesPage({ version, filters, setFilters, openEdge, onCreate, openVertex }) {
    const { api, t, lbl } = useAdmin();
    const [search, setSearch] = useState(filters.search || "");
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [types, setTypes] = useState([]);
    useEffect(() => {
        api.stats().then((s) => setTypes(s.edge_types.map(([type]) => type))).catch(() => {});
    }, [api, version]);
    useEffect(() => {
        const timer = setTimeout(() => search !== (filters.search || "") && setFilters({ ...filters, search, page: 1 }), 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);
    useEffect(() => {
        api.listEdges({ page_size: 25, ...filters })
            .then((r) => {
                setResult(r);
                setError(null);
            })
            .catch((e) => setError(e.message));
    }, [api, filters, version]);

    return (
        <Card title={t("navEdges")} actions={<Button variant="primary" onClick={onCreate}>{t("newEdge")}</Button>}>
            <div className="flex flex-wrap gap-2 mb-4">
                <Input placeholder={t("searchEdges")} value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
                {(types.length > 0 || filters.edge_type) && (
                    <Select value={filters.edge_type || ""} onChange={(e) => setFilters({ ...filters, edge_type: e.target.value, page: 1 })}>
                        <option value="">{t("allEdgeTypes")}</option>
                        {types.map((ty) => <option key={ty} value={ty}>{lbl("edge_type", ty)}</option>)}
                    </Select>
                )}
                <Select
                    value={`${filters.sort_by}:${filters.sort_order}`}
                    onChange={(e) => {
                        const [sort_by, sort_order] = e.target.value.split(":");
                        setFilters({ ...filters, sort_by, sort_order, page: 1 });
                    }}
                >
                    <option value="size:desc">{t("sortSizeDesc")}</option>
                    <option value="size:asc">{t("sortSizeAsc")}</option>
                    <option value="vertices:asc">{t("sortVerticesAsc")}</option>
                </Select>
            </div>
            {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
            <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-left">
                        <tr>
                            <th className="px-3 py-2 font-medium">{t("colVertices")}</th>
                            <th className="px-3 py-2 font-medium w-16">{t("colSize")}</th>
                            <th className="px-3 py-2 font-medium">{t("colAttributes")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {result && result.data.map((e) => (
                            <tr key={JSON.stringify(e.vertices)} className="border-t border-gray-100 hover:bg-primary-50/50 cursor-pointer" onClick={() => openEdge(e.vertices)}>
                                <td className="px-3 py-2 max-w-md">
                                    <div className="flex flex-wrap gap-1">
                                        {e.vertices.slice(0, 8).map((v) => (
                                            <VertexChip
                                                key={fmtId(v)}
                                                id={v}
                                                onClick={(ev) => {
                                                    ev.stopPropagation();
                                                    openVertex(v);
                                                }}
                                            />
                                        ))}
                                        {e.vertices.length > 8 && <span className="text-xs text-gray-400">{t("more", { n: e.vertices.length - 8 })}</span>}
                                    </div>
                                </td>
                                <td className="px-3 py-2 tabular-nums">{e.size}</td>
                                <td className="px-3 py-2 text-gray-500 font-mono text-xs truncate max-w-md">{e.preview}</td>
                            </tr>
                        ))}
                        {result && result.data.length === 0 && (
                            <tr><td colSpan="3" className="px-3 py-8 text-center text-gray-400">{t("noEdges")}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Pagination pagination={result && result.pagination} onPage={(page) => setFilters({ ...filters, page })} />
        </Card>
    );
}

// 新建超边时搜索并选择实体
function VertexPicker({ selected, setSelected }) {
    const { api, t, lbl } = useAdmin();
    const [q, setQ] = useState("");
    const [options, setOptions] = useState([]);
    useEffect(() => {
        const timer = setTimeout(() => {
            api.listVertices({ search: q, page_size: 8 }).then((r) => setOptions(r.data)).catch(() => {});
        }, 200);
        return () => clearTimeout(timer);
    }, [api, q]);
    const key = (v) => JSON.stringify(v);
    const isSel = (v) => selected.some((s) => key(s) === key(v));
    return (
        <div>
            <div className="flex flex-wrap gap-1 min-h-[2rem] p-2 border border-gray-200 rounded-lg mb-2">
                {selected.length === 0 && <span className="text-xs text-gray-400">{t("pickTwo")}</span>}
                {selected.map((v) => (
                    <span key={key(v)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-primary-600 text-white">
                        {fmtId(v)}
                        <button onClick={() => setSelected(selected.filter((s) => key(s) !== key(v)))}>×</button>
                    </span>
                ))}
            </div>
            <Input placeholder={t("searchToAdd")} value={q} onChange={(e) => setQ(e.target.value)} className="w-full mb-1" />
            <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
                {options.map((v) => (
                    <div
                        key={key(v.id)}
                        className={`px-3 py-1.5 text-sm flex justify-between ${isSel(v.id) ? "text-gray-300" : "cursor-pointer hover:bg-primary-50"}`}
                        onClick={() => !isSel(v.id) && setSelected([...selected, v.id])}
                    >
                        <span className="truncate">{fmtId(v.id)}</span>
                        <span className="text-xs text-gray-400">{lbl("entity_type", v.entity_type)} · {t("deg", { n: v.degree })}</span>
                    </div>
                ))}
                {options.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">{t("noMatch")}</div>}
            </div>
        </div>
    );
}

export function NewEdgeModal({ onClose, onDone, notify }) {
    const { api, t } = useAdmin();
    const [selected, setSelected] = useState([]);
    const [data, setData] = useState('{\n  "keywords": "",\n  "summary": ""\n}');
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        setBusy(true);
        try {
            const res = await api.upsertEdge({ create: true, vertices: selected, data: JSON.parse(data || "{}") });
            notify(t("edgeCreated"));
            onDone(res.vertices.map((v) => v.id));
        } catch (e) {
            notify(e.message, "error");
        } finally {
            setBusy(false);
        }
    };
    return (
        <Modal
            title={t("newEdgeTitle")}
            onClose={onClose}
            wide
            footer={
                <>
                    <Button onClick={onClose}>{t("cancel")}</Button>
                    <Button variant="primary" disabled={selected.length < 2 || !jsonValid(data) || busy} onClick={submit}>{t("create")}</Button>
                </>
            }
        >
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("vertices")}</label>
            <VertexPicker selected={selected} setSelected={setSelected} />
            <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">{t("attributes")}</label>
            <JsonEditor value={data} onChange={setData} rows={6} />
        </Modal>
    );
}

export function EdgeDetail({ vertices, onClose, openVertex, onChanged, notify, confirm }) {
    const { api, t } = useAdmin();
    const [detail, setDetail] = useState(null);
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const load = useCallback(() => {
        api.getEdge(vertices)
            .then((d) => {
                setDetail(d);
                setText(JSON.stringify(d.data, null, 2));
            })
            .catch((e) => {
                notify(e.message, "error");
                onClose();
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [api, JSON.stringify(vertices)]);
    useEffect(load, [load]);

    const save = async () => {
        setBusy(true);
        try {
            await api.upsertEdge({ vertices, data: JSON.parse(text || "{}"), replace: true });
            notify(t("edgeSaved"));
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
            message: t("confirmDeleteEdge", { n: vertices.length }),
            onConfirm: async () => {
                try {
                    await api.deleteEdge(vertices);
                    notify(t("edgeDeleted"));
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
            title={t("edgeTitle", { n: vertices.length })}
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
                    <div>
                        <div className="text-sm font-medium text-gray-700 mb-2">{t("vertices")}</div>
                        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                            {detail.vertices.map((v) => (
                                <span key={fmtId(v.id)} className="inline-flex items-center gap-1">
                                    <VertexChip id={v.id} onClick={() => openVertex(v.id)} />
                                    <span className="text-[10px] text-gray-400">{v.degree}</span>
                                </span>
                            ))}
                        </div>
                        <div className="text-xs text-gray-400 mt-2">{t("membershipHint")}</div>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">{t("attributesJson")}</div>
                        <JsonEditor value={text} onChange={setText} />
                    </div>
                </div>
            )}
        </Modal>
    );
}
