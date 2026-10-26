import { loadHIFFromFile, loadHIFFromURL } from 'hypergraph-viz/explorer';
import { datasetUrl } from './datasets.js';

const isValid = (data) =>
    data && typeof data === 'object' && data.database?.name && typeof data.database.vertices === 'number' &&
    Array.isArray(data.vertices) && data.graphs && typeof data.graphs === 'object';

// 数据源 → 内部格式（createLocalSource 的输入）：示例数据集、远程 HIF 地址、本地 HIF 文件
export const loadDataSource = async (source) => {
    let data;
    switch (source.type) {
        case 'static':
            data = await loadHIFFromURL(datasetUrl(source.dataset));
            break;
        case 'remote':
            data = await loadHIFFromURL(source.url);
            break;
        case 'file':
            data = await loadHIFFromFile(source.file);
            break;
        default:
            throw new Error(`Unsupported data source type: ${source.type}`);
    }
    if (!isValid(data)) throw new Error('Data format validation failed');
    return data;
};
