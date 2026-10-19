/**
 * HIF (Hypergraph Interchange Format) Parser
 * Supports parsing both JSON and HIF format files
 */

/**
 * Parse HIF or JSON data and convert to internal format
 * @param {string} content - File content as string
 * @param {string} filename - Original filename for format detection
 * @returns {Promise<Object>} Parsed data in internal format
 */
export const parseHIF = async (content, filename = '') => {
    try {
        // Try to parse as JSON first
        const data = JSON.parse(content);

        // Check if it's already in our internal format
        if (data.database && data.vertices && data.graphs) {
            return data;
        }

        // Check if it's a HIF format (could have different structure)
        if (data.hypergraph || data.nodes || data.edges || data.hyperedges || Array.isArray(data.incidences)) {
            return convertHIFToInternal(data);
        }

        // If it's a generic JSON, try to infer structure
        return inferAndConvert(data);

    } catch (jsonError) {
        // If JSON parsing fails, try to parse as custom HIF format
        try {
            return parseCustomHIFFormat(content);
        } catch (hifError) {
            throw new Error(`Unable to parse file: ${filename}. JSON error: ${jsonError.message}, HIF error: ${hifError.message}`);
        }
    }
};

/**
 * Convert HIF format to internal format
 * @param {Object} hifData - HIF format data
 * @returns {Object} Internal format data
 */
const convertHIFToInternal = (hifData) => {
    // HIF 标准：incidences 必填，nodes / edges 可省略
    if (Array.isArray(hifData.incidences)) return convertStandardHIF(hifData);

    const result = {
        database: {
            name: hifData.name || hifData.hypergraph?.name || "imported_hypergraph",
            vertices: 0,
            edges: 0
        },
        vertices: [],
        graphs: {}
    };

    // Handle different HIF structures
    let nodes = hifData.nodes || hifData.vertices || hifData.hypergraph?.nodes || [];
    let edges = hifData.edges || hifData.hyperedges || hifData.hypergraph?.edges || [];

    // Convert nodes to vertices
    if (Array.isArray(nodes)) {
        result.vertices = nodes.map(node => ({
            id: node.id || node.name || node.node,

            description: node.description || node.label || "",
            degree: node.degree || 0,
            entity_name: node.name || node.id || node.node,
            ...node.attrs,
            ...node.properties,
        }));
    } else if (typeof nodes === 'object') {
        result.vertices = Object.entries(nodes).map(([id, node]) => ({
            id,

            description: node.description || node.label || "",
            degree: node.degree || 0,
            entity_name: node.name || node.id || id,
            ...node.attrs,
            ...node.properties,
        }));
    }

    // Build graphs from edges
    const graphsMap = {};
    if (Array.isArray(edges)) {
        edges.forEach(edge => {
            const nodeIds = edge.nodes || edge.vertices || [edge.source, edge.target].filter(Boolean);

            if (nodeIds && nodeIds.length > 0) {
                nodeIds.forEach(nodeId => {
                    if (!graphsMap[nodeId]) {
                        graphsMap[nodeId] = {
                            vertices: {},
                            edges: {}
                        };
                    }

                    // Add connected vertices
                    nodeIds.forEach(connectedId => {
                        const vertex = result.vertices.find(v => v.id === connectedId);
                        if (vertex) {
                            graphsMap[nodeId].vertices[connectedId] = vertex;
                        }
                    });

                    // Add edge
                    const edgeKey = nodeIds.join('|||');
                    graphsMap[nodeId].edges[edgeKey] = {
                        weight: edge.weight || 1,
                        type: edge.type || "default",
                        properties: edge.properties || {}
                    };
                });
            }
        });
    }

    result.graphs = graphsMap;
    result.database.vertices = result.vertices.length;
    result.database.edges = Array.isArray(edges) ? edges.length : 0;

    return result;
};

