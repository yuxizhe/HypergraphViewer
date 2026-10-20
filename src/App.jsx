import { useEffect, useMemo, useState } from 'react';
import { createLocalSource, HypergraphExplorer, Section } from 'hypergraph-viz/explorer';
import DataSourceSelector from './components/DataSourceSelector.jsx';
import { loadDataSource } from './api.js';
import { APP_MESSAGES, applyLang, detectLang } from './i18n.js';
import { DATASETS, initialSource, rememberSource } from './datasets.js';

// 左栏顶部的数据源卡片：示例数据集、远程 .hgdb / HIF、上传文件；加载失败时展开并显示错误
const SourceSection = ({ current, loading, error, onChange, lang }) => {
    const [open, setOpen] = useState(true);
    const label =
        current.type === "static"
            ? DATASETS.find((d) => d.id === current.dataset)?.name[lang]
            : current.type === "remote"
                ? current.url
                : current.file?.name;
    return (
        <Section title={APP_MESSAGES[lang].dataSource} subtitle={label} open={open || !!error} onToggle={() => setOpen((o) => !o)}>
            <DataSourceSelector onDataSourceChange={onChange} currentSource={current} loading={loading} hideTitle />
            {error && <div className="mt-2 p-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md">{error}</div>}
        </Section>
    );
};

function App() {
    const [lang, setLang] = useState(detectLang);
    useEffect(() => applyLang(lang), [lang]);

    // 当前数据源（下拉框、网址记录的）与它载入后的数据；载入失败时保留上一份数据
    const [current, setCurrent] = useState(initialSource);
    const [loaded, setLoaded] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const changeSource = async (next) => {
        setLoading(true);
        setError("");
        try {
            const data = await loadDataSource(next);
            setCurrent(next);
            setLoaded({ source: next, data });
            rememberSource(next);
        } catch (err) {
            console.error("Data source switch failed:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // 首次挂载时载入网址指定的远程文件或示例数据集（默认为第一个示例数据集）
    useEffect(() => {
        changeSource(current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const source = useMemo(() => loaded && createLocalSource(loaded.data), [loaded]);
    // 示例数据集可指定默认中心、默认隐藏的实体类型
    const dataset = loaded?.source.type === 'static' ? DATASETS.find((d) => d.id === loaded.source.dataset) : null;

    return (
        <HypergraphExplorer
            source={source ?? undefined}
            defaultCenter={dataset?.center}
            hiddenTypes={dataset?.hiddenTypes}
            locale={lang}
            onLocaleChange={setLang}
            messages={APP_MESSAGES}
            title="Hypergraph-Viewer"
            loading={loading}
            databaseHeader={<SourceSection current={current} loading={loading} error={error} onChange={changeSource} lang={lang} />}
        />
    );
}

export default App;
