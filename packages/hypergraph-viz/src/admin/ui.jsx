import React, { useEffect, useState } from 'react';
import { fmtId, fmtNum, useAdmin } from './context.jsx';

// 管理后台的小组件：按钮、输入框、卡片、弹窗、JSON 编辑框、分页、实体标签、直方图、排行

export function Button({ variant = "default", className = "", ...props }) {
    const styles = {
        default: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50",
        primary: "bg-primary-600 text-white hover:bg-primary-700 border border-primary-600",
        danger: "bg-white border border-red-300 text-red-600 hover:bg-red-50",
        dangerSolid: "bg-red-600 text-white hover:bg-red-700 border border-red-600",
        ghost: "text-gray-600 hover:bg-gray-100 border border-transparent",
    };
    return (
        <button
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
            {...props}
        />
    );
}

export function Input(props) {
    return (
        <input
            {...props}
            className={`px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${props.className || ""}`}
        />
    );
}

export function Select({ children, ...props }) {
    return (
        <select
            {...props}
            className={`px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${props.className || ""}`}
        >
            {children}
        </select>
    );
}

export function Card({ title, actions, children, className = "" }) {
    return (
        <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
            {title && (
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-800">{title}</h3>
                    {actions}
                </div>
            )}
            <div className="p-5">{children}</div>
        </div>
    );
}

export function Modal({ title, onClose, children, footer, wide }) {
    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onMouseDown={onClose}>
            <div
                className={`bg-white rounded-xl shadow-2xl w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[90vh] flex flex-col`}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-800">{title}</h3>
                    <button className="text-gray-400 hover:text-gray-600 text-xl leading-none" onClick={onClose}>×</button>
                </div>
                <div className="p-5 overflow-y-auto">{children}</div>
                {footer && <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">{footer}</div>}
            </div>
        </div>
    );
}

export function ConfirmModal({ message, confirmText, onConfirm, onClose }) {
    const { t } = useAdmin();
    const [busy, setBusy] = useState(false);
    return (
        <Modal
            title={t("confirmTitle")}
            onClose={onClose}
            footer={
                <>
                    <Button onClick={onClose}>{t("cancel")}</Button>
                    <Button
                        variant="dangerSolid"
                        disabled={busy}
                        onClick={async () => {
                            setBusy(true);
                            try {
                                await onConfirm();
                                onClose();
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        {confirmText || t("delete")}
                    </Button>
                </>
            }
        >
            <div className="text-sm text-gray-700">{message}</div>
        </Modal>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export const jsonValid = (s) => {
    try {
        const p = JSON.parse(s || "{}");
        return p !== null && typeof p === "object" && !Array.isArray(p);
    } catch {
        return false;
    }
};

export function JsonEditor({ value, onChange, rows = 12 }) {
    const { t } = useAdmin();
    let error = null;
    try {
        const parsed = JSON.parse(value || "{}");
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) error = t("jsonMustBeObject");
    } catch (e) {
        error = e.message;
    }
    return (
        <div>
            <textarea
                className={`w-full font-mono text-xs p-3 border rounded-lg focus:outline-none focus:ring-2 ${error ? "border-red-300 focus:ring-red-400" : "border-gray-300 focus:ring-primary-500"}`}
                style={{ tabSize: 2 }}
                rows={rows}
                spellCheck={false}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            <div className={`text-xs mt-1 ${error ? "text-red-600" : "text-gray-400"}`}>
                {error ? t("jsonInvalid", { error }) : t("jsonValid")}
            </div>
        </div>
    );
}

export function Pagination({ pagination, onPage }) {
    const { t } = useAdmin();
    if (!pagination) return null;
    const { page, total_pages, total } = pagination;
    return (
        <div className="flex items-center justify-between text-sm text-gray-600 mt-3">
            <span>{t("records", { n: fmtNum(total) })}</span>
            <div className="flex items-center gap-2">
                <Button disabled={page <= 1} onClick={() => onPage(page - 1)}>{t("prev")}</Button>
                <span>{t("pageOf", { page, total: total_pages })}</span>
                <Button disabled={page >= total_pages} onClick={() => onPage(page + 1)}>{t("next")}</Button>
            </div>
        </div>
    );
}

export function VertexChip({ id, onClick }) {
    return (
        <span
            onClick={onClick}
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-primary-50 text-primary-700 border border-primary-100 max-w-[16rem] truncate ${onClick ? "cursor-pointer hover:bg-primary-100" : ""}`}
            title={fmtId(id)}
        >
            {fmtId(id)}
        </span>
    );
}

// [值, 个数] 的柱状图。长尾（常见的幂律度分布）小值各占一柱，之后的区间按几何级数加宽
export function Histogram({ data, label }) {
    const { t } = useAdmin();
    const [log, setLog] = useState(true);
    if (!data || data.length === 0) return <div className="text-sm text-gray-400">{t("noData")}</div>;
    let bars = data.map(([k, c]) => ({ label: String(k), count: c }));
    if (data.length > 24) {
        const hi = data[data.length - 1][0];
        const ranges = [];
        for (let start = data[0][0], width = 1; start <= hi; start += width) {
            ranges.push([start, start + width - 1]);
            if (ranges.length >= 8) width = Math.ceil(width * 1.6);
        }
        bars = ranges
            .map(([a, b]) => ({
                label: a === b ? String(a) : `${a}-${b}`,
                count: data.reduce((s, [k, c]) => (k >= a && k <= b ? s + c : s), 0),
            }))
            .filter((b) => b.count > 0);
    }
    const scale = (n) => (log ? Math.log10(n + 1) : n);
    const max = Math.max(...bars.map((b) => scale(b.count)));
    const labelEvery = Math.ceil(bars.length / 14);
    return (
        <div>
            <label className="flex items-center justify-end gap-1.5 text-xs text-gray-500 mb-2 select-none">
                <input type="checkbox" checked={log} onChange={(e) => setLog(e.target.checked)} className="accent-primary-600" />
                {t("logScale")}
            </label>
            <div className="flex items-end gap-1 h-40">
                {bars.map((b) => (
                    <div key={b.label} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                        <div className="absolute -top-6 hidden group-hover:block text-xs bg-gray-800 text-white px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                            {label} {b.label}: {fmtNum(b.count)}
                        </div>
                        <div
                            className="w-full bg-primary-500/80 hover:bg-primary-600 rounded-t"
                            style={{ height: `${Math.max(2, (scale(b.count) / max) * 100)}%` }}
                        />
                    </div>
                ))}
            </div>
            <div className="flex gap-1 mt-1">
                {bars.map((b, i) => (
                    <div key={b.label} className="flex-1 text-[10px] text-gray-500 text-center whitespace-nowrap overflow-visible">
                        {i % labelEvery === 0 ? b.label : ""}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function RankList({ items, onClick, label = (k) => k }) {
    const { t } = useAdmin();
    if (!items || items.length === 0) return <div className="text-sm text-gray-400">{t("noData")}</div>;
    const max = Math.max(...items.map(([, c]) => c));
    return (
        <div className="space-y-1.5">
            {items.map(([k, c]) => (
                <div key={k} className={`text-sm ${onClick ? "cursor-pointer" : ""}`} onClick={() => onClick && onClick(k)}>
                    <div className="flex justify-between mb-0.5">
                        <span className="text-gray-700 truncate mr-2" title={k}>{label(k)}</span>
                        <span className="text-gray-500 tabular-nums">{fmtNum(c)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded">
                        <div className="h-1.5 bg-primary-500 rounded" style={{ width: `${(c / max) * 100}%` }} />
                    </div>
                </div>
            ))}
        </div>
    );
}
