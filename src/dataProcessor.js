import { COLORS, LAYOUT_THRESHOLD, EDGE_SEPARATOR, EXCLUDED_KEYS } from './constants.js';
import { createBubbleStyle, getNodeColor } from './utils.js';

// Convert data to G6 Graph format
export const processGraphData = (graphData, selectedVertex, visualizationMode, entityTypeColors) => {
    if (!graphData) return null;

    const hyperData = {
        nodes: Object.entries(graphData.vertices).map(([key, value]) => ({
            id: key,
            label: key,
            ...value,
        })),
        edges: [],
        hyperEdges: [],
    };
    const plugins = [];
    const edgeEntries = Object.entries(graphData.edges);

    if (visualizationMode === "graph") {
        // Graph mode: only show dimension 2 ball-and-stick diagram
        const edgeSet = new Set();

        edgeEntries.forEach(([key, edge]) => {
            const nodes = key.split(EDGE_SEPARATOR);
            if (nodes.length !== 2) return;

            const [a, b] = nodes;
            const edgeId = a < b ? `${a}-${b}` : `${b}-${a}`;

            if (!edgeSet.has(edgeId)) {
                edgeSet.add(edgeId);
                hyperData.edges.push({
                    id: edgeId,
                    source: a,
                    target: b,
                    ...edge,
                });
            }
        });

        // Filter unconnected nodes
        const connectedNodes = new Set();
        hyperData.edges.forEach((edge) => {
            connectedNodes.add(edge.source);
            connectedNodes.add(edge.target);
        });
        hyperData.nodes = hyperData.nodes.filter((node) =>
            connectedNodes.has(node.id)
        );
    } else {
        // Hyper mode: render 2-node entries as normal edges, others as bubble-sets
        const edgeSet = new Set();
        edgeEntries.forEach(([key, edge], i) => {
            const nodes = key.split(EDGE_SEPARATOR);

            if (nodes.length === 2) {
                const [a, b] = nodes;
                const edgeId = a < b ? `${a}-${b}` : `${b}-${a}`;
                if (!edgeSet.has(edgeId)) {
                    edgeSet.add(edgeId);
                    hyperData.edges.push({
                        id: edgeId,
                        source: a,
                        target: b,
                        ...edge,
                    });
                }
                return;
            }

            plugins.push({
                key: `bubble-sets-${key}`,
                type: "bubble-sets",
                members: nodes,
                weight: edge.weight || nodes.length,
                description: edge.description || edge.summary || "",
                edge: edge,
                ...createBubbleStyle(COLORS[i % COLORS.length]),
            });

            hyperData.hyperEdges.push({
                id: key,
                ...edge,
                members: nodes,
            });
        });

        // Assign cluster by hyperEdges for layout grouping
        // Pick the heaviest hyperedge containing the node as its primary cluster
        const nodeIdToCandidateClusters = new Map();
        hyperData.hyperEdges.forEach((he) => {
            const weight =
                he.weight ||
                (Array.isArray(he.members) ? he.members.length : 1);
            (he.members || []).forEach((m) => {
                const list = nodeIdToCandidateClusters.get(m) || [];
                list.push({ id: he.id, weight });
                nodeIdToCandidateClusters.set(m, list);
            });
        });
        hyperData.nodes = hyperData.nodes.map((n) => {
            const candidates = nodeIdToCandidateClusters.get(n.id) || [];
            if (candidates.length === 0) return n;
            const primary = candidates.reduce((best, cur) =>
                cur.weight > best.weight ? cur : best
            );
            return { ...n, cluster: primary.id };
        });
    }

    // Add tooltip plugin
    plugins.push({
        type: "tooltip",
        getContent: (e, items) => {
            return items
                .map((item) => {
                    let result = `<h3><strong>${item.entity_name || item.id
                        }</strong></h3>`;
                    // Display all remaining properties
                    Object.entries(item).forEach(([key, value]) => {
                        if (!EXCLUDED_KEYS.has(key)) {
                            result += `<p><strong>${key}:</strong> ${value}</p>`;
                        }
                    });
                    return result;
                })
                .join("");
        },
    });

    const isGraph = visualizationMode === "graph";

    return {
        data: hyperData,
        plugins: isGraph ? [plugins[plugins.length - 1]] : plugins,
        node: {
            palette: { field: "cluster" },
            style: {
                size: hyperData.nodes.length > LAYOUT_THRESHOLD ? 15 : 20,
                labelText: (d) => d.id,
                fill: (d) => getNodeColor(d, selectedVertex, entityTypeColors),
            },
        },
        edge: {
            style: {
                size: isGraph ? 3 : 2,
                stroke: "#a68fff",
                lineWidth: 1,
            },
        },
        layout: {
            type:
                hyperData.nodes.length > LAYOUT_THRESHOLD ? "force" : "force",
            clustering: !isGraph,
            preventOverlap: true,
            nodeClusterBy: isGraph ? undefined : "cluster",
            gravity: 50,
            linkDistance: 50,
        },
        autoFit: "center",
    };
};
