import React from 'react';

// 展开 / 收起箭头：收起时向下，展开时向上；dir 为 'right' / 'left' 时用于整栏收起、展开
export const Chevron = ({ open, dir }) => (
    <svg
        className={`w-5 h-5 shrink-0 text-gray-400 transition-transform ${dir === "right" ? "-rotate-90" : dir === "left" ? "rotate-90" : open ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
    >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
);

// 可展开收起的卡片；展开 / 收起箭头在标题行右侧。grow 时展开后占满剩余高度（表格在卡片内滚动），
// 高度不小于 minH（默认 240px：标题、类型标签、筛选框、表头约 135px，加 4 行 100px），空间不够时整栏滚动
// subtitle：标题后的灰字（如当前数据源）
const Section = ({ title, count, subtitle, open, onToggle, grow, minH = "min-h-60", sectionRef, children }) => (
    <div
        ref={sectionRef}
        className={`flex flex-col border-b border-gray-200 ${open && grow ? `flex-1 ${minH}` : "shrink-0"}`}
    >
        <button
            onClick={onToggle}
            aria-expanded={open}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50 shrink-0"
        >
            <span className="shrink-0">{title}</span>
            {count !== undefined && <span className="text-xs font-normal text-gray-400">{count}</span>}
            <span className="ml-auto min-w-0 truncate text-xs font-normal text-gray-400">{subtitle}</span>
            <Chevron open={open} />
        </button>
        {open && <div className={`px-3 pb-3 ${grow ? "flex-1 min-h-0 flex flex-col" : ""}`}>{children}</div>}
    </div>
);

export default Section;
