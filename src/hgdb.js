/**
 * Hypergraph-DB（https://github.com/iMoonLab/Hypergraph-DB）的 .hgdb 文件 → HIF
 *
 * .hgdb 是 pickle 写出的 { v_data: {顶点: 属性}, v_inci: {顶点: {超边}}, e_data: {(成员...): 属性} }，
 * 超边以排序后的成员元组为键。转为 HIF 后沿用 HIF 的解析：超边名为成员以 _ 连接（同 scripts/build_datasets.py）
 */
import { unpickle, PyTuple, PySet, PyObject } from './pickle.js';

// 顶点 id 转为字符串；元组 id 写成 Python 的样子
const idOf = (key) => {
    if (typeof key === 'string') return key;
    if (key instanceof PyTuple) return `(${key.map(idOf).join(', ')}${key.length === 1 ? ',' : ''})`;
    if (key === null) return 'None';
    if (typeof key === 'boolean') return key ? 'True' : 'False';
    return String(key);
};

// 属性值转为可显示的 JSON 值：dict → 对象，元组、集合 → 数组，NaN / Infinity → null（与 HIF 解析一致）
const plain = (value, seen = new Set()) => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'bigint') return String(value);
    if (value instanceof Uint8Array) return `<${value.length} bytes>`;
    if (value instanceof PyObject) return value.toString();
    if (typeof value !== 'object') return String(value);
    // pickle 允许自引用，遇到环时停止展开
    if (seen.has(value)) return '<...>';
    seen.add(value);
    const result = value instanceof Map
        ? Object.fromEntries([...value].map(([k, v]) => [idOf(k), plain(v, seen)]))
        : [...value].map((v) => plain(v, seen));
    seen.delete(value);
    return result;
};

const attrsOf = (value) => {
    const attrs = plain(value);
    return attrs && typeof attrs === 'object' && !Array.isArray(attrs) ? attrs : {};
};

/**
 * 解码 .hgdb 并转为 HIF
 * @param {Uint8Array} bytes - 文件内容
 * @param {string} name - 数据库名（如文件名）
 * @returns {Object} HIF 数据
 */
export const hgdbToHIF = (bytes, name = '') => {
    let data;
    try {
        data = unpickle(bytes);
    } catch (error) {
        throw new Error(`Not a readable Hypergraph-DB file: ${error.message}`);
    }
    if (!(data instanceof Map) || !(data.get('v_data') instanceof Map) || !(data.get('e_data') instanceof Map)) {
        throw new Error('Not a Hypergraph-DB file: expected a dict with v_data and e_data');
    }

    const nodes = [...data.get('v_data')].map(([id, attrs]) => ({ node: idOf(id), attrs: attrsOf(attrs) }));
    const edges = [];
    const incidences = [];
    data.get('e_data').forEach((attrs, key) => {
        const members = (key instanceof PyTuple || key instanceof PySet || Array.isArray(key) ? [...key] : [key]).map(idOf);
        const edge = members.join('_');
        edges.push({ edge, attrs: attrsOf(attrs) });
        members.forEach((node) => incidences.push({ edge, node }));
    });

    return {
        'network-type': 'undirected',
        metadata: { name: name || 'Hypergraph-DB' },
        nodes,
        edges,
        incidences,
    };
};
