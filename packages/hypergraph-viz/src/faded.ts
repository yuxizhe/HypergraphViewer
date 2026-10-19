import type { ID } from '@antv/g6';

interface Circle {
  id: ID;
  x: number;
  y: number;
  r: number;
}

/**
 * <zh/> 放置淡出实体：从它所关联实体的中心出发，按螺线向外找第一个不与已有节点重叠的位置（中心附近通常最挤）
 *
 * <en/> Place faded vertices: spiral out from the centroid of their linked vertices to the first spot clear of other nodes
 */
export const placeFaded = (
  faded: { id: ID; r: number }[],
  drawn: Circle[],
  links: { source: ID; target: ID }[],
): Map<ID, { x: number; y: number }> => {
  const at = new Map(drawn.map((c) => [c.id, c]));
  const obstacles = [...drawn];
  const result = new Map<ID, { x: number; y: number }>();
  const centroid = (ids: ID[]) => {
    const pts = ids.map((id) => at.get(id)).filter(Boolean) as Circle[];
    const list = pts.length ? pts : drawn;
    if (!list.length) return { x: 0, y: 0 };
    return {
      x: list.reduce((a, c) => a + c.x, 0) / list.length,
      y: list.reduce((a, c) => a + c.y, 0) / list.length,
    };
  };
  faded.forEach(({ id, r }) => {
    const start = centroid(links.filter((l) => l.source === id).map((l) => l.target));
    const gap = r * 1.5;
    const clear = (x: number, y: number) => obstacles.every((o) => Math.hypot(o.x - x, o.y - y) >= o.r + r + gap);
    let pos = start;
    // 螺线：每圈半径增加 r，角度步长随半径变小
    for (let i = 0, radius = 0, angle = 0; i < 2000; i++) {
      const x = start.x + radius * Math.cos(angle);
      const y = start.y + radius * Math.sin(angle);
      if (clear(x, y)) {
        pos = { x, y };
        break;
      }
      angle += radius ? Math.min(0.5, (r * 1.5) / radius) : Math.PI * 2;
      radius = (r * angle) / Math.PI;
    }
    result.set(id, pos);
    obstacles.push({ id, ...pos, r });
  });
  return result;
};
