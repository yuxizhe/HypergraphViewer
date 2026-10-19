import React, { useEffect, useRef, useState } from 'react';
import { HypergraphView } from 'hypergraph-viz/react';
import HoverTip from './HoverTip.jsx';
import { HYPEREDGE_FIELD_LIMIT, HYPEREDGE_PRIORITY, HYPEREDGE_TIP_EXCLUDED } from '../constants.js';

// 悬停目标 → 悬停卡片内容：顶点 → 顶点属性；连线（2 个顶点的超边）/ 超边轮廓 → 超边属性
const tipOf = (hit) => {
    if (hit.kind === "node") return { title: "node", item: hit.item };
    return {
        title: hit.kind,
        item: hit.item,
        priority: HYPEREDGE_PRIORITY,
        // 没有 type 的超边（如 Hyper-RAG 原版抽取的图）仍显示 keywords
        exclude: hit.item.type ? HYPEREDGE_TIP_EXCLUDED : [],
        limit: HYPEREDGE_FIELD_LIMIT,
    };
};

const GraphContainer = ({
    hypergraph,
    visualizationMode,
    selectedVertex,
    entityTypeColors,
    setHoverHyperedge,
    setHoverNode
}) => {
    const [tip, setTip] = useState(null);
    // 选中期间侧边栏固定显示该超边，不随悬停变化
    const selectedRef = useRef(null);

    // 换数据或模式时清空悬停与选中（视图会重新布局并取消选中）
    useEffect(() => {
        setHoverHyperedge(null);
        setTip(null);
        selectedRef.current = null;
    }, [hypergraph, visualizationMode, setHoverHyperedge]);

    const onSelect = (hit) => {
        selectedRef.current = hit;
        if (hit) setHoverHyperedge(hit.item);
    };

    const onHover = (hit) => {
        if (hit?.kind === "hyperedge" && !selectedRef.current) {
            setHoverHyperedge((prev) => (prev?.id === hit.item.id ? prev : hit.item));
        }
        if (hit?.kind === "node") {
            setHoverNode((prev) => (prev?.id === hit.item.id ? prev : hit.item));
        }
        // 侧边栏保留最后悬停的超边 / 顶点；悬停卡片只在指针位于元素上时显示
        setTip(hit ? { ...tipOf(hit), x: hit.client.x, y: hit.client.y } : null);
    };

    return (
        <>
            {hypergraph && (
                <HypergraphView
                    className="w-full rounded-xl h-full"
                    data={hypergraph}
                    mode={visualizationMode}
                    centerNode={selectedVertex}
                    typeColors={entityTypeColors}
                    fallbackHeight={800}
                    onHover={onHover}
                    onSelect={onSelect}
                />
            )}
            {tip && (
                <HoverTip
                    title={tip.title}
                    item={tip.item}
                    priority={tip.priority}
                    exclude={tip.exclude}
                    limit={tip.limit}
                    x={tip.x}
                    y={tip.y}
                />
            )}
        </>
    );
};

export default GraphContainer;
