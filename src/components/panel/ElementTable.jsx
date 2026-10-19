import React, { useEffect, useMemo, useRef, useState } from 'react';
import ColorSwatch from './ColorSwatch.jsx';
import { useI18n } from '../../i18n.jsx';

const EyeIcon = ({ off }) => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
        {off && <path d="M3 3l18 18" />}
    </svg>
);

const GRID = "grid grid-cols-[20px_64px_minmax(0,1fr)_20px_24px] items-center gap-1.5";

// 实体 / 超边共用的表格：类型筛选（兼作图例与类型取色）、搜索、排序、勾选、显隐、颜色。
// rows: [{ id, name, value, type, color, colorOverridden, hidden, dropped, note, badges, hideDisabled, search }]；color 为 undefined 时不显示色块
const ElementTable = ({
    rows,
    valueLabel,
    typeChips,
    onTypeColor,
    onTypeColorReset,
    selectedIds,
    onToggleSelect,
    onSelectMany,
    onToggleHidden,
    onColor,
    onColorReset,
    onRowHover,
    onRowClick,
    focusId,
}) => {
    const { t } = useI18n();
    const [types, setTypes] = useState(() => new Set());
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState({ key: "value", dir: -1 });
    const listRef = useRef(null);

    // 数据换了以后，已不存在的类型筛选作废
    useEffect(() => {
        setTypes((prev) => {
            const valid = new Set(typeChips.map((c) => c.type));
            const next = new Set([...prev].filter((x) => valid.has(x)));
            return next.size === prev.size ? prev : next;
        });
    }, [typeChips]);

    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = rows.filter(
            (r) => (!types.size || types.has(r.type)) && (!q || (r.search ?? r.name).toLowerCase().includes(q))
        );
        const cmp = {
            value: (a, b) => a.value - b.value || String(a.name).localeCompare(String(b.name)),
            name: (a, b) => String(a.name).localeCompare(String(b.name)),
            type: (a, b) => String(a.type ?? "").localeCompare(String(b.type ?? "")) || b.value - a.value,
        }[sort.key];
        return list.sort((a, b) => cmp(a, b) * sort.dir);
    }, [rows, types, search, sort]);

    const maxValue = Math.max(1, ...rows.map((r) => r.value));
    const allChecked = shown.length > 0 && shown.every((r) => selectedIds.has(r.id));

    // 画布上点选的元素滚动到可见处
    useEffect(() => {
        if (focusId === undefined || focusId === null) return;
        const el = listRef.current?.querySelector(`[data-row-id="${CSS.escape(String(focusId))}"]`);
        el?.scrollIntoView({ block: "nearest" });
    }, [focusId]);

    const header = (key, label) => (
        <button
            className={`text-left truncate hover:text-gray-900 ${sort.key === key ? "text-gray-900" : ""}`}
            onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : key === "value" ? -1 : 1 }))}
        >
            {label}
            {sort.key === key && (sort.dir < 0 ? " ▾" : " ▴")}
        </button>
    );

    const toggleType = (type) =>
        setTypes((prev) => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return next;
        });

    return (
        <div className="flex flex-col min-h-0 h-full">
            {typeChips.length > 0 && (
                <div className="flex gap-1 mb-2 overflow-x-auto hide-scrollbar shrink-0">
                    {typeChips.map((c) => (
                        <span
                            key={c.type ?? "__none"}
                            className={`shrink-0 inline-flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-full border text-xs whitespace-nowrap cursor-pointer select-none ${types.has(c.type)
                                ? "bg-primary-50 border-primary-500 text-primary-700"
                                : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                }`}
                            onClick={() => toggleType(c.type)}
                        >
                            {c.color &&
                                (onTypeColor && c.type !== null ? (
                                    <ColorSwatch
                                        color={c.color}
                                        size="w-3 h-3"
                                        overridden={c.overridden}
                                        onChange={(color) => onTypeColor(c.type, color)}
                                        onReset={() => onTypeColorReset(c.type)}
                                        title={t("typeColor")}
                                    />
                                ) : (
                                    <span className="w-3 h-3 rounded-sm" style={{ background: c.color }} />
                                ))}
                            {c.label}
                            <span className="text-gray-400">{c.count}</span>
                        </span>
                    ))}
                    {types.size > 0 && (
                        <button className="text-xs text-primary-600 hover:underline px-1" onClick={() => setTypes(new Set())}>
                            {t("all")}
                        </button>
                    )}
                </div>
            )}
            <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("filterPlaceholder")}
                className="w-full mb-2 shrink-0 px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
            <div className={`${GRID} shrink-0 px-1 pb-1 text-xs font-semibold text-gray-500 border-b border-gray-200`}>
                <input
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 w-3.5 h-3.5"
                    checked={allChecked}
                    onChange={() => onSelectMany(shown.map((r) => r.id), !allChecked)}
                    title={t("selectAllShown")}
                />
                {header("value", valueLabel)}
                {header("name", t("nameCol"))}
                <span />
                <span />
            </div>
            <div ref={listRef} className="flex-1 overflow-y-auto min-h-0" onMouseLeave={() => onRowHover(null)}>
                {shown.length === 0 && <div className="p-3 text-center text-xs text-gray-400">{t("noRows")}</div>}
                {shown.map((r) => {
                    const selected = selectedIds.has(r.id);
                    const muted = r.hidden || r.dropped;
                    return (
                        <div
                            key={r.id}
                            data-row-id={r.id}
                            className={`${GRID} px-1 py-1 text-xs border-b border-gray-50 ${selected ? "bg-primary-50" : "hover:bg-gray-50"
                                } ${focusId === r.id ? "ring-1 ring-inset ring-primary-500" : ""}`}
                            onMouseEnter={() => !muted && onRowHover(r.id)}
                        >
                            <input
                                type="checkbox"
                                className="rounded border-gray-300 text-primary-600 w-3.5 h-3.5"
                                checked={selected}
                                disabled={r.hidden}
                                onChange={() => onToggleSelect(r.id)}
                            />
                            <span className="flex items-center gap-1 text-gray-600">
                                <span className="h-2 bg-gray-400 rounded-sm" style={{ width: `${(r.value / maxValue) * 36}px` }} />
                                <span className="tabular-nums">{r.value}</span>
                            </span>
                            <button
                                className={`text-left min-w-0 flex items-center gap-1 ${muted ? "text-gray-400" : "text-gray-800"}`}
                                onClick={() => onRowClick(r.id)}
                                title={r.title ?? r.name}
                            >
                                {r.prefix}
                                <span className={`truncate ${r.hidden ? "line-through" : ""}`}>{r.name}</span>
                                {r.badges?.map((b) => (
                                    <span key={b.text} className={`shrink-0 px-1 rounded text-[10px] ${b.cls}`}>
                                        {b.text}
                                    </span>
                                ))}
                                {r.note && <span className="shrink-0 text-[10px] text-gray-400 italic">{r.note}</span>}
                            </button>
                            {r.color === undefined ? <span /> : <ColorSwatch
                                color={r.color}
                                overridden={r.colorOverridden}
                                onChange={(color) => onColor(r.id, color)}
                                onReset={() => onColorReset(r.id)}
                                title={t("elementColor")}
                            />}
                            <button
                                className={`flex justify-center ${r.hideDisabled ? "text-gray-200 cursor-not-allowed" : r.hidden ? "text-gray-400 hover:text-gray-700" : "text-gray-600 hover:text-primary-600"}`}
                                disabled={r.hideDisabled}
                                onClick={() => onToggleHidden(r.id)}
                                title={r.hideDisabled ? t("centerCannotHide") : t(r.hidden ? "show" : "hide")}
                            >
                                <EyeIcon off={r.hidden} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ElementTable;
