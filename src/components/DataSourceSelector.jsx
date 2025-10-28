import React, { useState } from 'react';

export default function DataSourceSelector({ onDataSourceChange, currentSource, loading }) {
    const [sourceType, setSourceType] = useState(currentSource?.type || 'static');
    const [url, setUrl] = useState(currentSource?.url || 'https://yuxizhe.github.io/HypergraphViewer/publications_main_component.hif.json');
    const [file, setFile] = useState(null);

    const handleSourceTypeChange = (type) => {
        setSourceType(type);
        if (type === 'static') {
            onDataSourceChange({ type: 'static' });
        }
    };

    const handleUrlSubmit = (e) => {
        e.preventDefault();
        if (url.trim()) {
            onDataSourceChange({ type: 'remote', url: url.trim() });
        }
    };

    const handleFileUpload = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            onDataSourceChange({ type: 'file', file: selectedFile });
        }
    };

    return (
        <div className="mb-6">
            <div className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b-2 border-primary-500">
                Data Source
            </div>

            <div className="space-y-4">
                {/* Static Data Option */}
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                        type="radio"
                        name="dataSource"
                        value="static"
                        checked={sourceType === 'static'}
                        onChange={() => handleSourceTypeChange('static')}
                        className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Use Default Data</span>
                </label>

                {/* Remote URL Option */}
                <div className="space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                            type="radio"
                            name="dataSource"
                            value="remote"
                            checked={sourceType === 'remote'}
                            onChange={() => handleSourceTypeChange('remote')}
                            className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Remote HIF URL</span>
                    </label>

                    {sourceType === 'remote' && (
                        <form onSubmit={handleUrlSubmit} className="space-y-2">
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="Enter HIF file URL"
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                                disabled={loading}
                            />
                            <button
                                type="submit"
                                disabled={!url.trim() || loading}
                                className="px-3 py-1 bg-primary-500 text-white text-sm rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-primary-600 transition-all duration-200"
                            >
                                {loading ? 'Loading...' : 'Load'}
                            </button>
                        </form>
                    )}
                </div>

                {/* Local File Option */}
                <div className="space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                            type="radio"
                            name="dataSource"
                            value="file"
                            checked={sourceType === 'file'}
                            onChange={() => handleSourceTypeChange('file')}
                            className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Upload HIF File</span>
                    </label>

                    {sourceType === 'file' && (
                        <div className="">
                            <input
                                type="file"
                                accept=".hif,.json"
                                onChange={handleFileUpload}
                                disabled={loading}
                                className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                            />
                            {/* {file && (
                                <p className="text-xs text-gray-600 mt-1">
                                    Selected: {file.name}
                                </p>
                            )} */}
                        </div>
                    )}
                </div>

                {/* Current Source Info */}
                {/* {currentSource && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-xl border text-sm">
                        <p className="text-gray-600">
                            <span className="font-semibold">Current source:</span>
                            {currentSource.type === 'static' && ' Default data'}
                            {currentSource.type === 'remote' && ` Remote URL - ${currentSource.url}`}
                            {currentSource.type === 'file' && ` Local file - ${currentSource.file?.name}`}
                        </p>
                    </div>
                )} */}
            </div>
        </div>
    );
}

