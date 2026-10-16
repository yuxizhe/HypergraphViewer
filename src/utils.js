import { DEFAULT_NODE_COLOR } from './constants.js';

// 超边轮廓的透明度与线宽：常态 / 点击选中 / 其他超边被选中时变淡
export const BUBBLE_NORMAL = { fillOpacity: 0.2, strokeOpacity: 0.2, lineWidth: 1 };
export const BUBBLE_HIGHLIGHT = { fillOpacity: 0.45, strokeOpacity: 1, lineWidth: 3 };
export const BUBBLE_DIMMED = { fillOpacity: 0.03, strokeOpacity: 0.05, lineWidth: 1 };

// Utility functions
export const createBubbleStyle = (baseColor) => ({
    fill: baseColor,
    stroke: baseColor,
    ...BUBBLE_NORMAL,
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
