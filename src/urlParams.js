// 网址查询参数：页面状态（数据集、语言）写入网址，便于分享链接
export const getUrlParam = (key) => new URLSearchParams(window.location.search).get(key);

// value 为空时去掉该参数；用 replaceState，不产生历史记录
export const setUrlParam = (key, value) => {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    window.history.replaceState(null, '', url);
};
