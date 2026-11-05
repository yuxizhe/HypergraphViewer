/**
 * <zh/> Node 端：用无头浏览器（Playwright）把超图渲染成图片，供批量出图（模型可读性实验、VisHG-RAG）使用。
 * 页面里加载 G6 的 UMD 包与本库的全局版（hypergraph-viz.global.js），每张图在同一个页面中创建视图、等渲染完成后导出。
 * 需要另装 playwright；它自带的浏览器没装时退回系统 Chrome（channel: 'chrome'）。
 * 中文标签依赖系统字体：Linux 上需装 CJK 字体（如 fonts-noto-cjk）
 *
 * <en/> Node side: render hypergraphs to images in a headless browser (Playwright) for batch jobs. The page loads G6's
 * UMD bundle and this library's global build; each image creates a view, waits for it to render and exports.
 * Requires playwright; falls back to the system Chrome when its bundled browser is missing. CJK labels need system fonts
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ID } from '@antv/g6';
import type { Browser, LaunchOptions, Page } from 'playwright';
import type { ModelReadableKey } from './model-readable';
import { modelReadableKey, modelReadableTable } from './model-readable';
import type { RenderJob, SVGRenderResult } from './render-job';
import { prepareJob, renderJobSVG } from './render-job';

export type { RenderJob, SVGRenderResult } from './render-job';
export { prepareJob, renderJobSVG } from './render-job';

export interface RenderResult {
  png: Buffer;
  width: number;
  height: number;
  /** 标签在图片中的字号（像素，多个面板取最小）/ label font size in the image, smallest panel */
  labelPx: number;
  legend: string[];
  /** MR 模式下的编号映射表（Markdown），否则为 null / mapping table in MR mode */
  table: string | null;
  key: ModelReadableKey | null;
  fadedNodes: ID[];
  /** 渲染用时（毫秒）/ render time in ms */
  ms: number;
}

export interface HeadlessRendererOptions {
  /** 复用已启动的浏览器（close 时不关闭）/ reuse a launched browser, left open on close */
  browser?: Browser;
  /** 启动参数；不传时先试 Playwright 自带的 Chromium，再试系统 Chrome / launch options */
  launch?: LaunchOptions;
  /** 画布视口，默认 1200×900；导出的是整张图，视口只影响初始布局的尺度 / canvas viewport */
  viewport?: { width: number; height: number };
  /** 设备像素比，默认 2（画布截图放大后不糊）/ device pixel ratio, 2 by default */
  deviceScaleFactor?: number;
  /** G6 UMD 包与本库全局版的路径，默认自动查找 / paths of G6's UMD bundle and this library's global build */
  scripts?: { g6?: string; viz?: string };
}

export interface HeadlessRenderer {
  render(job: RenderJob): Promise<RenderResult>;
  close(): Promise<void>;
}

// CJS 版中 import.meta.url 由 tsup 的 shims 替换 / shimmed by tsup in the CJS build
// 在页面里执行的渲染代码。写成字符串而不是函数：打包器会转译函数体（如 ?? 变成 _nullishCoalesce 辅助函数），页面里没有这些辅助函数
// In-page render code, kept as a string: bundlers transpile function bodies into helpers the page doesn't have
const PAGE_RENDER = `async ({ job, fadedNodes, layout, modelReadable, width }) => {
  const H = window.HypergraphViz;
  // 与超图浏览器相同：去掉最后一个冒号（半角或全角）及之前的部分
  const strip = (id) => {
    const i = Math.max(id.lastIndexOf(':'), id.lastIndexOf('：'));
    return i >= 0 && i < id.length - 1 ? id.slice(i + 1) : id;
  };
  const labelText = job.stripPrefix === false ? undefined : (d) => strip(String(d.id));
  const hyperedgeColors = { ...H.hyperedgeColorsOf(job.data), ...job.hyperedgeColors };
  const size = { width, maxHeight: job.maxHeight, padding: job.padding, locale: job.locale };
  if (layout === 'matrix') {
    return H.exportMatrixImage(job.data, {
      ...size,
      order: job.matrixOrder,
      typeField: job.typeField,
      centerNode: job.centerNode,
      hyperedgeColors,
      typeColors: job.typeColors,
      nodeColors: job.nodeColors,
      hubNodes: fadedNodes,
      labelText: labelText && ((id) => labelText({ id })),
      modelReadable,
      fontSize: 12,
    });
  }
  const el = document.getElementById('canvas');
  const view = H.createHypergraphView(el, {
    data: job.data,
    centerNode: job.centerNode,
    mode: job.mode || 'hyper',
    graphEdges: job.graphEdges || 'star',
    typeField: job.typeField,
    fadedNodes,
    modelReadable,
    labelText,
    hyperedgeColors,
    typeColors: job.typeColors,
    nodeColors: job.nodeColors,
    nodeSizeBy: job.nodeSizeBy || 'degree',
    layout: { type: job.layoutType || 'hypergraph', nodeSpacing: job.nodeSpacing || 50, shuffleSeed: job.shuffleSeed },
    autoFit: 'view',
    behaviors: [],
  });
  try {
    await view.rendered();
    return await view.exportImage({ ...size, layout, matrixOrder: job.matrixOrder });
  } finally {
    view.destroy();
  }
}`;

const here = () => dirname(fileURLToPath(import.meta.url));

// 本库全局版：dist 中与本文件同目录；从源码运行（测试）时在 ../dist
const findScripts = (scripts: HeadlessRendererOptions['scripts'] = {}) => {
  const dir = here();
  const require = createRequire(join(dir, 'index.js'));
  const g6 = scripts.g6 ?? require.resolve('@antv/g6/dist/g6.min.js');
  const viz =
    scripts.viz ??
    [join(dir, 'hypergraph-viz.global.js'), join(dir, '..', 'dist', 'hypergraph-viz.global.js')].find((p) => existsSync(p));
  if (!viz) throw new Error('[hypergraph-viz] hypergraph-viz.global.js not found; build the package or pass scripts.viz');
  return { g6, viz };
};

