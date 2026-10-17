export const EXCLUDED_KEYS = new Set([
    "id",
    "label",
    "style",
    "data",
    "weight",
    "source_id",
]);

// 悬停卡片中超边优先显示的属性、有 type 时不显示的属性（类型看 type），以及最多显示的属性个数；侧边栏显示全部属性
export const HYPEREDGE_PRIORITY = ["description", "type", "summary", "keywords", "members"];
export const HYPEREDGE_TIP_EXCLUDED = ["keywords"];
export const HYPEREDGE_FIELD_LIMIT = 5;
