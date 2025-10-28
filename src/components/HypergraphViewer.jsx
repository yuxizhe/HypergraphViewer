import React, { useState, useEffect, useMemo, useRef } from 'react';
import { generateEntityTypeColors } from '../constants.js';
import { fetchDatabaseInfo, fetchVertices, fetchGraphData, dataSourceManager } from '../api.js';
import { processGraphData } from '../dataProcessor.js';
import Sidebar from './Sidebar.jsx';
import GraphContainer from './GraphContainer.jsx';
import DetailsPanel from './DetailsPanel.jsx';

export default function HypergraphViewer() {
    const searchTimeoutRef = useRef(null);

    const [databaseInfo, setDatabaseInfo] = useState({
        vertices: 0,
        edges: 0,
    });
    const [vertices, setVertices] = useState([]);
    const [pagination, setPagination] = useState({
        page: 1,
        page_size: 50,
        total: 0,
        total_pages: 0,
    });
    const [selectedVertex, setSelectedVertex] = useState("");
    const [graphData, setGraphData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingVertices, setLoadingVertices] = useState(false);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState("degree");
    const [sortOrder, setSortOrder] = useState("desc");
    const [visualizationMode, setVisualizationMode] = useState("hyper");
    const [hoverHyperedge, setHoverHyperedge] = useState(null);
    const [hoverNode, setHoverNode] = useState(null);
    const [currentDataSource, setCurrentDataSource] = useState({ type: 'static' });
    const [dataSourceLoading, setDataSourceLoading] = useState(false);
    const [dataSourceError, setDataSourceError] = useState("");

    // Generate entity type color mapping
    const entityTypeColors = useMemo(() => {
        return generateEntityTypeColors(vertices);
    }, [vertices]);

    // Handle data source change
    const handleDataSourceChange = async (newSource) => {
        setDataSourceLoading(true);
        setDataSourceError("");

        try {
            const result = await dataSourceManager.setDataSource(newSource);

            if (result.success) {
                setCurrentDataSource(newSource);

                // Refresh all data after successful data source change
                const dbInfo = await fetchDatabaseInfo();
                setDatabaseInfo(dbInfo);

                // Reload vertices with current search/sort settings
                await loadVertices(1, searchTerm, sortBy, sortOrder);

                // Clear selected vertex since the data might have changed
                setSelectedVertex(result.data[0].id);
                // setGraphData(null);
            } else {
                setDataSourceError(result.error);
            }
        } catch (error) {
            console.error("Data source switch failed:", error);
            setDataSourceError(error.message);
        } finally {
            setDataSourceLoading(false);
        }
    };

    // Load database info
    useEffect(() => {
        fetchDatabaseInfo().then(setDatabaseInfo).catch(console.error);
    }, []);

    // Load vertices list
    const loadVertices = async (page, search, sortBy, sortOrder) => {
        setLoadingVertices(true);
        try {
            const result = await fetchVertices(
                page,
                pagination.page_size,
                search,
                sortBy,
                sortOrder
            );
            setVertices(result.data);
            setPagination(result.pagination);

            // If no vertex selected and data exists, select the first one
            if (result.data.length > 0) {
                setSelectedVertex(result.data[0].id);
            }
        } catch (err) {
            console.error("Failed to load vertices:", err);
        } finally {
            setLoadingVertices(false);
        }
    };

    // Initial load of vertices
    useEffect(() => {
        loadVertices(1, "", sortBy, sortOrder);
    }, []);

    // Search debounce
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            loadVertices(1, searchTerm, sortBy, sortOrder);
        }, 300);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchTerm]);

    // Reload when sort changes
    useEffect(() => {
        if (vertices.length > 0) {
            loadVertices(pagination.page, searchTerm, sortBy, sortOrder);
        }
    }, [sortBy, sortOrder]);

    // Load when page changes
    const handlePageChange = (newPage) => {
        loadVertices(newPage, searchTerm, sortBy, sortOrder);
    };

    // Load graph data
    useEffect(() => {
        if (selectedVertex) {
            setLoading(true);
            setError("");

            fetchGraphData(selectedVertex)
                .then((data) => {
                    if (data.error) {
                        setError(data.error);
                    } else {
                        setGraphData(data);
                    }
                })
                .catch((err) => {
                    setError("Failed to load graph data");
                    console.error(err);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [selectedVertex]);

    // Convert data to G6 Graph format
    const graphDataFormatted = useMemo(() => {
        return processGraphData(graphData, selectedVertex, visualizationMode, entityTypeColors);
    }, [graphData, selectedVertex, visualizationMode, entityTypeColors]);

    // Select the "largest" node and hyperedges by default
    useEffect(() => {
        if (!graphDataFormatted) return;

        const nodes = graphDataFormatted.data.nodes;
        if (!hoverNode && nodes.length > 0) {
            const nodeWithMax = nodes.reduce((best, cur) =>
                (cur.degree || 0) > (best.degree || 0) ? cur : best
            );
            setHoverNode(nodeWithMax);
        }

        if (visualizationMode === "hyper") {
            const hyperEdges = graphDataFormatted.data.hyperEdges;
            if (!hoverHyperedge && hyperEdges.length > 0) {
                const getWeight = (edge) =>
                    edge.weight || edge.members?.length || 0;
                const hyperWithMax = hyperEdges.reduce((best, cur) =>
                    getWeight(cur) > getWeight(best) ? cur : best
                );

                setHoverHyperedge({
                    keywords: hyperWithMax.keywords || "",
                    description:
                        hyperWithMax.description || hyperWithMax.summary || "",
                    members: hyperWithMax.members || [],
                    weight: getWeight(hyperWithMax),
                });
            }
        }
    }, [graphDataFormatted, visualizationMode, hoverNode, hoverHyperedge]);

    return (
        <div className="flex h-screen bg-linear-to-br from-gray-50 to-gray-100">
            {/* Sidebar with integrated Data Source Selector */}
            <Sidebar
                databaseInfo={databaseInfo}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                vertices={vertices}
                loadingVertices={loadingVertices || dataSourceLoading}
                selectedVertex={selectedVertex}
                setSelectedVertex={setSelectedVertex}
                pagination={pagination}
                handlePageChange={handlePageChange}
                // Data source props
                onDataSourceChange={handleDataSourceChange}
                currentDataSource={currentDataSource}
                dataSourceLoading={dataSourceLoading}
                dataSourceError={dataSourceError}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-white/10 backdrop-blur-sm">
                <div className="bg-white/95 p-4 border-b border-gray-200/50 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-4">
                        <h3 className="text-xl font-semibold text-gray-800 m-0">
                            {visualizationMode === "hyper" ? "Hypergraph" : "Graph"}{" "}
                            Visualization {selectedVertex && `- ${selectedVertex}`}
                        </h3>

                        {/* Visualization Mode Selector */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Mode:</span>
                            <div className="flex space-x-1">
                                {["hyper", "graph"].map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => setVisualizationMode(mode)}
                                        className={`px-3 py-1 text-xs rounded-full transition-all duration-200 ${visualizationMode === mode
                                            ? "bg-primary-500 text-white shadow-md"
                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                            }`}
                                    >
                                        {mode === "hyper" ? "Hypergraph" : "Graph"}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {graphData && (
                        <div className="bg-white px-4 py-2 text-sm text-gray-600 rounded-lg shadow-sm border border-gray-200">
                            <span className="font-semibold">Vertices:</span>{" "}
                            {Object.keys(graphData.vertices).length} |
                            <span className="font-semibold ml-1">
                                {visualizationMode === "hyper" ? "Hyperedges:" : "Edges:"}
                            </span>{" "}
                            {visualizationMode === "hyper"
                                ? Object.keys(graphData.edges).length
                                : graphDataFormatted?.data?.edges?.length || 0}
                        </div>
                    )}
                </div>

                <div className="flex-1 relative bg-white">
                    {error && (
                        <div className="bg-red-50 text-red-700 p-4 m-4 rounded-lg border-l-4 border-red-500 shadow-sm">
                            <div className="flex items-center">
                                <span className="text-xl mr-2">⚠️</span>
                                <span className="font-medium">{error}</span>
                            </div>
                        </div>
                    )}

                    {loading && (
                        <div className="absolute inset-0 flex justify-center items-center bg-white/80 backdrop-blur-sm z-50 text-lg text-gray-600">
                            <div className="text-center">
                                <div className="text-2xl mb-4">🔄</div>
                                <div className="font-semibold">
                                    Loading hypergraph data...
                                </div>
                                <div className="text-sm mt-2 text-gray-500">
                                    This may take a few seconds
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex h-[calc(100vh-71px)]">
                        <GraphContainer
                            graphDataFormatted={graphDataFormatted}
                            visualizationMode={visualizationMode}
                            setHoverHyperedge={setHoverHyperedge}
                            setHoverNode={setHoverNode}
                        />
                        {visualizationMode === "hyper" && (
                            <DetailsPanel
                                hoverHyperedge={hoverHyperedge}
                                hoverNode={hoverNode}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}