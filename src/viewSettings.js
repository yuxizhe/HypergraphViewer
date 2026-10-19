import { useEffect, useState } from 'react';

// 右侧面板「渲染」Tab 的默认值；与 hypergraph-viz 的默认行为一致
export const DEFAULT_RENDER_SETTINGS = {
    layout: "hypergraph", // hypergraph | force | force-atlas2 | circular
    useCenter: true,
    nodeSpacing: 50,
    preventLabelOverlap: true,
    graphEdges: "binary", // 图模式下 3 元及以上超边：binary 丢弃 / clique 拆成两两连线
    contours: true,
    contourBounds: "key", // key 只圈节点 / render 包含标签
    hyperedgeColorBy: "hyperedge", // hyperedge | type
    fillOpacity: 0.2,
    nodeColorBy: "type", // type | uniform
    nodeSizeBy: "fixed", // fixed | degree
    labelMode: "all", // all | key（中心与枢纽）| none
    labelFontSize: 12,
};

// 用户改过的颜色：实体类型、单个实体、单条超边、超边类型
export const EMPTY_COLOR_OVERRIDES = { types: {}, nodes: {}, hyperedges: {}, hyperedgeTypes: {} };

// 存在 localStorage 中的状态；读写失败（隐私模式等）时只在本次会话有效
export const useStoredState = (key, initial) => {
    const [value, setValue] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(key));
            return saved && typeof saved === "object" ? { ...initial, ...saved } : initial;
        } catch {
            return initial;
        }
    });
    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // 忽略：只是记不住设置
        }
    }, [key, value]);
    return [value, setValue];
};
