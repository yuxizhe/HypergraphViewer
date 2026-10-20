/**
 * 管理后台的数据接口，按 Hypergraph-DB 管理后台的 HTTP 格式读写（GET {base}/info|stats|vertices|edges|hif，
 * POST {base}/vertex/get|upsert|delete、edge/get|upsert|delete、save、hif）。
 * params 附加到每个请求的网址上（如 { database }）；subgraph 不在此格式中，需要关系图时由宿主补上
 */
export const createHttpAdminApi = (baseUrl = "/api/admin", { params = {} } = {}) => {
    const url = (path, query = {}) => {
        const search = new URLSearchParams(
            Object.entries({ ...params, ...query }).filter(([, v]) => v !== "" && v != null)
        ).toString();
        return `${baseUrl}${path}${search ? `?${search}` : ""}`;
    };
    const request = async (path, { query, body } = {}) => {
        const opts =
            body === undefined
                ? {}
                : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
        const res = await fetch(url(path, query), opts);
        let data;
        try {
            data = await res.json();
        } catch {
            throw new Error(`HTTP ${res.status}`);
        }
        if (!res.ok || (data && data.error)) throw new Error(data?.error || `HTTP ${res.status}`);
        return data;
    };
    return {
        info: () => request("/info"),
        stats: () => request("/stats"),
        listVertices: (query) => request("/vertices", { query }),
        listEdges: (query) => request("/edges", { query }),
        getVertex: (id) => request("/vertex/get", { body: { id } }),
        getEdge: (vertices) => request("/edge/get", { body: { vertices } }),
        upsertVertex: (body) => request("/vertex/upsert", { body }),
        deleteVertex: (id) => request("/vertex/delete", { body: { id } }),
        upsertEdge: (body) => request("/edge/upsert", { body }),
        deleteEdge: (vertices) => request("/edge/delete", { body: { vertices } }),
        save: () => request("/save", { body: {} }),
        exportHIF: () => request("/hif"),
        importHIF: (hif) => request("/hif", { body: hif }),
    };
};
