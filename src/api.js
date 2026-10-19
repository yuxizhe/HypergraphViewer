import { datas } from './data.js';
import { loadHIFFromURL, loadHIFFromFile, validateHIFData } from './hifParser.js';

// Data source manager
class DataSourceManager {
    constructor() {
        this.currentData = datas;
        this.currentSource = { type: 'static' };
    }

    async setDataSource(source) {
        try {
            let newData;

            switch (source.type) {
                case 'static':
                    newData = datas;
                    break;

                case 'remote':
                    newData = await loadHIFFromURL(source.url);
                    break;

                case 'file':
                    newData = await loadHIFFromFile(source.file);
                    break;

                default:
                    throw new Error(`Unsupported data source type: ${source.type}`);
            }

            if (!validateHIFData(newData)) {
                throw new Error('Data format validation failed');
            }

            this.currentData = newData;
            this.currentSource = source;

            return { success: true, data: newData };
        } catch (error) {
            console.error('Data source setup failed:', error);
            return { success: false, error: error.message };
        }
    }

    getCurrentData() {
        return this.currentData;
    }

    getCurrentSource() {
        return this.currentSource;
    }
}

// Global data source manager instance
const dataSourceManager = new DataSourceManager();

// Export data source manager for external use
export { dataSourceManager };

// API call functions
export const fetchDatabaseInfo = async () => {
    const data = dataSourceManager.getCurrentData();
    return Promise.resolve(data.database);
};

export const fetchVertices = async (
    page,
    pageSize,
    search,
    sortBy,
    sortOrder,
    types = []
) => {
    const data = dataSourceManager.getCurrentData();
    const toLower = (v) => (v ?? "").toString().toLowerCase();
    // graphs 转为数组，id 是 key
    let list = Object.keys(data.graphs).map(key => ({
        id: key,
        ...data.vertices.find(v => v.id === key),
        ...data.graphs[key],
        degree: Object.keys(data.graphs[key].vertices).length,
    }));

    if (search) {
        const q = toLower(search);
        list = list.filter(
            (v) =>
                toLower(v.id).includes(q) ||
                toLower(v.entity_type).includes(q) ||
                toLower(v.description).includes(q)
        );
    }

    // 按实体类型筛选（多选；null 表示未分类）
    if (types.length) {
        const wanted = new Set(types);
        list = list.filter((v) => wanted.has(v.entity_type || null));
    }

    if (sortBy === "degree") {
        list.sort((a, b) =>
            sortOrder === "asc"
                ? (a.degree || 0) - (b.degree || 0)
                : (b.degree || 0) - (a.degree || 0)
        );
    } else if (sortBy === "id") {
        list.sort((a, b) => {
            const cmp = String(a.id).localeCompare(String(b.id));
            return sortOrder === "asc" ? cmp : -cmp;
        });
    }

    const total = list.length;
    const total_pages = Math.max(1, Math.ceil(total / pageSize));
    const cur = Math.min(Math.max(1, page), total_pages);
    const start = (cur - 1) * pageSize;
    const resultData = list.slice(start, start + pageSize);
    return Promise.resolve({
        data: resultData,
        pagination: { page: cur, page_size: pageSize, total, total_pages },
    });
};

export const fetchGraphData = async (vertexId) => {
    const data = dataSourceManager.getCurrentData();
    const entry = data.graphs[vertexId];
    if (entry && entry.vertices && entry.edges) {
        return Promise.resolve({
            vertices: entry.vertices,
            edges: entry.edges,
        });
    }
    return Promise.resolve({ vertices: {}, edges: {} });
};

// 当前数据源中可浏览的超边：各实体子图中超边的并集（key 为 |#| 拼接的成员），带成员与属性
let hyperedgeCache = { data: null, list: [] };
const browsableHyperedges = () => {
    const data = dataSourceManager.getCurrentData();
    if (hyperedgeCache.data === data) return hyperedgeCache.list;
    const byKey = new Map();
    Object.values(data.graphs).forEach((g) => {
        Object.entries(g.edges || {}).forEach(([key, edge]) => {
            if (!byKey.has(key)) byKey.set(key, { ...edge, id: key, members: key.split("|#|") });
        });
    });
    hyperedgeCache = { data, list: [...byKey.values()] };
    return hyperedgeCache.list;
};

// 当前数据源中已载入的超图：各实体子图的并集（默认数据只带了部分实体的子图，不是全库）
export const fetchLoadedHypergraph = async () => {
    const data = dataSourceManager.getCurrentData();
    const vertices = {};
    data.vertices.forEach((v) => {
        vertices[v.id] = v;
    });
    Object.values(data.graphs).forEach((g) => {
        Object.entries(g.vertices || {}).forEach(([id, v]) => {
            if (!(id in vertices)) vertices[id] = v;
        });
    });
    // 实体列表（可作为中心的实体）中的类型及数量，供列表的类型筛选
    const listedTypes = new Map();
    data.vertices.forEach((v) => {
        const type = v.entity_type || null;
        listedTypes.set(type, (listedTypes.get(type) || 0) + 1);
    });
    return {
        database: data.database,
        vertices,
        hyperedges: browsableHyperedges(),
        listedTypes: [...listedTypes].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    };
};

// 可浏览超边列表，按大小降序；search 匹配描述、关键词、类型与成员
export const fetchHyperedges = async (search = "") => {
    const q = search.trim().toLowerCase();
    const text = (he) =>
        [he.description, he.summary, he.keywords, he.type, he.edgeName, ...he.members].join(" ").toLowerCase();
    return browsableHyperedges()
        .filter((he) => !q || text(he).includes(q))
        .sort((a, b) => b.members.length - a.members.length);
};

// 有子图（可作为中心）的实体 id → 子图实体数
export const centerSizes = () => {
    const data = dataSourceManager.getCurrentData();
    return new Map(Object.entries(data.graphs).map(([id, g]) => [id, Object.keys(g.vertices || {}).length]));
};
