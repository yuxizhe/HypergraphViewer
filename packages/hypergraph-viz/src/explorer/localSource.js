import { fromKeyedEdges } from '../adapters';

/**
 * 内存中的数据源：内部格式 { database, vertices: [...], graphs: { 中心实体: { vertices, edges } } }（fromHIF / parseHIF 的结果）。
 * HypergraphExplorer 左栏的统计、实体列表、超边列表和子图都从数据源读取；HTTP 后端按同样的接口实现自己的数据源
 *
 * In-memory source over the internal format (the result of fromHIF / parseHIF); HTTP backends implement the same interface
 */
export const createLocalSource = (data) => {
    // graphs 中有子图（可作为中心）的实体 id → 子图实体数
    const centers = new Map(Object.entries(data.graphs).map(([id, g]) => [id, Object.keys(g.vertices || {}).length]));

    // 可浏览的超边：各实体子图中超边的并集（key 为 |#| 拼接的成员），带成员与属性
    let hyperedges = null;
    const browsableHyperedges = () => {
        if (hyperedges) return hyperedges;
        const byKey = new Map();
        Object.values(data.graphs).forEach((g) => {
            Object.entries(g.edges || {}).forEach(([key, edge]) => {
                if (!byKey.has(key)) byKey.set(key, { ...edge, id: key, members: key.split("|#|") });
            });
        });
        hyperedges = [...byKey.values()];
        return hyperedges;
    };

    return {
        // 已载入的超图：各实体子图的并集（示例数据只带了部分实体的子图，不是全库），用于统计
        async overview() {
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
                centers,
            };
        },

        // 实体列表：搜索、按类型筛选（多选；null 表示未分类）、排序、分页；degree 为子图实体数
        async listVertices({ page = 1, pageSize = 50, search = "", sortBy = "degree", sortOrder = "desc", types = [] } = {}) {
            const toLower = (v) => (v ?? "").toString().toLowerCase();
            const vertexById = new Map(data.vertices.map((v) => [v.id, v]));
            let list = Object.keys(data.graphs).map((key) => ({
                id: key,
                ...vertexById.get(key),
                ...data.graphs[key],
                degree: Object.keys(data.graphs[key].vertices).length,
            }));

            if (search) {
                const q = toLower(search);
                list = list.filter(
                    (v) => toLower(v.id).includes(q) || toLower(v.entity_type).includes(q) || toLower(v.description).includes(q)
                );
            }
            if (types.length) {
                const wanted = new Set(types);
                list = list.filter((v) => wanted.has(v.entity_type || null));
            }
            if (sortBy === "degree") {
                list.sort((a, b) => (sortOrder === "asc" ? (a.degree || 0) - (b.degree || 0) : (b.degree || 0) - (a.degree || 0)));
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
            return {
                data: list.slice(start, start + pageSize),
                pagination: { page: cur, page_size: pageSize, total, total_pages },
            };
        },

        // 可浏览超边列表，按大小降序；search 匹配描述、关键词、类型与成员
        async listHyperedges({ search = "" } = {}) {
            const q = search.trim().toLowerCase();
            const text = (he) =>
                [he.description, he.summary, he.keywords, he.type, he.edgeName, ...he.members].join(" ").toLowerCase();
            return browsableHyperedges()
                .filter((he) => !q || text(he).includes(q))
                .sort((a, b) => b.members.length - a.members.length);
        },

        // 以 center 为中心的子图，hypergraph-viz 的输入格式
        async subgraph(center) {
            const entry = data.graphs[center];
            return fromKeyedEdges(entry?.vertices && entry?.edges ? entry : { vertices: {}, edges: {} });
        },
    };
};
