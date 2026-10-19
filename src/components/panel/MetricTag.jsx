import React from 'react';

// 数字标签；tone 为配色（与直方图颜色呼应：实体紫、超边黄）
const TONES = {
    violet: "bg-violet-50 border-violet-200 text-violet-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    sky: "bg-sky-50 border-sky-200 text-sky-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    slate: "bg-slate-50 border-slate-200 text-slate-600",
};

const MetricTag = ({ label, value, total, tone = "slate" }) => (
    <span className={`inline-flex items-baseline gap-1 px-2 py-0.5 rounded-full border text-xs whitespace-nowrap ${TONES[tone]}`}>
        <span className="opacity-75">{label}</span>
        <span className="font-bold tabular-nums">{value}</span>
        {total !== undefined && total !== value && <span className="opacity-60 tabular-nums">/ {total}</span>}
    </span>
);

export default MetricTag;
