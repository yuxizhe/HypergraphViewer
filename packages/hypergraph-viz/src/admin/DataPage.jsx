import React, { useRef } from 'react';
import { fmtNum, useAdmin } from './context.jsx';
import { Button, Card } from './ui.jsx';

// 导入 / 导出：存储状态与保存（数据接口提供 save 时），HIF 导出、导入（提供 exportHIF / importHIF 时）
export default function DataPage({ info, onChanged, notify, confirm, save }) {
    const { api, t } = useAdmin();
    const fileRef = useRef(null);
    const importFile = (file) => {
        const reader = new FileReader();
        reader.onload = () => {
            let parsed;
            try {
                parsed = JSON.parse(reader.result);
            } catch (e) {
                notify(t("invalidJsonFile", { error: e.message }), "error");
                return;
            }
            confirm({
                message: t("confirmImport", { file: file.name, v: fmtNum(info.num_v), e: fmtNum(info.num_e) }),
                confirmText: t("replaceData"),
                onConfirm: async () => {
                    try {
                        const res = await api.importHIF(parsed);
                        notify(t("imported", { v: fmtNum(res.num_v), e: fmtNum(res.num_e) }));
                        onChanged();
                    } catch (e) {
                        notify(e.message, "error");
                    }
                },
            });
        };
        reader.readAsText(file);
    };
    const exportFile = async () => {
        try {
            const hif = await api.exportHIF();
            const url = URL.createObjectURL(new Blob([JSON.stringify(hif)], { type: "application/json" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = "hypergraph.hif.json";
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            notify(e.message, "error");
        }
    };
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {api.save && (
                <Card title={t("storage")}>
                    <dl className="text-sm space-y-2">
                        {info.storage_file && (
                            <div className="flex gap-2"><dt className="text-gray-500 w-28 shrink-0">{t("file")}</dt><dd className="font-mono text-xs break-all">{info.storage_file}</dd></div>
                        )}
                        <div className="flex gap-2"><dt className="text-gray-500 w-28 shrink-0">{t("onDisk")}</dt><dd>{info.file_exists ? t("bytes", { n: fmtNum(info.file_size) }) : t("notSavedYet")}</dd></div>
                        <div className="flex gap-2"><dt className="text-gray-500 w-28 shrink-0">{t("lastSaved")}</dt><dd>{info.last_saved ? new Date(info.last_saved * 1000).toLocaleString() : t("notThisSession")}</dd></div>
                        <div className="flex gap-2"><dt className="text-gray-500 w-28 shrink-0">{t("status")}</dt><dd>{info.dirty ? <span className="text-amber-600">{t("unsaved")}</span> : <span className="text-green-600">{t("inSync")}</span>}</dd></div>
                    </dl>
                    <Button variant="primary" className="mt-4" onClick={save} disabled={!info.dirty}>{t("saveToDisk")}</Button>
                </Card>
            )}
            {(api.exportHIF || api.importHIF) && (
                <Card title={t("hifTitle")}>
                    <p className="text-sm text-gray-600 mb-4">
                        <a className="text-primary-600 hover:underline" href="https://github.com/pszufe/HIF-standard" target="_blank" rel="noreferrer">HIF</a> {t("hifDesc")}
                    </p>
                    <div className="flex gap-2">
                        {api.exportHIF && <Button onClick={exportFile}>{t("exportHif")}</Button>}
                        {api.importHIF && (
                            <>
                                <Button variant="danger" onClick={() => fileRef.current.click()}>{t("importHif")}</Button>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept=".json,application/json"
                                    className="hidden"
                                    onChange={(e) => {
                                        e.target.files[0] && importFile(e.target.files[0]);
                                        e.target.value = "";
                                    }}
                                />
                            </>
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
}