const launchBrowser = async (launch?: LaunchOptions): Promise<Browser> => {
  const { chromium } = await import('playwright');
  if (launch) return chromium.launch(launch);
  try {
    return await chromium.launch();
  } catch (e) {
    // 自带的浏览器没装（版本不符）时用系统 Chrome / bundled browser missing: use the system Chrome
    if (!String((e as Error)?.message).includes("Executable doesn't exist")) throw e;
    return chromium.launch({ channel: 'chrome' });
  }
};

/**
 * <zh/> 创建无头渲染器：启动（或复用）浏览器，打开一个加载好 G6 与本库的页面；render 逐张渲染，可反复调用。用完 close
 *
 * <en/> Create a headless renderer: launch (or reuse) a browser and open a page with G6 and this library loaded; call render
 * for each image and close when done
 */
export const createHeadlessRenderer = async (options: HeadlessRendererOptions = {}): Promise<HeadlessRenderer> => {
  const { viewport = { width: 1200, height: 900 }, deviceScaleFactor = 2 } = options;
  const { g6, viz } = findScripts(options.scripts);
  const browser = options.browser ?? (await launchBrowser(options.launch));
  const context = await browser.newContext({ viewport, deviceScaleFactor });
  const page: Page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">` +
      `<div id="canvas" style="width:${viewport.width}px;height:${viewport.height}px"></div></body></html>`,
  );
  await page.addScriptTag({ path: g6 });
  await page.addScriptTag({ path: viz });

  const render = async (job: RenderJob): Promise<RenderResult> => {
    const start = Date.now();
    const { centerNode, locale = 'en' } = job;
    const { data, fadedNodes, layout, modelReadable, typeField, width } = prepareJob(job);
    errors.length = 0;
    const arg = { job: { ...job, data }, fadedNodes, layout, modelReadable, width };
    const image: any = await page.evaluate(`(${PAGE_RENDER})(${JSON.stringify(arg)})`);
    if (errors.length) throw new Error(`[hypergraph-viz] page error: ${errors.join('; ')}`);
    const key = modelReadable ? modelReadableKey(data, { centerNode }) : null;
    return {
      png: Buffer.from(String(image.dataURL).split(',')[1], 'base64'),
      width: image.width,
      height: image.height,
      labelPx: image.labelPx,
      legend: image.legend,
      table: key ? modelReadableTable(data, key, { faded: layout === 'matrix' ? [] : fadedNodes, locale, typeField }) : null,
      key,
      fadedNodes,
      ms: Date.now() - start,
    };
  };

  return {
    render,
    async close() {
      await context.close();
      if (!options.browser) await browser.close();
    },
  };
};

/**
 * <zh/> 渲染一张图（启动浏览器、渲染、关闭）；批量时用 createHeadlessRenderer 复用同一个页面
 *
 * <en/> Render one image (launch, render, close); for batches reuse one renderer from createHeadlessRenderer
 */
export const renderHypergraphImage = async (job: RenderJob, options?: HeadlessRendererOptions): Promise<RenderResult> => {
  const renderer = await createHeadlessRenderer(options);
  try {
    return await renderer.render(job);
  } finally {
    await renderer.close();
  }
};

export interface SVGRendererOptions {
  /**
   * 另外注册的字体文件（转 PNG 用，如 Linux 上没装 CJK 字体时）；系统字体总会读取
   * Extra font files for PNG output (e.g. CJK fonts on Linux); system fonts are always available
   */
  fontFiles?: string[];
  /** 是否转 PNG，默认 true；false 时只给 SVG（png 为空 Buffer）/ rasterize to PNG, true by default */
  png?: boolean;
}

/**
 * <zh/> 创建 SVG 渲染器：不需要浏览器，接口与 createHeadlessRenderer 相同（render 另返回 svg 与几何）。
 * SVG 由 renderJobSVG 生成；PNG 用 @napi-rs/canvas（Skia，预编译，需另装）把 SVG 画到画布上再编码。
 * 不用 resvg：它每张图都重新解析整个字体文件，中文字体动辄 20–50 MB，一张要 2–5 秒；Skia 的字体在进程内只加载一次。
 * 画法与浏览器版的差异见 svg-render.ts
 *
 * <en/> SVG renderer without a browser, with the same interface as createHeadlessRenderer (render also returns the SVG and
 * geometry). PNGs come from @napi-rs/canvas (Skia, prebuilt; install separately), which loads fonts once per process,
 * unlike resvg-js that reparses whole CJK font files for every image. See svg-render.ts for differences from the browser
 */
export const createSVGRenderer = async (options: SVGRendererOptions = {}) => {
  const { png = true } = options;
  const skia = png ? await import('@napi-rs/canvas') : null;
  options.fontFiles?.forEach((file) => skia?.GlobalFonts.registerFromPath(file));
  const render = async (job: RenderJob): Promise<RenderResult & SVGRenderResult> => {
    const start = Date.now();
    const result = await renderJobSVG(job);
    let image: Buffer = Buffer.alloc(0);
    if (skia) {
      const svg = await skia.loadImage(Buffer.from(result.svg));
      const canvas = skia.createCanvas(result.width, result.height);
      canvas.getContext('2d').drawImage(svg, 0, 0, result.width, result.height);
      image = await canvas.encode('png');
    }
    return { ...result, png: image, ms: Date.now() - start };
  };
  return { render, close: async () => undefined };
};
