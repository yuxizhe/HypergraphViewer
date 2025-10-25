// Configuration constants
export const COLORS = [
    "#F6BD16",
    "#00C9C9",
    "#F08F56",
    "#D580FF",
    "#FF3D00",
    "#16f69c",
    "#004ac9",
    "#f056d1",
    "#a680ff",
    "#c8ff00",
];

// 6 predefined colors, cycled for different entity types
export const ENTITY_TYPE_COLORS_PALETTE = [
    "#00C9C9",
    "#a68fff",
    "#F08F56",
    "#0d7c4f",
    "#004ac9",
    "#f056d1",
];

export const DEFAULT_NODE_COLOR = "#8b5cf6";
export const LAYOUT_THRESHOLD = 100;
export const EDGE_SEPARATOR = "|#|";

// Dynamically generate entity type color mapping
export const generateEntityTypeColors = (vertices) => {
    const entityTypes = [
        ...new Set(vertices.map((v) => v.entity_type).filter(Boolean)),
    ];
    const colorMap = {};

    entityTypes.forEach((entityType, index) => {
        colorMap[entityType] =
            ENTITY_TYPE_COLORS_PALETTE[
            index % ENTITY_TYPE_COLORS_PALETTE.length
            ];
    });

    return colorMap;
};

export const EXCLUDED_KEYS = new Set([
    "id",
    "label",
    "style",
    "data",
    "weight",
    "source_id",
]);
