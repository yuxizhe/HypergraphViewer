import React from 'react';
import { formatDescription } from '../utils.js';
import DataSourceSelector from './DataSourceSelector.jsx';

const Sidebar = ({
    databaseInfo,
    searchTerm,
    setSearchTerm,
    vertices,
    loadingVertices,
    selectedVertex,
    setSelectedVertex,
    pagination,
    handlePageChange,
    // Data source props
    onDataSourceChange,
    currentDataSource,
    dataSourceLoading,
    dataSourceError
}) => {
    return (
        <div className="w-80 h-screen p-6 overflow-hidden bg-white/95 backdrop-blur-sm border-r border-gray-200/50 shadow-xl shrink-0 flex flex-col">

            {/* Main Sidebar Content */}

            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                Hypergraph-Viewer
            </h2>

            {/* Data Source Selector */}
            <DataSourceSelector
                onDataSourceChange={onDataSourceChange}
                currentSource={currentDataSource}
                loading={dataSourceLoading}
            />

            {/* Error Message */}
            {/* {dataSourceError && (
                    <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-600">{dataSourceError}</p>
                    </div>
                )} */}

            <div className='flex-1 overflow-scroll hide-scrollbar'>

                <div className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b-2 border-primary-500">
                    Database Information
                </div>
                <div className="p-2 rounded-xl mb-6 text-sm border">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-gray-700">Vertices:</span>
                        <span className="font-bold text-primary-600">
                            {databaseInfo.vertices}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-700">
                            Hyperedges:
                        </span>
                        <span className="font-bold text-primary-600">
                            {databaseInfo.edges}
                        </span>
                    </div>
                </div>

                <div className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b-2 border-primary-500">
                    Search & Vertex List
                </div>

                {/* Search and Sort */}
                <div className="mb-4">
                    <div className="relative mb-2">
                        <input
                            type="text"
                            placeholder="Search vertex ID, type or description..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 pl-10 pr-4 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg
                                className="h-4 w-4 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                        </div>
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm("")}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                            >
                                <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        )}
                    </div>

                    <div className="mt-2 text-sm text-gray-600">
                        Found {pagination.total} results
                    </div>
                </div>

                {/* Vertices List */}
                <div className="flex-1  border border-gray-200 rounded-xl bg-white shadow-inner">
                    {loadingVertices ? (
                        <div className="p-4 text-center text-gray-500">
                            Loading vertices...
                        </div>
                    ) : vertices.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                            No matching vertices found
                        </div>
                    ) : (
                        vertices.map((vertex) => {
                            const isSelected = selectedVertex === vertex.id;

                            return (
                                <div
                                    key={vertex.id}
                                    className={`p-2 border-b border-gray-100 cursor-pointer transition-all duration-200 hover:bg-gray-50 hover:shadow-sm ${isSelected
                                        ? "bg-primary-50 border-l-4 border-l-primary-500 shadow-md"
                                        : ""
                                        }`}
                                    onClick={() => setSelectedVertex(vertex.id)}
                                >
                                    <div className="font-bold text-gray-800 mb-2 flex items-center">
                                        {vertex.id}
                                    </div>
                                    <div className="text-sm text-gray-600 flex gap-2 items-center">
                                        <div className="flex items-center">
                                            <span className="font-medium">
                                                {vertex.entity_type ? "Type" : "ID"}:
                                            </span>
                                            <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs">
                                                {vertex.entity_type || vertex.id}
                                            </span>
                                        </div>
                                        <div className="flex items-center">
                                            <span className="font-medium">Degree:</span>
                                            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                                                {vertex.degree}
                                            </span>
                                        </div>
                                    </div>
                                    {vertex.description && (
                                        <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                                            {formatDescription(vertex.description)}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Pagination Controls */}
                {pagination.total_pages > 1 && (
                    <div className="mt-4 flex items-center justify-between text-sm">
                        <button
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={pagination.page === 1}
                            className="px-3 py-1 bg-primary-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-primary-600"
                        >
                            Previous
                        </button>
                        <span className="text-gray-600">
                            {pagination.page} / {pagination.total_pages}
                        </span>
                        <button
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={pagination.page === pagination.total_pages}
                            className="px-3 py-1 bg-primary-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-primary-600"
                        >
                            Next
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default Sidebar;
