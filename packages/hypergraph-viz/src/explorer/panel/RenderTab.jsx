import React from 'react';
import { useI18n } from '../i18n.jsx';

const Tag = ({ relayout }) => {
    const { t } = useI18n();
    return (
        <span className={`ml-1 px-1 rounded text-[10px] ${relayout ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
            {t(relayout ? "tagRelayout" : "tagRestyle")}
        </span>
    );
};

const Row = ({ label, relayout, disabled, children }) => (
    <div className={`flex items-center justify-between gap-2 py-1 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
        <span className="text-xs text-gray-700 shrink-0">
            {label}
            <Tag relayout={relayout} />
        </span>
        <span className="flex items-center gap-1 min-w-0">{children}</span>
    </div>
);

const Segmented = ({ value, options, onChange }) => (
    <span className="inline-flex rounded-md border border-gray-200 overflow-hidden text-[11px]">
        {options.map(([v, label]) => (
            <button
                key={v}
                onClick={() => onChange(v)}
                className={`px-2 py-0.5 ${value === v ? "bg-primary-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
                {label}
            </button>
        ))}
    </span>
);

const Switch = ({ checked, onChange }) => (
    <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-8 h-4 rounded-full relative transition-colors ${checked ? "bg-primary-500" : "bg-gray-300"}`}
    >
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${checked ? "left-4.5" : "left-0.5"}`} />
    </button>
);

const Slider = ({ value, min, max, step = 1, onChange, format = (v) => v }) => (
    <>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-24 accent-primary-500"
        />
        <span className="w-8 text-right text-[11px] tabular-nums text-gray-600">{format(value)}</span>
    </>
);

const Group = ({ title, children }) => (
    <div>
        <div className="text-xs font-semibold text-gray-800 mb-1 pb-1 border-b border-gray-100">{title}</div>
        {children}
    </div>
);

// 渲染设置：布局、超边轮廓、节点、标签。每项标明改动后是重新布局还是只重绘
const RenderTab = ({ settings, setSettings, mode, hasCenter, onResetSettings, onResetColors }) => {
    const { t } = useI18n();
    const set = (key) => (value) => setSettings((s) => ({ ...s, [key]: value }));
    const isHyper = mode === "hyper";
    const isMatrix = mode === "matrix";
    // 多边形布局也以超图布局为起点，节点间距、中心实体同样生效
    const hypergraphLayout = isHyper && (settings.layout === "hypergraph" || settings.layout === "polygon");
    const polygon = isHyper && settings.layout === "polygon";
    // 超边颜色用于轮廓、超边节点（图模式 star）和矩阵的列
    const hyperedgeColored = isMatrix || (isHyper ? settings.contours : settings.graphEdges === "star");

    return (
        <div className="space-y-4">
            {isMatrix && (
                <Group title={t("groupMatrix")}>
                    <Row label={t("matrixOrder")} relayout>
                        <Segmented
                            value={settings.matrixOrder}
                            onChange={set("matrixOrder")}
                            options={[["degree", t("orderDegree")], ["type", t("orderType")], ["cluster", t("orderCluster")]]}
                        />
                    </Row>
                    <div className="text-[11px] text-gray-400">{t("matrixHint")}</div>
                </Group>
            )}

            <Group title={t("groupLayout")}>
                <Row label={t("layoutAlgorithm")} relayout disabled={isMatrix}>
                    <select
                        value={!isHyper && (settings.layout === "hypergraph" || settings.layout === "polygon") ? "force" : settings.layout}
                        onChange={(e) => set("layout")(e.target.value)}
                        className="text-xs border-gray-300 rounded-md py-0.5 pl-2 pr-7"
                    >
                        {isHyper && <option value="hypergraph">{t("layoutHypergraph")}</option>}
                        {isHyper && <option value="polygon">{t("layoutPolygon")}</option>}
                        <option value="force">{t("layoutForce")}</option>
                        <option value="force-atlas2">ForceAtlas2</option>
                        <option value="circular">{t("layoutCircular")}</option>
                    </select>
                </Row>
                <Row label={t("useCenter")} relayout disabled={!hypergraphLayout || !hasCenter}>
                    <Switch checked={settings.useCenter} onChange={set("useCenter")} />
                </Row>
                <Row label={t("nodeSpacing")} relayout disabled={!hypergraphLayout}>
                    <Slider value={settings.nodeSpacing} min={10} max={100} step={5} onChange={set("nodeSpacing")} />
                </Row>
                <Row label={t("maxFitZoom")} disabled={isMatrix}>
                    <span title={t("maxFitZoomHint")} className="flex items-center">
                        <Slider
                            value={settings.maxFitZoom}
                            min={0.5}
                            max={3}
                            step={0.25}
                            onChange={set("maxFitZoom")}
                            format={(v) => `${v}×`}
                        />
                    </span>
                </Row>
                <Row label={t("graphEdges")} relayout disabled={mode !== "graph"}>
                    <Segmented
                        value={settings.graphEdges}
                        onChange={set("graphEdges")}
                        options={[
                            ["star", t("graphEdgesStar")],
                            ["binary", t("graphEdgesBinary")],
                            ["clique", t("graphEdgesClique")],
                        ]}
                    />
                </Row>
                {isHyper && settings.layout === "force" && (
                    <div className="text-[11px] text-gray-400">{t("forceHint")}</div>
                )}
                {polygon && <div className="text-[11px] text-gray-400">{t("polygonHint")}</div>}
            </Group>

            <Group title={t("groupHyperedge")}>
                <Row label={t("showContours")} disabled={!isHyper}>
                    <Switch checked={settings.contours} onChange={set("contours")} />
                </Row>
                <Row label={t("contourBounds")} disabled={!isHyper || !settings.contours || polygon}>
                    <Segmented
                        value={settings.contourBounds}
                        onChange={set("contourBounds")}
                        options={[["key", t("boundsKey")], ["render", t("boundsRender")]]}
                    />
                </Row>
                <Row label={t("contourNesting")} disabled={!isHyper || !settings.contours || polygon}>
                    <span title={t("contourNestingHint")}>
                        <Switch checked={settings.contourNesting} onChange={set("contourNesting")} />
                    </span>
                </Row>
                <Row label={t("hyperedgeColorBy")} disabled={!hyperedgeColored}>
                    <Segmented
                        value={settings.hyperedgeColorBy}
                        onChange={set("hyperedgeColorBy")}
                        options={[["hyperedge", t("byHyperedge")], ["type", t("byHyperedgeType")]]}
                    />
                </Row>
                <Row label={t("fillOpacity")} disabled={!isHyper || !settings.contours}>
                    <Slider
                        value={settings.fillOpacity}
                        min={0}
                        max={0.6}
                        step={0.05}
                        onChange={set("fillOpacity")}
                        format={(v) => v.toFixed(2)}
                    />
                </Row>
            </Group>

            <Group title={t("groupNode")}>
                <Row label={t("nodeColorBy")}>
                    <Segmented
                        value={settings.nodeColorBy}
                        onChange={set("nodeColorBy")}
                        options={[["type", t("byType")], ["uniform", t("uniform")]]}
                    />
                </Row>
                <Row label={t("nodeSizeBy")} relayout disabled={isMatrix}>
                    <Segmented
                        value={settings.nodeSizeBy}
                        onChange={set("nodeSizeBy")}
                        options={[["fixed", t("sizeFixed")], ["degree", t("sizeDegree")]]}
                    />
                </Row>
                <Row label={t("autoHideBy")} relayout>
                    <span title={t("autoHideByHint")}>
                        <Segmented
                            value={settings.autoHideBy}
                            onChange={set("autoHideBy")}
                            options={[["overlap", t("autoHideOverlap")], ["degree", t("autoHideByDegree")], ["off", t("autoHideOff")]]}
                        />
                    </span>
                </Row>
                <Row label={t("autoHideDegree")} relayout disabled={settings.autoHideBy !== "degree"}>
                    <input
                        type="number"
                        min={0}
                        value={settings.autoHideDegree}
                        onChange={(e) => set("autoHideDegree")(Math.max(0, Number(e.target.value) || 0))}
                        title={t("autoHideDegreeHint")}
                        className="w-14 px-1 py-0.5 text-[11px] text-right tabular-nums border border-gray-200 rounded"
                    />
                </Row>
            </Group>

            {!isMatrix && (
                <Group title={t("groupLabel")}>
                    <Row label={t("labelMode")} relayout={settings.labelOverlap === "layout" && hypergraphLayout}>
                        <Segmented
                            value={settings.labelMode}
                            onChange={set("labelMode")}
                            options={[["all", t("labelAll")], ["key", t("labelKey")], ["none", t("labelNone")]]}
                        />
                    </Row>
                    <Row label={t("labelBy")} relayout={settings.labelOverlap === "layout" && hypergraphLayout} disabled={settings.labelMode === "none"}>
                        <Segmented
                            value={settings.labelBy}
                            onChange={set("labelBy")}
                            options={[["uniform", t("labelUniform")], ["degree", t("labelByDegree")]]}
                        />
                    </Row>
                    <Row label={t("labelFontSize")} relayout>
                        <Slider value={settings.labelFontSize} min={8} max={16} onChange={set("labelFontSize")} />
                    </Row>
                    <Row label={t("labelOverlap")} relayout={settings.labelOverlap === "layout" && hypergraphLayout} disabled={settings.labelMode === "none"}>
                        <Segmented
                            value={settings.labelOverlap}
                            onChange={set("labelOverlap")}
                            options={[
                                ["hide", t("labelOverlapHide")],
                                ...(hypergraphLayout ? [["layout", t("labelOverlapLayout")]] : []),
                                ["allow", t("labelOverlapAllow")],
                            ]}
                        />
                    </Row>
                    <Row label={t("labelStripType")} relayout disabled={settings.labelMode === "none"}>
                        <span title={t("labelStripTypeHint")}>
                            <Switch checked={settings.labelStripType} onChange={set("labelStripType")} />
                        </span>
                    </Row>
                    <Row label={t("labelMaxLength")} relayout disabled={settings.labelMode === "none"}>
                        <input
                            type="number"
                            min={0}
                            value={settings.labelMaxLength}
                            onChange={(e) => set("labelMaxLength")(Math.max(0, Number(e.target.value) || 0))}
                            title={t("labelMaxLengthHint")}
                            className="w-14 px-1 py-0.5 text-[11px] text-right tabular-nums border border-gray-200 rounded"
                        />
                    </Row>
                </Group>
            )}

            <div className="flex gap-2 pt-1">
                <button className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50" onClick={onResetSettings}>
                    {t("resetSettings")}
                </button>
                <button className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50" onClick={onResetColors}>
                    {t("resetColors")}
                </button>
            </div>
        </div>
    );
};

export default RenderTab;
