import React from 'react';

// 色块 + 原生取色器；overridden 时显示「恢复」小按钮
const ColorSwatch = ({ color, onChange, onReset, overridden, title, size = "w-4 h-4" }) => (
    <span className="relative inline-flex items-center shrink-0" title={title}>
        <label
            className={`${size} rounded-sm border border-black/10 cursor-pointer block`}
            style={{ background: color }}
            onClick={(e) => e.stopPropagation()}
        >
            <input
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(color) ? color : "#000000"}
                onChange={(e) => onChange(e.target.value)}
                className="sr-only"
            />
        </label>
        {overridden && onReset && (
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onReset();
                }}
                className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-gray-500 text-white text-[8px] leading-3 text-center hover:bg-gray-700"
                aria-label="reset color"
            >
                ×
            </button>
        )}
    </span>
);

export default ColorSwatch;
