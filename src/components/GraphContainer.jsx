import React, { useEffect, useRef } from 'react';

const GraphContainer = ({
    graphDataFormatted,
    visualizationMode,
    setHoverHyperedge,
    setHoverNode
}) => {
    const containerRef = useRef(null);
    const graphRef = useRef(null);

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
        };
    }, [graphDataFormatted, visualizationMode, setHoverHyperedge, setHoverNode]);

    return (
        <div
            ref={containerRef}
            className="w-full rounded-xl h-full"
        />
    );
};

export default GraphContainer;
