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
        if (data.hypergraph || data.nodes || data.edges || data.hyperedges) {
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
    let incidences = hifData.incidences || [];

    // Convert nodes to vertices
    if (Array.isArray(nodes)) {
        result.vertices = nodes.map(node => ({
            id: node.id || node.name || node.node,

            description: node.description || node.label || "",
            degree: node.degree || 0,
            entity_name: node.name || node.id || node.node,
            ...node.properties,
        }));
    } else if (typeof nodes === 'object') {
        result.vertices = Object.entries(nodes).map(([id, node]) => ({
            id,

            description: node.description || node.label || "",
            degree: node.degree || 0,
            entity_name: node.name || node.id || id,
            ...node.properties,
        }));
    }

    // Build graphs from edges and incidences
    const graphsMap = {};
    let edgeGroups = {};

    // Process incidences if available
    if (Array.isArray(incidences) && incidences.length > 0) {
        // Group incidences by edge
        incidences.forEach(incidence => {
            const edgeName = incidence.edge;
            if (!edgeGroups[edgeName]) {
                edgeGroups[edgeName] = [];
            }
            edgeGroups[edgeName].push(incidence.node);
        });

        // Build graphs from incidence groups
        Object.entries(edgeGroups).forEach(([edgeName, nodeIds]) => {
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
                const edgeKey = nodeIds.join('|#|');
                graphsMap[nodeId].edges[edgeKey] = {
                    weight: 1,
                    type: "hyperedge",
                    edgeName,
                    // 罗列其他属性
                    ...incidences.find(incidence => incidence.node === nodeId).attrs

                };
            });
        });
    } else if (Array.isArray(edges)) {
        // Fallback to traditional edge processing
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
    result.database.edges = incidences.length > 0 ?
        Object.keys(edgeGroups || {}).length :
        (Array.isArray(edges) ? edges.length : 0);

    return result;
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

