import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PropertyList } from './DetailsPanel.jsx';
import { useI18n } from '../i18n.jsx';

const TIP_OFFSET = 12;
const TIP_MARGIN = 8;

// 跟随鼠标的悬停卡片，替代 G6 tooltip 插件：插件把视口坐标与画布尺寸比较来翻转，
// 且卡片插在画布容器内，图边缘的卡片会被裁掉。这里挂到 body，默认在指针右下，
// 越出视口的一侧翻到指针另一侧，最后夹紧在视口内
const HoverTip = ({ title, item, priority, exclude, limit, x, y }) => {
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
    }, [item, x, y]);

    return createPortal(
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
            </div>
        </div>,
        document.body
    );
};

export default HoverTip;
