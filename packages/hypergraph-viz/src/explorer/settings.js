import { useEffect, useState } from 'react';

// 右侧面板「渲染」Tab 的默认值；与 hypergraph-viz 的默认行为一致
export const DEFAULT_RENDER_SETTINGS = {
    layout: "hypergraph", // hypergraph | polygon（多边形画法 HGPolyVis）| force | force-atlas2 | circular
    useCenter: true,
    nodeSpacing: 50,
    maxFitZoom: 1, // 撑满画布时的最大放大倍数：节点少时不放大
    graphEdges: "star", // 图模式下 3 元及以上超边：star 超边节点（二部图）/ binary 丢弃 / clique 拆成两两连线
    matrixOrder: "degree", // 关联矩阵的行列排序：degree | type | cluster
    contours: true,
    contourBounds: "key", // key 只圈节点 / render 包含标签
    contourNesting: false, // 嵌套轮廓（仿 DHG）：小超边在内、大超边在外，节点每被包一层外扩一段
    hyperedgeColorBy: "hyperedge", // hyperedge | type
    fillOpacity: 0.2,
    nodeColorBy: "type", // type | uniform
    nodeSizeBy: "degree", // fixed | degree（子图内度数越大节点越大）
    // 打开子图时自动隐藏（淡出）的实体，含中心：overlap 按注定重叠贪心挑隐含枢纽 / degree 度数超过 autoHideDegree 的 / off 不隐藏
    autoHideBy: "overlap",
    autoHideDegree: 30, // autoHideBy 为 degree 时的阈值，0 不隐藏
    labelMode: "all", // all | key（中心与枢纽）| none
    labelFontSize: 10,
    labelBy: "degree", // uniform | degree（子图内度数越大标签字号越大、颜色越深）
    // 标签重叠：hide 布局不为标签让位，重叠的标签不显示（悬停、选中时显示）/ layout 布局时让标签互不重叠（长标签会把超边拉长）/ allow 允许重叠
    labelOverlap: "hide",
    labelMaxLength: 0, // 标签最大字符数，超出截断；0 不限
    labelStripType: true, // 去掉最后一个冒号及之前的部分（「期间:NVDA:FY2026Q4」→「FY2026Q4」）
};

// 用户改过的颜色：实体类型、单个实体、单条超边、超边类型
export const EMPTY_COLOR_OVERRIDES = { types: {}, nodes: {}, hyperedges: {}, hyperedgeTypes: {} };

// 存在 localStorage 中的状态；key 为 false 时不存，读写失败（隐私模式等）时只在本次会话有效
export const useStoredState = (key, initial) => {
    const [value, setValue] = useState(() => {
        if (!key) return initial;
        try {
            const saved = JSON.parse(localStorage.getItem(key));
            return saved && typeof saved === "object" ? { ...initial, ...saved } : initial;
        } catch {
            return initial;
        }
    });
    useEffect(() => {
        if (!key) return;
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // 忽略：只是记不住设置
        }
    }, [key, value]);
    return [value, setValue];
};
