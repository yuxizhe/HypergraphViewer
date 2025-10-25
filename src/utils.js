import { DEFAULT_NODE_COLOR } from './constants.js';

// Utility functions
export const createBubbleStyle = (baseColor) => ({
    fill: baseColor,
    stroke: baseColor,
    maxRoutingIterations: 100,
    maxMarchingIterations: 20,
    pixelGroup: 4,
    edgeR0: 10,
    edgeR1: 60,
    nodeR0: 1,
    nodeR1: 5,
    morphBuffer: 10,
    threshold: 4,
    memberInfluenceFactor: 1,
    edgeInfluenceFactor: 4,
    nonMemberInfluenceFactor: -0.8,
    virtualEdges: true,
});

export const getNodeColor = (node, selectedVertex, entityTypeColors) => {
    if (node.id === selectedVertex) return "#6d28d9";
    return entityTypeColors[node.entity_type] || DEFAULT_NODE_COLOR;
};

export const formatDescription = (description) => {
    if (!description) return "";
    return description.split("<SEP>").join(" ");
};