/**
 * Convert standard HIF (https://github.com/HIF-org/HIF-standard) to internal format
 * 节点、超边 id 可以是数字或字符串，统一转为字符串（graphs 的 key 本就是字符串）；
 * 重复的节点、超边、关联合并；只出现在关联中的节点也是实体；孤立节点也可作为中心
 * @param {Object} hifData - HIF format data
 * @returns {Object} Internal format data
 */
const convertStandardHIF = (hifData) => {
    const metadata = hifData.metadata || {};
    const toAttrs = (item) => ({ ...item.attrs, ...item.properties });

    // 节点：重复出现时合并属性
    const vertexById = new Map();
    const addVertex = (rawId, attrs = {}) => {
        if (rawId === undefined || rawId === null) return;
        const id = String(rawId);
        const prev = vertexById.get(id);
        vertexById.set(id, {
            description: "",
            degree: 0,
            entity_name: id,
            ...prev,
            ...attrs,
            id,
        });
    };
    (Array.isArray(hifData.nodes) ? hifData.nodes : []).forEach((node) => {
        addVertex(node.node ?? node.id ?? node.name, toAttrs(node));
    });

    // 超边自身的属性（HIF edges[].attrs，如 type、description）
    const edgeAttrs = new Map();
    (Array.isArray(hifData.edges) ? hifData.edges : []).forEach((edge) => {
        const name = edge.edge ?? edge.id ?? edge.name;
        if (name === undefined || name === null) return;
        const key = String(name);
        edgeAttrs.set(key, { ...edgeAttrs.get(key), ...toAttrs(edge) });
    });

    // 按超边分组关联，同一 (超边, 节点) 只保留一次；每个实体首条关联记录上的属性作为超边没有 attrs 时的兜底
    const edgeGroups = new Map();
    const firstIncidenceAttrs = new Map();
    hifData.incidences.forEach((incidence) => {
        if (incidence.edge === undefined || incidence.edge === null) return;
        if (incidence.node === undefined || incidence.node === null) return;
        const edgeName = String(incidence.edge);
        const nodeId = String(incidence.node);
        if (!vertexById.has(nodeId)) addVertex(nodeId);
        if (!edgeGroups.has(edgeName)) edgeGroups.set(edgeName, new Set());
        edgeGroups.get(edgeName).add(nodeId);
        if (!firstIncidenceAttrs.has(nodeId)) firstIncidenceAttrs.set(nodeId, incidence.attrs);
    });

    const graphsMap = {};
    const graphOf = (nodeId) => (graphsMap[nodeId] ??= { vertices: {}, edges: {} });
    edgeGroups.forEach((members, edgeName) => {
        const nodeIds = [...members];
        const edgeKey = nodeIds.join('|#|');
        nodeIds.forEach((nodeId) => {
            const graph = graphOf(nodeId);
            nodeIds.forEach((id) => {
                graph.vertices[id] = vertexById.get(id);
            });
            graph.edges[edgeKey] = {
                weight: 1,
                edgeName,
                // 罗列其他属性：超边自身的 attrs；没有时沿用该实体关联记录上的 attrs
                ...(edgeAttrs.get(edgeName) || firstIncidenceAttrs.get(nodeId)),
            };
        });
    });
    // 没有关联的孤立节点：子图只有它自己
    vertexById.forEach((vertex, id) => {
        if (!graphsMap[id]) graphOf(id).vertices[id] = vertex;
    });

    const edgeNames = new Set([...edgeAttrs.keys(), ...edgeGroups.keys()]);
    return {
        database: {
            name: hifData.name || metadata.name || "imported_hypergraph",
            vertices: vertexById.size,
            edges: edgeNames.size,
            ...(hifData["network-type"] && { networkType: hifData["network-type"] }),
        },
        vertices: [...vertexById.values()],
        graphs: graphsMap,
    };
};

/**
 * Try to infer structure from generic JSON and convert
 * @param {Object} data - Generic JSON data
 * @returns {Object} Internal format data
 */
