import { datas } from './data.js';

// API call functions
export const fetchDatabaseInfo = async () => {
    return Promise.resolve(datas.database);
};

export const fetchVertices = async (
    page,
    pageSize,
    search,
    sortBy,
    sortOrder
) => {
    const toLower = (v) => (v ?? "").toString().toLowerCase();
    let list = Array.isArray(datas.vertices) ? datas.vertices : [];

    if (search) {
        const q = toLower(search);
        list = list.filter(
            (v) =>
                toLower(v.id).includes(q) ||
                toLower(v.entity_type).includes(q) ||
                toLower(v.description).includes(q)
        );
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
    const data = list.slice(start, start + pageSize);
    return Promise.resolve({
        data,
        pagination: { page: cur, page_size: pageSize, total, total_pages },
    });
};

export const fetchGraphData = async (vertexId) => {
    const entry = datas.graphs[vertexId];
    if (entry && entry.vertices && entry.edges) {
        return Promise.resolve({
            vertices: entry.vertices,
            edges: entry.edges,
        });
    }
    return Promise.resolve({ vertices: {}, edges: {} });
};
