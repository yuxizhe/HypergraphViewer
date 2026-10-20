import React from 'react';

const W = 168;
const H = 36;
const GAP = 1;

// 小直方图（纯 SVG）：bins 为 [{ label, count, ids }]，点柱子回调 onPick(bin)
const MiniHistogram = ({ title, bins, color = "#8b5cf6", onPick, xLabel }) => {
    const max = Math.max(1, ...bins.map((b) => b.count));
    const bw = bins.length ? W / bins.length : W;
    return (
        <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-600 mb-1">{title}</div>
            <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full">
                {bins.map((b, i) => {
                    const h = b.count ? Math.max(2, (b.count / max) * H) : 0;
                    return (
                        <g key={b.label} className={b.count ? "cursor-pointer" : ""} onClick={() => b.count && onPick?.(b)}>
                            <title>{`${b.label}: ${b.count}`}</title>
                            {/* 透明的整列命中区，矮柱也好点 */}
                            <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
                            <rect
                                x={i * bw + GAP / 2}
                                y={H - h}
                                width={Math.max(1, bw - GAP)}
                                height={h}
                                fill={color}
                                className="hover:opacity-70"
                            />
                        </g>
                    );
                })}
                <line x1={0} y1={H + 0.5} x2={W} y2={H + 0.5} stroke="#d1d5db" />
                {bins.length > 0 && (
                    <>
                        <text x={0} y={H + 12} fontSize={9} fill="#6b7280">{bins[0].label}</text>
                        <text x={W} y={H + 12} fontSize={9} fill="#6b7280" textAnchor="end">
                            {bins[bins.length - 1].label}
                        </text>
                    </>
                )}
                {xLabel && (
                    <text x={W / 2} y={H + 12} fontSize={9} fill="#9ca3af" textAnchor="middle">{xLabel}</text>
                )}
            </svg>
        </div>
    );
};

// 把 值 → ids 分组成最多 maxBins 个区间（值为整数，从 min 到 max）
// eslint-disable-next-line react-refresh/only-export-components
export const binsOf = (entries, maxBins = 20) => {
    if (!entries.length) return [];
    const values = entries.map(([, v]) => v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const step = Math.max(1, Math.ceil((max - min + 1) / maxBins));
    const bins = [];
    for (let lo = min; lo <= max; lo += step) {
        const hi = Math.min(max, lo + step - 1);
        bins.push({ label: lo === hi ? String(lo) : `${lo}–${hi}`, lo, hi, count: 0, ids: [] });
    }
    entries.forEach(([id, v]) => {
        const bin = bins[Math.floor((v - min) / step)];
        bin.count++;
        bin.ids.push(id);
    });
    return bins;
};

export default MiniHistogram;
