import type { MatrixSVGOptions } from './matrix-svg';
import { incidenceMatrixSVG } from './matrix-svg';
import type { ModelReadableKey } from './model-readable';
import { modelReadableKey } from './model-readable';
import type { HypergraphData } from './spec';

/**
 * <zh/> 导出图片的选项（MR 模式下图片下方带图例）
 *
 * <en/> Image export options (with the legend below the image in MR mode)
 */
export interface ExportImageOptions {
  /** 图片宽度（像素），默认 1024 / image width in pixels, defaults to 1024 */
  width?: number;
  /** 画面最大高度（不含图例），默认等于宽度 / max height of the drawing, legend excluded; defaults to the width */
  maxHeight?: number;
  /** 四周留白，默认 16 / padding, defaults to 16 */
  padding?: number;
  /** 最大放大倍数（相对画布坐标），默认 2：小图不被放大到撑满，四周留白 / zoom cap so small graphs aren't blown up, defaults to 2 */
  maxScale?: number;
  /** 图例与映射表的语言，默认 'en' / language of the legend */
  locale?: 'en' | 'zh';
}

/**
 * <zh/> 导出结果：PNG（data URL）、尺寸、图例；labelPx 为标签在图片中的字号（像素，多个面板取最小），用于检查分辨率预算（P6）
 *
 * <en/> Export result: PNG data URL, size and legend; labelPx is the label font size in the image (smallest panel), for
 * checking the resolution budget
 */
export interface ExportedImage {
  dataURL: string;
  width: number;
  height: number;
  labelPx: number;
  legend: string[];
  /** MR 模式的编号表 / codes in MR mode */
  key: ModelReadableKey | null;
}

/**
 * <zh/> 一个面板：图片源与它的自然尺寸（画布坐标 / SVG 像素），fontSize 为其中标签的字号（同一坐标）
 *
 * <en/> One panel: an image source with its natural size in drawing units, and the label font size in those units
 */
export interface ImagePanel {
  src: string;
  width: number;
  height: number;
  fontSize: number;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** SVG 字符串 → 可作为图片源的 data URL / SVG string to an image data URL */
export const svgDataURL = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/**
 * <zh/> 把若干面板并排拼成一张 PNG（白底，同一高度，总宽为 width），图例按宽度折行画在下方。
 * SVG 面板按目标尺寸矢量绘制，不会模糊
 *
 * <en/> Lay panels side by side in one PNG (white background, common height, total width `width`) with the legend wrapped
 * below. SVG panels are drawn as vectors at the target size
 */
export const composeImage = async (
  panels: ImagePanel[],
  { width = 1024, maxHeight = width, padding = 16, maxScale = 2, legend = [] as string[] }: Omit<ExportImageOptions, 'locale'> & { legend?: string[] } = {},
): Promise<Pick<ExportedImage, 'dataURL' | 'width' | 'height' | 'labelPx'>> => {
  const images = await Promise.all(panels.map((p) => loadImage(p.src)));
  const gap = panels.length > 1 ? padding * 2 : 0;
  const inner = width - 2 * padding - gap * (panels.length - 1);
  // 同一高度 h 下各面板宽 = 宽高比 × h，总宽为 inner；高度不超过 maxHeight
  const aspect = panels.reduce((s, p) => s + p.width / p.height, 0);
  const h = Math.min(inner / aspect, maxHeight - 2 * padding, ...panels.map((p) => p.height * maxScale));
  const scales = panels.map((p) => h / p.height);
  const drawn = panels.reduce((s, p, i) => s + p.width * scales[i], 0) + gap * (panels.length - 1);

  const out = document.createElement('canvas');
  const ctx = out.getContext('2d')!;
  // 图例：字号随宽度（1024 宽时 16px），按宽度折行
  const legendFont = Math.round(width / 64);
  const font = `${legendFont}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.font = font;
  const textWidth = width - 2 * padding;
  const wrapped: string[] = [];
  legend.forEach((line) => {
    let cur = '';
    for (const ch of line) {
      if (cur && ctx.measureText(cur + ch).width > textWidth) {
        wrapped.push(cur);
        cur = '  ';
      }
      cur += ch;
    }
    wrapped.push(cur);
  });
  const lineH = Math.round(legendFont * 1.4);
  const legendH = wrapped.length ? padding + wrapped.length * lineH : 0;
  out.width = width;
  out.height = Math.ceil(h + 2 * padding + legendH);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  let x = (width - drawn) / 2;
  panels.forEach((p, i) => {
    const w = p.width * scales[i];
    ctx.drawImage(images[i], x, padding, w, h);
    if (i < panels.length - 1) {
      // 面板之间的分隔线 / divider between panels
      ctx.strokeStyle = '#d1d5db';
      ctx.beginPath();
      ctx.moveTo(x + w + gap / 2, padding);
      ctx.lineTo(x + w + gap / 2, padding + h);
      ctx.stroke();
    }
    x += w + gap;
  });
  if (wrapped.length) {
    const top = h + 2 * padding;
    ctx.strokeStyle = '#d1d5db';
    ctx.beginPath();
    ctx.moveTo(padding, top - padding / 2);
    ctx.lineTo(width - padding, top - padding / 2);
    ctx.stroke();
    ctx.font = font;
    ctx.fillStyle = '#111827';
    ctx.textBaseline = 'top';
    wrapped.forEach((line, i) => ctx.fillText(line, padding, top + i * lineH));
  }
  return {
    dataURL: out.toDataURL('image/png'),
    width: out.width,
    height: out.height,
    labelPx: Math.round(Math.min(...panels.map((p, i) => p.fontSize * scales[i])) * 10) / 10,
  };
};

/**
 * <zh/> 把关联矩阵导出为 PNG（V-mat）。矩阵里枢纽就是满格的一行，不需要图例
 *
 * <en/> Export the incidence matrix as a PNG (V-mat). Hubs are just full rows, so there is no legend
 */
export const exportMatrixImage = async (
  data: HypergraphData,
  options: MatrixSVGOptions & ExportImageOptions = {},
): Promise<ExportedImage> => {
  const { svg, width, height, fontSize } = incidenceMatrixSVG(data, options);
  const image = await composeImage([{ src: svgDataURL(svg), width, height, fontSize }], { ...options, maxHeight: options.maxHeight ?? Infinity });
  return { ...image, legend: [], key: options.modelReadable ? modelReadableKey(data, { centerNode: options.centerNode }) : null };
};
