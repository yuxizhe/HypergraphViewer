import React from 'react';
import { useI18n } from '../../i18n.jsx';

// 类型筛选按钮（多选），横向一行可滚动；chips: [{ type, label, count, color }]
const TypeChips = ({ chips, selected, onToggle, onClear }) => {
    const { t } = useI18n();
    if (!chips.length) return null;
    return (
        <div className="flex gap-1 mb-2 overflow-x-auto hide-scrollbar shrink-0">
            {chips.map((c) => (
                <button
                    key={c.type ?? "__none"}
                    onClick={() => onToggle(c.type)}
                    className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs whitespace-nowrap ${selected.includes(c.type)
                        ? "bg-primary-50 border-primary-500 text-primary-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                >
                    {c.color && <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />}
                    {c.label}
                    <span className="text-gray-400">{c.count}</span>
                </button>
            ))}
            {selected.length > 0 && (
                <button className="shrink-0 text-xs text-primary-600 hover:underline px-1" onClick={onClear}>
                    {t("all")}
                </button>
            )}
        </div>
    );
};

export default TypeChips;
