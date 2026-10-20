import React, { useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from './i18n.jsx';

// 浏览器自身的宽度 → 布局：wide（≥ 1200）三栏，medium（≥ 768）画布占满、左栏抽屉、右栏浮层，compact（手机）画布全屏、面板从底部弹出。
// 按容器而不是屏幕宽度：嵌在带侧边菜单的页面里时也按实际可用宽度；fixed 为宿主指定的布局（'auto' 或不传时按宽度）
// eslint-disable-next-line react-refresh/only-export-components
export const useLayout = (ref, fixed) => {
    const [width, setWidth] = useState(null);
    // 绘制前量好宽度：手机上不先按三栏画一遍
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        observer.observe(el);
        setWidth(el.getBoundingClientRect().width);
        return () => observer.disconnect();
    }, [ref]);
    if (fixed && fixed !== "auto") return fixed;
    if (width === null || width >= 1200) return "wide";
    return width >= 768 ? "medium" : "compact";
};

// 底部弹出的面板：半屏时可以边看图边操作，拖动顶部把手或点它在半屏 / 全屏之间切换，下拉到底关闭
const HEIGHTS = { half: "55%", full: "100%" };

const BottomSheet = ({ title, onClose, children }) => {
    const { t } = useI18n();
    const [size, setSize] = useState("half");
    const [drag, setDrag] = useState(null); // 拖动中：{ startY, dy }
    const sheetRef = useRef(null);

    const onPointerDown = (e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag({ startY: e.clientY, dy: 0 });
    };
    const onPointerMove = (e) => drag && setDrag({ ...drag, dy: e.clientY - drag.startY });
    const onPointerUp = () => {
        if (!drag) return;
        const { dy } = drag;
        setDrag(null);
        const h = sheetRef.current?.getBoundingClientRect().height || 1;
        // 轻点：在半屏 / 全屏间切换；拖动超过 1/4：上拉展开、下拉收起（半屏时下拉关闭）
        if (Math.abs(dy) < 6) setSize((s) => (s === "half" ? "full" : "half"));
        else if (dy < -h / 4) setSize("full");
        else if (dy > h / 4) size === "full" ? setSize("half") : onClose();
    };

    return (
        <div
            ref={sheetRef}
            className="absolute inset-x-0 bottom-0 z-30 flex flex-col bg-white rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.15)]"
            style={{
                height: HEIGHTS[size],
                transform: drag && drag.dy > 0 ? `translateY(${drag.dy}px)` : undefined,
                transition: drag ? "none" : "height 200ms, transform 200ms",
            }}
        >
            <div
                className="shrink-0 touch-none select-none cursor-grab"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => setDrag(null)}
            >
                <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-gray-300" />
                <div className="flex items-center px-4 py-2">
                    <span className="text-base font-bold text-gray-800">{title}</span>
                    <button
                        className="ml-auto w-8 h-8 -mr-2 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 text-xl leading-none"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={onClose}
                        aria-label={t("close")}
                    >
                        ×
                    </button>
                </div>
            </div>
            <div className="flex-1 min-h-0 flex flex-col border-t border-gray-100">{children}</div>
        </div>
    );
};

export default BottomSheet;
