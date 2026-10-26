import type { ID } from '@antv/g6';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { charWidth } from './layout';
import type { MatrixOrder } from './matrix';
import { incidenceMatrix } from './matrix';
import type { Selection } from './selection';
import { EMPTY_SELECTION, isEmptySelection, nextSelection, selectionStyles } from './selection';
import type { HyperedgeItem, HypergraphData } from './spec';
import type { HypergraphTheme } from './theme';
import { resolveTheme, typeColorsOf } from './theme';
import { Toolbar, type ToolbarOptions } from './toolbar';
import type { HypergraphHit } from './view';

export interface IncidenceMatrixViewProps {
  data: HypergraphData;
  /** 行列排序，默认 'degree'（见 MatrixOrder）/ row and column order, 'degree' by default */
  order?: MatrixOrder;
  /** 顶点上表示类型的字段 / vertex field holding its type */
  typeField?: string;
  /** 放在第一行并加粗的实体 / vertex put in the first row, in bold */
  centerNode?: ID;
  typeColors?: Record<string, string>;
  nodeColors?: Record<ID, string>;
  /** 超边 id → 颜色；不传时按顺序循环取 theme.hyperedgeColors / hyperedge id → color */
  hyperedgeColors?: Record<ID, string>;
  /** 标成枢纽的实体（如画布上淡出的），行首为虚线圈 / vertices marked as hubs (e.g. faded on the canvas), drawn with a dashed ring */
  hubNodes?: ID[];
  /** 行标签，默认为 id / row label, defaults to the id */
  labelText?: (id: ID) => string;
  /** 列标签，默认为超边的 description / summary / type / keywords 中第一个有的 / column label */
  columnLabel?: (item: HyperedgeItem & { id: ID }) => string;
  theme?: Partial<HypergraphTheme>;
  /** 行标题宽度，默认 168 / row header width */
  rowHeaderWidth?: number;
  /** 列标题高度，默认 96 / column header height */
  columnHeaderHeight?: number;
  /** 适应容器时单元格的最小边长，默认 6；容器窄时设大些（如 9）保留行标签，改为横向滚动 / minimum fitted cell size */
  minCellSize?: number;
  /** 矩阵下方留白（像素），给画布底部的浮层让位，默认 8 / space below the matrix, e.g. for overlays at the bottom */
  bottomPadding?: number;
  /** 受控的选择；不传时由视图自己维护 / controlled selection */
  selection?: Selection;
  /** 点行选实体、点列选超边，Shift 增删，点左上角取消 / click a row or column to select, Shift to toggle, the corner to clear */
  onSelectionChange?: (selection: Selection, info: { additive: boolean; hit: HypergraphHit | null }) => void;
  /** 悬停行（实体）或列（超边），离开时为 null / fired when hovering a row or column, null on leave */
  onHover?: (hit: (HypergraphHit & { client: { x: number; y: number } }) | null) => void;
  toolbar?: boolean | ToolbarOptions;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * <zh/> 关联矩阵视图的句柄：与 HypergraphView 相同的 hover / select / fitView，另有 zoomBy（改单元格大小）
 *
 * <en/> Handle of the matrix view: hover / select / fitView as in HypergraphView, plus zoomBy (cell size)
 */
export interface IncidenceMatrixHandle {
  hover(target: Partial<Selection> | null): void;
  select(id: ID | null): void;
  /** 单元格大小回到适应容器 / fit the cell size to the container again */
  fitView(animate?: boolean): Promise<void>;
  zoomBy(ratio: number): void;
}

const MIN_CELL = 6;
const MAX_CELL = 28;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// 按估算宽度截断文字（字符宽度同 HypergraphLayout 的标签防重叠）
const fit = (text: string, fontSize: number, width: number) => {
  let w = 0;
  let out = '';
  for (const ch of text) {
    w += fontSize * charWidth(ch);
    if (w > width) return `${out.slice(0, -1)}…`;
    out += ch;
  }
  return out;
};

const defaultColumnLabel = (he: HyperedgeItem) => {
  const text = he.description || he.summary || he.type || he.keywords || he.edgeName || '';
  return String(Array.isArray(text) ? text.join(', ') : text).replace(/<SEP>/g, ', ');
};

/**
 * <zh/> 关联矩阵视图（参考 HAT 的 incidence plot）：一行一个实体，一列一条超边，成员处画点并用竖线连起。
 * 枢纽实体只是满格的一行，不会像画布那样把超边挤在一起。行、列标题固定，矩阵大时滚动
 *
 * <en/> Incidence matrix view (after HAT's incidence plot): one row per vertex, one column per hyperedge, members as dots
 * joined by a vertical line. A hub is just a full row instead of crowding the canvas. Headers stay fixed while scrolling
 */
export const IncidenceMatrixView = forwardRef<IncidenceMatrixHandle | null, IncidenceMatrixViewProps>(function IncidenceMatrixView(
  {
    data,
    order = 'degree',
    typeField = 'entity_type',
    centerNode,
    typeColors: typeColorsProp,
    nodeColors = {},
    hyperedgeColors,
    hubNodes,
    labelText = (id) => String(id),
    columnLabel = defaultColumnLabel,
    theme: themeProp,
    rowHeaderWidth = 168,
    columnHeaderHeight = 96,
    bottomPadding = 8,
    minCellSize = MIN_CELL,
    selection: selectionProp,
    onSelectionChange,
    onHover,
    toolbar,
    className,
    style,
    children,
  },
  ref,
) {
  const theme = resolveTheme(themeProp);
  const matrix = useMemo(() => incidenceMatrix(data, { order, typeField, centerNode }), [data, order, typeField, centerNode]);
  const { rows, columns } = matrix;
  const typeColors = useMemo(
    () => typeColorsProp ?? typeColorsOf(Object.values(data.vertices), typeField, theme.typePalette),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [typeColorsProp, data, typeField],
  );
  const hubs = useMemo(() => new Set(hubNodes || []), [hubNodes]);

  const [ownSelection, setOwnSelection] = useState<Selection>(EMPTY_SELECTION);
  const selection = selectionProp ?? ownSelection;
  const [hovered, setHovered] = useState<Partial<Selection> | null>(null);
  // 指针所在的行（矩阵内悬停列时的十字线）
  const [pointerRow, setPointerRow] = useState<number | null>(null);

  // 单元格大小：manual 为 null 时按容器适应
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [manual, setManual] = useState<number | null>(null);
  useEffect(() => {
    const el = scrollRef.current!;
    const observer = new ResizeObserver(() => setBox({ width: el.clientWidth, height: el.clientHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // 适应：先按宽度铺满，高度不够时再缩小，但不小于 12（行多时纵向滚动）
  const fitCell = () => {
    if (!columns.length || !rows.length || !box.width) return 16;
    const byWidth = (box.width - rowHeaderWidth - 8) / columns.length;
    const byHeight = (box.height - columnHeaderHeight - 8) / rows.length;
    return clamp(Math.floor(Math.min(byWidth, Math.max(byHeight, 12), 22)), minCellSize, MAX_CELL);
  };
  const cell = manual ?? fitCell();
  // 换数据后回到适应
  useEffect(() => setManual(null), [data]);

  // 行列状态：沿用画布的选择规则（选中实体所在的超边保持常态，其余变淡）
  const styles = useMemo(() => {
    const hyperedges = new Map(columns.map((c) => [c.id, c.item]));
    const spec = { data: { nodes: rows.map((id) => ({ id })), edges: [] }, hyperedges, lineHyperedges: new Map() };
    return selectionStyles(spec, selection, hovered);
  }, [rows, columns, selection, hovered]);

  const colorOf = (id: ID, i: number) => hyperedgeColors?.[id] ?? theme.hyperedgeColors[i % theme.hyperedgeColors.length];
  const nodeColorOf = (id: ID) =>
    nodeColors[id] ?? (id === centerNode ? theme.centerColor : typeColors[data.vertices[id]?.[typeField]] || theme.nodeColor);

  const hitOfRow = (i: number): HypergraphHit | null => {
    const id = rows[i];
    return id === undefined ? null : { kind: 'node', id, item: { ...data.vertices[id], id, label: id } };
  };
  const hitOfColumn = (j: number): HypergraphHit | null => {
    const col = columns[j];
    if (!col) return null;
    const { item } = col;
    // 2 元超边与画布上的连线一致，按 edge 报告
    return item.members.length === 2
      ? { kind: 'edge', id: col.id, members: item.members, item, hyperedges: [col.id] }
      : { kind: 'hyperedge', id: col.id, members: item.members, item };
  };
  const targetOf = (hit: HypergraphHit | null) =>
    !hit ? null : hit.kind === 'node' ? { kind: 'nodes' as const, id: hit.id } : { kind: 'hyperedges' as const, id: hit.hyperedges?.[0] ?? hit.id };

  const report = (hit: HypergraphHit | null, e?: ReactPointerEvent) => {
    const target = targetOf(hit);
    setHovered((prev) => {
      const next = target ? { [target.kind]: [target.id] } : null;
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
    onHover?.(hit && e ? { ...hit, client: { x: e.clientX, y: e.clientY } } : null);
  };
  const click = (hit: HypergraphHit | null, e: { shiftKey: boolean }) => {
    const next = nextSelection(selection, targetOf(hit), e.shiftKey);
    if (next === selection) return;
    if (!selectionProp) setOwnSelection(next);
    onSelectionChange?.(next, { additive: e.shiftKey, hit });
  };
  // 指针在元素内的坐标（元素自身像素）：祖先有 CSS zoom / transform 时，屏幕上的尺寸与 width / height 属性不同
  const local = (e: { clientX: number; clientY: number; currentTarget: Element }) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const sx = rect.width ? (Number(el.getAttribute('width')) || rect.width) / rect.width : 1;
    const sy = rect.height ? (Number(el.getAttribute('height')) || rect.height) / rect.height : 1;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };
  const leave = () => {
    setPointerRow(null);
    report(null);
  };

  const zoomBy = (ratio: number) => setManual((c) => clamp(Math.round((c ?? cell) * ratio), MIN_CELL, MAX_CELL));
  const handle: IncidenceMatrixHandle = {
    hover: (target) => {
      const next = isEmptySelection(target) ? null : target!;
      setHovered((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    },
    select: (id) => {
      const next = id === null ? EMPTY_SELECTION : { ...EMPTY_SELECTION, hyperedges: [id] };
      if (!selectionProp) setOwnSelection(next);
      const col = columns.findIndex((c) => c.id === id);
      onSelectionChange?.(next, { additive: false, hit: col < 0 ? null : hitOfColumn(col) });
    },
    fitView: async () => {
      setManual(null);
      scrollRef.current?.scrollTo({ left: 0, top: 0 });
    },
    zoomBy,
  };
  // 句柄经 ref 转发到最新的闭包
  const handleRef = useRef(handle);
  handleRef.current = handle;
  useImperativeHandle(
    ref,
    () => ({
      hover: (target) => handleRef.current.hover(target),
      select: (id) => handleRef.current.select(id),
      fitView: (animate) => handleRef.current.fitView(animate),
      zoomBy: (ratio) => handleRef.current.zoomBy(ratio),
    }),
    [],
  );
  const toolbarOptions = toolbar === true ? {} : toolbar || null;
  const fullscreenTarget =
    toolbarOptions?.fullscreen === false ? null : typeof toolbarOptions?.fullscreen === 'object' ? toolbarOptions.fullscreen : rootRef;

  const width = columns.length * cell;
  const height = rows.length * cell;
  const RW = rowHeaderWidth;
  const CH = columnHeaderHeight;
  const rowFont = clamp(cell - 3, 8, 12);
  const showRowLabels = cell >= 8;
  const colFont = clamp(cell - 2, 8, 11);
  // 列标题矮（如侧栏中的小矩阵）时只画颜色条
  const showColumnLabels = cell >= 9 && columnHeaderHeight >= 40;
  const hl = theme.highlightColor;

  const rowState = (id: ID) => styles.states[id] || [];
  const columnLevel = (id: ID) => styles.bubbles[id] ?? 'normal';
  const highlightedRows = rows.flatMap((id, i) => (rowState(id).some((s) => s === 'highlight' || s === 'active') ? [i] : []));
  const highlightedColumns = columns.flatMap((c, j) => (columnLevel(c.id) === 'highlight' ? [j] : []));
  const sticky = (extra: CSSProperties): CSSProperties => ({ position: 'sticky', background: '#fff', ...extra });

  // 行带、列带（选中、悬停）
  const rowBands = (w: number) =>
    highlightedRows.map((i) => <rect key={`r${i}`} x={0} y={i * cell} width={w} height={cell} fill={hl} fillOpacity={0.1} />);
  const columnBands = (h: number, y0 = 0) =>
    highlightedColumns.map((j) => <rect key={`c${j}`} x={j * cell} y={y0} width={cell} height={h} fill={hl} fillOpacity={0.1} />);

  return (
    <div ref={rootRef} className={className} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      <div ref={scrollRef} style={{ position: 'absolute', inset: 0, overflow: 'auto' }} onPointerLeave={leave}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${RW}px ${width}px`,
            gridTemplateRows: `${CH}px ${height}px`,
            width: RW + width,
            paddingRight: 8,
            paddingBottom: bottomPadding,
          }}
        >
          {/* 左上角：行数 × 列数；点击取消选择 */}
          <div
            style={sticky({ top: 0, left: 0, zIndex: 3, display: 'flex', alignItems: 'flex-end', padding: '0 8px 6px', cursor: 'pointer' })}
            onClick={(e) => click(null, e)}
            onPointerMove={leave}
          >
            <span style={{ fontSize: 11, color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>
              {rows.length} × {columns.length}
            </span>
          </div>

          {/* 列标题：超边标签（斜排）与颜色条 */}
          <svg
            width={width}
            height={CH}
            style={sticky({ top: 0, zIndex: 2, display: 'block', cursor: 'pointer' })}
            onPointerMove={(e) => {
              setPointerRow(null);
              report(hitOfColumn(Math.floor(local(e).x / cell)), e);
            }}
            onClick={(e) => click(hitOfColumn(Math.floor(local(e).x / cell)), e)}
          >
            {columnBands(CH)}
            {matrix.columnGroups.slice(1).map((g) => (
              <line key={g.start} x1={g.start * cell} x2={g.start * cell} y1={CH - 24} y2={CH} stroke="#d1d5db" />
            ))}
            {columns.map((c, j) => {
              const level = columnLevel(c.id);
              const x = (j + 0.5) * cell;
              const color = colorOf(c.id, j);
              return (
                <g key={c.id} opacity={level === 'dimmed' ? 0.3 : 1}>
                  <rect x={j * cell + 1} y={CH - 5} width={Math.max(1, cell - 2)} height={4} rx={1} fill={color} />
                  {showColumnLabels && (
                    <text
                      transform={`translate(${x + colFont * 0.35}, ${CH - 9}) rotate(-60)`}
                      fontSize={colFont}
                      fill={level === 'highlight' ? '#111827' : '#4b5563'}
                      fontWeight={level === 'highlight' ? 'bold' : 'normal'}
                    >
                      {fit(columnLabel(c.item), colFont, (CH - 14) / Math.sin(Math.PI / 3))}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* 行标题：类型色点、实体名、度数 */}
          <svg
            width={RW}
            height={height}
            style={sticky({ left: 0, zIndex: 2, display: 'block', cursor: 'pointer' })}
            onPointerMove={(e) => {
              const i = Math.floor(local(e).y / cell);
              setPointerRow(i);
              report(hitOfRow(i), e);
            }}
            onClick={(e) => click(hitOfRow(Math.floor(local(e).y / cell)), e)}
          >
            {rowBands(RW)}
            {matrix.rowGroups.slice(1).map((g) => (
              <line key={g.start} x1={0} x2={RW} y1={g.start * cell} y2={g.start * cell} stroke="#d1d5db" />
            ))}
            {rows.map((id, i) => {
              const s = rowState(id);
              const y = (i + 0.5) * cell;
              const r = clamp(cell / 3, 2, 5);
              const hub = hubs.has(id);
              const color = nodeColorOf(id);
              const strong = s.includes('highlight') || id === centerNode;
              return (
                <g key={id} opacity={s.includes('inactive') && !s.includes('active') ? 0.3 : 1}>
                  {hub ? (
                    <circle cx={10} cy={y} r={r} fill="#fff" stroke={color} strokeWidth={1.5} strokeDasharray="2 1.5" />
                  ) : (
                    <circle cx={10} cy={y} r={r} fill={color} />
                  )}
                  {showRowLabels && (
                    <>
                      <text x={20} y={y} dy="0.35em" fontSize={rowFont} fill="#111827" fontWeight={strong ? 'bold' : 'normal'}>
                        {fit(labelText(id), rowFont, RW - 20 - 30)}
                      </text>
                      <text x={RW - 6} y={y} dy="0.35em" fontSize={rowFont - 1} fill="#9ca3af" textAnchor="end">
                        {matrix.degree.get(id)}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>

          {/* 矩阵：隔行底色、成员点与竖线 */}
          <svg
            width={width}
            height={height}
            style={{ display: 'block', cursor: 'pointer' }}
            onPointerMove={(e) => {
              const p = local(e);
              setPointerRow(Math.floor(p.y / cell));
              report(hitOfColumn(Math.floor(p.x / cell)), e);
            }}
            onClick={(e) => click(hitOfColumn(Math.floor(local(e).x / cell)), e)}
          >
            {rows.map((id, i) => (i % 2 ? <rect key={id} x={0} y={i * cell} width={width} height={cell} fill="#f9fafb" /> : null))}
            {rowBands(width)}
            {columnBands(height)}
            {pointerRow !== null && pointerRow < rows.length && (
              <rect x={0} y={pointerRow * cell} width={width} height={cell} fill="none" stroke={hl} strokeOpacity={0.35} />
            )}
            {matrix.rowGroups.slice(1).map((g) => (
              <line key={`rg${g.start}`} x1={0} x2={width} y1={g.start * cell} y2={g.start * cell} stroke="#d1d5db" />
            ))}
            {matrix.columnGroups.slice(1).map((g) => (
              <line key={`cg${g.start}`} x1={g.start * cell} x2={g.start * cell} y1={0} y2={height} stroke="#d1d5db" />
            ))}
            {columns.map((c, j) => {
              const level = columnLevel(c.id);
              const color = colorOf(c.id, j);
              const x = (j + 0.5) * cell;
              const top = (c.rows[0] + 0.5) * cell;
              const bottom = (c.rows[c.rows.length - 1] + 0.5) * cell;
              const r = clamp(cell * 0.3, 2, 7);
              return (
                <g key={c.id} opacity={level === 'dimmed' ? 0.15 : 1}>
                  <line
                    x1={x}
                    x2={x}
                    y1={top}
                    y2={bottom}
                    stroke={color}
                    strokeWidth={level === 'highlight' ? Math.max(2, cell / 6) : Math.max(1.2, cell / 10)}
                  />
                  {c.rows.map((i) => (
                    <circle
                      key={i}
                      cx={x}
                      cy={(i + 0.5) * cell}
                      r={r}
                      fill={color}
                      stroke={level === 'highlight' ? hl : '#fff'}
                      strokeWidth={level === 'highlight' ? 1.5 : 1}
                    />
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      {toolbarOptions && <Toolbar viewRef={handleRef} target={fullscreenTarget} options={toolbarOptions} />}
      {children}
    </div>
  );
});
