import React from 'react';
import { EXCLUDED_KEYS } from '../constants.js';

const DetailsPanel = ({ hoverHyperedge, hoverNode }) => {
    return (
        <div className="shrink-0 w-72 h-full overflow-y-auto bg-white/95 backdrop-blur-sm border-l border-gray-200/50 p-3 shadow-xl">
            <div className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b-2 border-primary-500">
                Hypergraph Detail
            </div>
            {hoverHyperedge && (
                <div className="text-sm text-gray-700 space-y-3 border-b-2 border-primary-500 pb-6">
                    <div className="text-base font-semibold text-gray-900">
                        Hyperedge
                    </div>
                    {Object.entries(hoverHyperedge).map(([key, value]) => {
                        // Skip empty values
                        if (
                            !value ||
                            (Array.isArray(value) && value.length === 0) ||
                            EXCLUDED_KEYS.has(key)
                        ) {
                            return null;
                        }

                        // Special handling for keywords
                        if (key === "keywords" && typeof value === "string") {
                            return (
                                <div key={key}>
                                    <span className="font-medium">keywords:</span>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {value
                                            .split(/,|，|、|。|<SEP>/)
                                            .filter((k) => k.trim())
                                            .map((keyword, i) => (
                                                <span
                                                    key={i}
                                                    className="inline-block p-1 bg-primary-50 rounded text-xs"
                                                >
                                                    {keyword.trim()}
                                                </span>
                                            ))}
                                    </div>
                                </div>
                            );
                        }

                        // Special handling for members
                        if (Array.isArray(value)) {
                            return (
                                <div key={key}>
                                    <div className="font-medium">
                                        {key} ({value.length}):
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {value.map((member, i) => (
                                            <span
                                                key={i}
                                                className="p-1 bg-primary-50 rounded text-xs"
                                            >
                                                {member}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        }

                        // Convert value to string for length check
                        const stringValue =
                            typeof value === "object"
                                ? JSON.stringify(value, null, 2)
                                : String(value).replace(/<SEP>/g, " | ");

                        // If value is less than 10 characters, display as tag
                        if (stringValue.length < 20) {
                            return (
                                <div key={key}>
                                    <span className="font-medium">{key}:</span>
                                    <div className="mt-1">
                                        <span className="inline-block px-2 py-1 bg-gray-100 rounded text-xs">
                                            {stringValue}
                                        </span>
                                    </div>
                                </div>
                            );
                        }

                        // Default handling for longer values
                        return (
                            <div key={key}>
                                <span className="font-medium">{key}:</span>
                                <div className="mt-1 text-gray-600 bg-gray-100 p-2 rounded text-xs">
                                    {stringValue}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {hoverNode && (
                <div className="text-sm text-gray-700 space-y-3 mt-4">
                    <div className="text-base font-semibold text-gray-900">
                        Node
                    </div>
                    {Object.entries(hoverNode).map(([key, value]) => {
                        // Skip empty values
                        if (
                            !value ||
                            (Array.isArray(value) && value.length === 0) ||
                            EXCLUDED_KEYS.has(key)
                        ) {
                            return null;
                        }

                        // Convert value to string for length check
                        const stringValue =
                            typeof value === "object"
                                ? JSON.stringify(value, null, 2)
                                : String(value).replace(/<SEP>/g, " | ");

                        // If value is less than 10 characters, display as tag
                        if (stringValue.length < 20) {
                            return (
                                <div key={key}>
                                    <span className="font-medium">{key}:</span>
                                    <div className="mt-1">
                                        <span className="inline-block px-2 py-1 bg-gray-100 rounded text-xs">
                                            {stringValue}
                                        </span>
                                    </div>
                                </div>
                            );
                        }

                        // Default handling for longer values
                        return (
                            <div key={key}>
                                <span className="font-medium">{key}:</span>
                                <div className="mt-1 text-gray-600 bg-gray-100 p-2 rounded text-xs">
                                    {stringValue}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default DetailsPanel;
