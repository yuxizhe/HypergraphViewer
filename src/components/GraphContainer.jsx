import React, { useEffect, useRef, useState } from 'react';
import HoverTip from './HoverTip.jsx';
import { HYPEREDGE_FIELD_LIMIT, HYPEREDGE_PRIORITY, HYPEREDGE_TIP_EXCLUDED } from '../constants.js';

// 悬停目标 → 悬停卡片内容：顶点 → 顶点属性；连线（2 个顶点的超边）/ 超边轮廓 → 超边属性
const tipOf = (e, data) => {
    if (e.targetType === "node") {
        const node = data?.data.nodes.find((n) => n.id === e.target.id);
        return node && { title: "node", item: node };
    }
    // 只有 2 个成员的超边显示为“边”
    const hyperedge = (item) => ({
        title: item.members.length === 2 ? "edge" : "hyperedge",
        item,
        priority: HYPEREDGE_PRIORITY,
        // 没有 type 的超边（如 Hyper-RAG 原版抽取的图）仍显示 keywords
        exclude: item.type ? HYPEREDGE_TIP_EXCLUDED : [],
        limit: HYPEREDGE_FIELD_LIMIT,
    });
    if (e.targetType === "edge") {
        const edge = data?.data.edges.find((d) => d.id === e.target.id);
        if (!edge) return null;
        const { source, target, ...rest } = edge;
        return hyperedge({ ...rest, members: [source, target] });
    }
    if (e.targetType === "bubble-sets") {
        const { edge = {}, members } = e.target.options || {};
        return hyperedge({ ...edge, members: Array.isArray(members) ? members : [] });
    }
    return null;
};

const GraphContainer = ({
    graphDataFormatted,
    visualizationMode,
    setHoverHyperedge,
    setHoverNode
}) => {
    const containerRef = useRef(null);
    const graphRef = useRef(null);
    const [tip, setTip] = useState(null);

    // Initialize graph
    useEffect(() => {
        if (!graphDataFormatted || !containerRef.current || !window.G6) return;

        // Destroy previous graph instance and clear canvas
        if (graphRef.current && !graphRef.current.destroyed) {
            graphRef.current.clear();
            if (containerRef.current) {
                containerRef.current.innerHTML = "";
            }
        }

        const graph = new window.G6.Graph({
            container: containerRef.current,
            width: containerRef.current.offsetWidth,
            height: containerRef.current.offsetHeight || 800,
            data: graphDataFormatted.data,
            behaviors: ["zoom-canvas", "drag-canvas", "drag-element"],
            autoFit: "center",
            animate: false,
            node: graphDataFormatted.node,
            edge: graphDataFormatted.edge,
            layout: graphDataFormatted.layout,
            plugins: graphDataFormatted.plugins,
        });

        graphRef.current = graph;
        graphRef.current.render();

        graph.on("pointermove", (e) => {
            if (e.targetType === "bubble-sets") {
                const target = e.target.options;
                const newHyperedge = {
                    ...target.edge,
                    members: Array.isArray(target.members) ? target.members : [],
                };
                setHoverHyperedge((prev) => {
                    if (
                        !prev ||
                        prev.keywords !== newHyperedge.keywords ||
                        prev.summary !== newHyperedge.summary ||
                        prev.weight !== newHyperedge.weight ||
                        JSON.stringify(prev.members) !==
                        JSON.stringify(newHyperedge.members)
                    ) {
                        return newHyperedge;
                    }
                    return prev;
                });
            }
            if (e.targetType === "node") {
                const target = graphDataFormatted.data.nodes.find(
                    (node) => node.id === e.target.id
                );
                setHoverNode((prev) => {
                    if (!prev || prev.id !== target?.id) {
                        return target;
                    }
                    return prev;
                });
            }

            // 侧边栏保留最后悬停的超边 / 顶点；悬停卡片只在指针位于元素上时显示
            const next = e.client ? tipOf(e, graphDataFormatted) : null;
            setTip(next ? { ...next, x: e.client.x, y: e.client.y } : null);
        });

        // Add window resize listener
        const handleResize = () => {
            if (graphRef.current && containerRef.current) {
                graphRef.current.setSize(
                    containerRef.current.offsetWidth,
                    containerRef.current.offsetHeight
                );
            }
        };

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            if (graphRef.current && !graphRef.current.destroyed) {
                graphRef.current.clear();
            }
            if (containerRef.current) {
                containerRef.current.innerHTML = "";
            }
            setHoverHyperedge(null);
            setTip(null);
        };
    }, [graphDataFormatted, visualizationMode, setHoverHyperedge, setHoverNode]);

    return (
        <>
            <div
                ref={containerRef}
                className="w-full rounded-xl h-full"
                onMouseLeave={() => setTip(null)}
            />
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
