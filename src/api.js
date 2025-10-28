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
    sortOrder
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