const inferAndConvert = (data) => {
    // This is a fallback for generic JSON structures
    // Try to find arrays that might represent nodes/vertices and edges

    const result = {
        database: {
            name: "inferred_hypergraph",
            vertices: 0,
            edges: 0
        },
        vertices: [],
        graphs: {}
    };

    // Look for node-like arrays
    const potentialNodes = Object.values(data).find(value =>
        Array.isArray(value) && value.length > 0 &&
        (value[0].id || value[0].name || value[0].node_id)
    );

    if (potentialNodes) {
        result.vertices = potentialNodes.map((node, index) => ({
            id: node.id || node.name || node.node_id || `node_${index}`,
            description: node.description || node.label || "",
            degree: node.degree || node.connections?.length || 0,
            entity_name: node.name || node.id || `node_${index}`,
            additional_properties: ""
        }));
    }

    // Look for edge-like arrays
    const potentialEdges = Object.values(data).find(value =>
        Array.isArray(value) && value.length > 0 &&
        (value[0].source || value[0].from || value[0].nodes)
    );

    if (potentialEdges) {
        // Build basic graph structure
        const graphsMap = {};

        potentialEdges.forEach(edge => {
            const nodeIds = edge.nodes || [edge.source || edge.from, edge.target || edge.to].filter(Boolean);

            if (nodeIds && nodeIds.length > 0) {
                nodeIds.forEach(nodeId => {
                    if (!graphsMap[nodeId]) {
                        graphsMap[nodeId] = {
                            vertices: {},
                            edges: {}
                        };
                    }

                    // Add connected vertices
                    nodeIds.forEach(connectedId => {
                        const vertex = result.vertices.find(v => v.id === connectedId);
                        if (vertex) {
                            graphsMap[nodeId].vertices[connectedId] = vertex;
                        }
                    });

                    // Add edge
                    const edgeKey = nodeIds.join('|||');
                    graphsMap[nodeId].edges[edgeKey] = {
                        weight: edge.weight || 1,
                        type: edge.type || "default",
                        properties: {}
                    };
                });
            }
        });

        result.graphs = graphsMap;
    }

    result.database.vertices = result.vertices.length;
    result.database.edges = potentialEdges ? potentialEdges.length : 0;

    return result;
};

/**
 * Parse custom HIF text format (if needed)
 * @param {string} content - HIF text content
 * @returns {Object} Internal format data
 */
const parseCustomHIFFormat = (content) => {
    // This would be implemented if there's a specific text-based HIF format
    // For now, just throw an error
    throw new Error("Custom HIF text format parsing not implemented");
};

/**
 * Validate parsed data structure
 * @param {Object} data - Parsed data
 * @returns {boolean} True if valid
 */
export const validateHIFData = (data) => {
    if (!data || typeof data !== 'object') {
        return false;
    }

    // Check required structure
    if (!data.database || !data.vertices || !data.graphs) {
        return false;
    }

    // Check database info
    if (!data.database.name || typeof data.database.vertices !== 'number') {
        return false;
    }

    // Check vertices array
    if (!Array.isArray(data.vertices)) {
        return false;
    }

    // Check graphs object
    if (typeof data.graphs !== 'object') {
        return false;
    }

    return true;
};

/**
 * Load and parse HIF from URL
 * @param {string} url - URL to fetch HIF data from
 * @returns {Promise<Object>} Parsed data
 */
export const loadHIFFromURL = async (url) => {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, */*',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const content = await response.text();
        const filename = url.split('/').pop() || 'remote_file';

        return await parseHIF(content, filename);
    } catch (error) {
        throw new Error(`Failed to load remote HIF file: ${error.message}`);
    }
};

/**
 * Load and parse HIF from File object
 * @param {File} file - File object
 * @returns {Promise<Object>} Parsed data
 */
export const loadHIFFromFile = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const content = e.target.result;
                const data = await parseHIF(content, file.name);
                resolve(data);
            } catch (error) {
                reject(new Error(`Failed to parse file: ${error.message}`));
            }
        };

        reader.onerror = () => {
            reject(new Error('File reading failed'));
        };

        reader.readAsText(file);
    });
};

