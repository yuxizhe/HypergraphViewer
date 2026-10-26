import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PropertyList } from './DetailsPanel.jsx';
import { useI18n } from './i18n.jsx';
import { HYPEREDGE_FIELD_LIMIT, HYPEREDGE_PRIORITY, HYPEREDGE_TIP_EXCLUDED } from './constants.js';

// 悬停目标 → 悬停卡片内容：顶点 → 顶点属性（另列只剩它一个成员的、与枢纽实体的超边）；连线（2 个顶点的超边）/ 超边轮廓 → 超边属性
// eslint-disable-next-line react-refresh/only-export-components
export const tipOf = (hit, hiddenIds = new Set()) => {
    if (hit.kind === "node") {
        const related = hit.fadedHyperedges?.map((he) => ({
            id: he.id,
            with: he.members.filter((m) => hiddenIds.has(m)),
            // 描述：edgeName、description、keywords 依次拼接（缺的跳过）
            text: [he.edgeName, he.description, he.keywords]
                .map((v) => (Array.isArray(v) ? v.join(", ") : v))
                .filter(Boolean)
                .join(" | ")
                .replace(/<SEP>/g, " | "),
        }));
        return { title: "node", item: hit.item, related };
    }
    return {
        title: hit.kind,
        item: hit.item,
        priority: HYPEREDGE_PRIORITY,
        // 没有 type 的超边（如 Hyper-RAG 原版抽取的图）仍显示 keywords
        exclude: hit.item.type ? HYPEREDGE_TIP_EXCLUDED : [],
        limit: HYPEREDGE_FIELD_LIMIT,
    };
};

const TIP_OFFSET = 12;
const TIP_MARGIN = 8;

// 跟随鼠标的悬停卡片，替代 G6 tooltip 插件：插件把视口坐标与画布尺寸比较来翻转，
// 且卡片插在画布容器内，图边缘的卡片会被裁掉。这里挂到 body，默认在指针右下，
// 越出视口的一侧翻到指针另一侧，最后夹紧在视口内。全屏时只显示全屏元素内的内容，挂到全屏元素上
// related：与枢纽（淡出）实体的超边，画布上不画，列在实体属性后面
const HoverTip = ({ title, item, priority, exclude, limit, related, x, y }) => {
    const { t } = useI18n();
    const ref = useRef(null);
    const [pos, setPos] = useState({ left: x + TIP_OFFSET, top: y + TIP_OFFSET });

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const { offsetWidth: w, offsetHeight: h } = el;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let left = x + TIP_OFFSET;
        let top = y + TIP_OFFSET;
        if (left + w > vw - TIP_MARGIN) left = x - TIP_OFFSET - w;
        if (top + h > vh - TIP_MARGIN) top = y - TIP_OFFSET - h;
        left = Math.max(TIP_MARGIN, Math.min(left, vw - w - TIP_MARGIN));
        top = Math.max(TIP_MARGIN, Math.min(top, vh - h - TIP_MARGIN));
        setPos((prev) => (prev.left === left && prev.top === top ? prev : { left, top }));
    }, [item, related, x, y]);

    // 挂到面板之外，套一层 hv-root 才能用上包里限定在 .hv-root 下的样式
    return createPortal(
        <div className="hv-root">
        <div
            ref={ref}
            className="fixed z-[2000] w-80 overflow-hidden pointer-events-none break-words bg-white/95 border border-gray-200 rounded-md shadow-lg p-3"
            style={{ left: pos.left, top: pos.top, maxHeight: `calc(100vh - ${TIP_MARGIN * 2}px)` }}
        >
            <div className="text-sm text-gray-700 space-y-3">
                <div className="text-base font-semibold text-gray-900 pb-1 border-b-2 border-primary-500">
                    {t(title)}
                </div>
                <PropertyList item={item} priority={priority} exclude={exclude} limit={limit} />
                {related?.length > 0 && (
                    <div>
                        <div className="font-semibold text-gray-900 mb-1">{t("fadedRelations")}</div>
                        <div className="space-y-1.5">
                            {related.map((r) => (
                                <div key={r.id} className="border-l-2 border-primary-500 pl-2">
                                    <div className="text-xs font-semibold text-primary-700">{r.with.join("、")}</div>
                                    {r.text && <div className="text-xs text-gray-600 line-clamp-6">{r.text}</div>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
        </div>,
        document.fullscreenElement || document.body
    );
};

export default HoverTip;
