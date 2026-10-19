import { getUrlParam, setUrlParam } from './urlParams.js';

// 示例数据集：public/datasets/ 下的 HIF 文件，由 scripts/build_datasets.py 生成
// center：默认显示的中心实体；不设时为度数最高的实体（三国、西游记中度数最高的子图有三四百个实体，太密）
// hiddenTypes：打开子图时默认隐藏的实体类型（如金融数据的“财季”，即“期间:”开头的实体，几乎每条超边都带一个季度）
export const DATASETS = [
    { id: 'neurology', name: { en: 'Neurology (medical)', zh: '神经学（医学）' }, center: 'STROKE' },
    { id: 'sanguo', name: { en: 'Romance of the Three Kingdoms (Chinese)', zh: '三国演义' }, center: '关羽' },
    { id: 'xiyou', name: { en: 'Journey to the West (Chinese)', zh: '西游记' }, center: '观音菩萨' },
    { id: 'got', name: { en: 'Game of Thrones, season 1', zh: '权力的游戏 第一季' }, center: 'Arya Stark' },
    { id: 'nvda', name: { en: 'NVIDIA hyperscale cloud (finance, Chinese)', zh: '英伟达超大规模云（金融）' }, hiddenTypes: ['财季'] },
];

export const DEFAULT_DATASET = DATASETS[0].id;

export const datasetUrl = (id) => `${import.meta.env.BASE_URL}datasets/${id}.hif.json`;

// 网址中 ?dataset= 指定的数据集（便于分享链接），无效时用默认数据集
export const initialDataset = () => {
    const id = getUrlParam('dataset');
    return DATASETS.some((d) => d.id === id) ? id : DEFAULT_DATASET;
};

// 把当前数据集写入网址；非示例数据时去掉该参数
export const rememberDataset = (id) => setUrlParam('dataset', id);
