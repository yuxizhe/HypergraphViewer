import type { CSSProperties, RefObject } from 'react';
import { useEffect, useState } from 'react';
import type { HypergraphView as View } from './view';

// 工具栏操作的视图：画布（缩放 G6 画布）或关联矩阵（zoomBy 改单元格大小）
type ZoomableView = Pick<View, 'fitView'> & { graph?: Pick<View['graph'], 'zoomBy'>; zoomBy?: (ratio: number) => void };

export interface ToolbarOptions {
  /**
   * 'small'：小号（按钮更小、贴边，平时半透明，全屏时恢复正常大小），用于小画布；'large'：大号，便于手指点按 /
   * compact variant for small canvases, or large buttons for touch screens
   */
  size?: 'default' | 'small' | 'large';
  /** 按钮提示文字的语言，默认英文 / language of the button titles, English by default */
  locale?: 'en' | 'zh';
  /** 全屏按钮：false 不显示；默认让视图所在的容器全屏，也可指定更大的元素（如连同宿主的浮层）/ element to make full screen, false to hide the button */
  fullscreen?: boolean | RefObject<HTMLElement | null>;
}

const TITLES = {
  en: { zoomIn: 'Zoom in', zoomOut: 'Zoom out', fitView: 'Fit to view', fullscreen: 'Full screen', exitFullscreen: 'Exit full screen' },
  zh: { zoomIn: '放大', zoomOut: '缩小', fitView: '视图居中（适应画布）', fullscreen: '全屏', exitFullscreen: '退出全屏' },
};

// 工具栏图标（24×24 线条）
const ICONS = {
  zoomIn: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm9 16-4-4M11 8v6M8 11h6',
  zoomOut: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm9 16-4-4M8 11h6',
  fitView: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
  fullscreen: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  exitFullscreen: 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5',
};

type Icon = keyof typeof ICONS;

// 样式全部内联：只用画布的宿主不需要引入样式表
type ButtonSize = 'small' | 'default' | 'large';
const BUTTON_SIZES: Record<ButtonSize, [number, number]> = { small: [22, 14], default: [32, 18], large: [40, 20] };

const ToolButton = ({ icon, title, onClick, size: variant, first }: { icon: Icon; title: string; onClick: () => void; size: ButtonSize; first: boolean }) => {
  const [hover, setHover] = useState(false);
  const [size, iconSize] = BUTTON_SIZES[variant];
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        margin: 0,
        border: 'none',
        borderLeft: first ? 'none' : '1px solid #e5e7eb',
        background: hover ? '#f3f4f6' : 'transparent',
        color: hover ? '#111827' : '#4b5563',
        cursor: 'pointer',
      }}
    >
      <svg width={iconSize} height={iconSize} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d={ICONS[icon]} />
      </svg>
    </button>
  );
};

/** 画布右上角工具栏：放大、缩小、视图居中、全屏 / zoom, fit and full-screen toolbar at the top right of the canvas */
export const Toolbar = ({
  viewRef,
  target,
  options,
}: {
  viewRef: RefObject<ZoomableView | null>;
  /** 全屏的元素；null 不显示全屏按钮 */
  target: RefObject<HTMLElement | null> | null;
  options: ToolbarOptions;
}) => {
  const titles = TITLES[options.locale === 'zh' ? 'zh' : 'en'];
  // 视图换数据重新挂载时，全屏可能仍在进行
  const [fullscreen, setFullscreen] = useState(
    () => !!target?.current && (document.fullscreenElement === target.current || target.current.dataset.hvFullscreen === 'page'),
  );
  const [hover, setHover] = useState(false);
  const refit = () => setTimeout(() => viewRef.current?.fitView(false), 100);
  useEffect(() => {
    const onChange = () => {
      setFullscreen(!!target?.current && document.fullscreenElement === target.current);
      // 进出全屏后画布尺寸变化，重新撑满
      refit();
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewRef, target]);
  const toggleFullscreen = () => {
    const el = target?.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.fullscreenEnabled && el.requestFullscreen) el.requestFullscreen();
    else {
      // 不支持全屏 API（如 iPhone 上的 Safari）：把元素铺满页面代替
      const on = el.dataset.hvFullscreen !== 'page';
      if (on) {
        el.dataset.hvFullscreen = 'page';
        el.dataset.hvStyle = el.getAttribute('style') ?? '';
        Object.assign(el.style, { position: 'fixed', inset: '0', zIndex: '2147483000', background: '#fff' });
      } else {
        delete el.dataset.hvFullscreen;
        el.setAttribute('style', el.dataset.hvStyle ?? '');
        delete el.dataset.hvStyle;
      }
      setFullscreen(on);
      refit();
    }
  };
  const zoom = (ratio: number) => {
    const view = viewRef.current;
    if (view?.zoomBy) view.zoomBy(ratio);
    else view?.graph?.zoomBy(ratio, { duration: 200 });
  };

  // 小号平时半透明，指针移上去才完全显示，少挡住小画布；全屏时恢复正常大小
  const small = options.size === 'small' && !fullscreen;
  const buttonSize: ButtonSize = small ? 'small' : options.size === 'large' ? 'large' : 'default';
  const offset = options.size === 'small' ? 4 : 8;
  const style: CSSProperties = {
    position: 'absolute',
    top: offset,
    right: offset,
    zIndex: 10,
    display: 'flex',
    overflow: 'hidden',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
    background: 'rgba(255, 255, 255, 0.9)',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    opacity: small && !hover ? 0.5 : 1,
    transition: 'opacity 150ms',
  };
  const buttons: [Icon, string, () => void][] = [
    ['zoomIn', titles.zoomIn, () => zoom(1.25)],
    ['zoomOut', titles.zoomOut, () => zoom(0.8)],
    ['fitView', titles.fitView, () => viewRef.current?.fitView()],
  ];
  if (target) {
    buttons.push(fullscreen ? ['exitFullscreen', titles.exitFullscreen, toggleFullscreen] : ['fullscreen', titles.fullscreen, toggleFullscreen]);
  }
  return (
    <div style={style} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {buttons.map(([icon, title, onClick], i) => (
        <ToolButton key={icon} icon={icon} title={title} onClick={onClick} size={buttonSize} first={i === 0} />
      ))}
    </div>
  );
};
