import React from 'react';
import { EXCLUDED_KEYS } from '../constants.js';
import { useI18n } from '../i18n.jsx';

const PropertyRow = ({ name, value }) => {
    // Special handling for keywords
    if (name === "keywords" && typeof value === "string") {
        return (
            <div>
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
            <div>
                <div className="font-medium">
                    {name} ({value.length}):
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

    // Short values are displayed as tags
    if (stringValue.length < 20) {
        return (
            <div>
                <span className="font-medium">{name}:</span>
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
        <div>
            <span className="font-medium">{name}:</span>
            <div className="mt-1 text-gray-600 bg-gray-100 p-2 rounded text-xs">
                {stringValue}
            </div>
        </div>
    );
};

// 按属性自动渲染超边 / 顶点；侧边栏与悬停卡片（HoverTip）共用。
// priority 中的字段排在最前（默认 description），其余按原顺序；exclude 额外不显示的属性；limit 限制显示的属性个数
export const PropertyList = ({ item, priority = ["description"], exclude = [], limit = Infinity }) => {
    const rank = (k) => (priority.includes(k) ? priority.indexOf(k) : priority.length);
    return Object.entries(item)
        .filter(
            ([key, value]) =>
                value &&
                !(Array.isArray(value) && value.length === 0) &&
                !EXCLUDED_KEYS.has(key) &&
                !exclude.includes(key)
        )
        .sort(([a], [b]) => rank(a) - rank(b))
        .slice(0, limit)
        .map(([key, value]) => <PropertyRow key={key} name={key} value={value} />);
};

// 最后悬停 / 点选的超边与实体属性；放在右侧面板下部，不随 Tab 切换消失
const DetailsPanel = ({ hoverHyperedge, hoverNode }) => {
    const { t } = useI18n();
    return (
        <>
            {hoverHyperedge && (
                <div className="text-sm text-gray-700 space-y-3 border-b-2 border-primary-500 pb-4">
                    <div className="text-base font-semibold text-gray-900">
                        {t(hoverHyperedge.members?.length === 2 ? "edge" : "hyperedge")}
                    </div>
                    <PropertyList item={hoverHyperedge} />
                </div>
            )}
            {hoverNode && (
                <div className="text-sm text-gray-700 space-y-3 mt-4">
                    <div className="text-base font-semibold text-gray-900">
                        {t("node")}
                    </div>
                    <PropertyList item={hoverNode} />
                </div>
            )}
        </>
    );
};

export default DetailsPanel;
