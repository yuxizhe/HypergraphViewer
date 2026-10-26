/**
 * 关联矩阵的行列排序，与图模式的超边节点（二部图）
 */
import { describe, expect, it } from 'vitest';
import { hyperedgeNodeId, incidenceMatrix, selectionStyles, toG6Spec } from '../src';
import type { HypergraphData } from '../src';

const data: HypergraphData = {
  vertices: {
    hub: { entity_type: 'A' },
    a: { entity_type: 'A' },
    b: { entity_type: 'B' },
    c: { entity_type: 'B' },
    d: { entity_type: 'B' },
    x: {},
    y: {},
  },
  hyperedges: [
    { id: 'e1', members: ['hub', 'a', 'b'], type: 'T1' },
    { id: 'e2', members: ['hub', 'b', 'c'], type: 'T2' },
    { id: 'e3', members: ['hub', 'c', 'd'], type: 'T1' },
    { id: 'e4', members: ['hub', 'a'] },
    { id: 'e5', members: ['hub', 'd', 'a', 'b'], type: 'T1' },
    { id: 'e6', members: ['x', 'y'] },
    // 重复的超边、只剩一个存在成员的超边不列出
    { id: 'e1', members: ['hub', 'a'] },
    { id: 'e7', members: ['a', 'missing'] },
  ],
};

describe('incidenceMatrix', () => {
  it('一行一个实体、一列一条超边，度数与成员行号', () => {
    const m = incidenceMatrix(data);
    expect(m.rows).toHaveLength(7);
    expect(m.columns.map((c) => c.id).sort()).toEqual(['e1', 'e2', 'e3', 'e4', 'e5', 'e6']);
    expect(m.degree.get('hub')).toBe(5);
    m.columns.forEach((c) => {
      expect(c.rows).toEqual([...c.rows].sort((p, q) => p - q));
      expect(c.rows.map((i) => m.rows[i]).sort()).toEqual([...c.item.members].sort());
    });
  });

  it("'degree'：中心在第一行，其余按度数降序，列为阶梯状", () => {
    const m = incidenceMatrix(data, { centerNode: 'x' });
    expect(m.rows[0]).toBe('x');
    expect(m.rows[1]).toBe('hub');
    const degrees = m.rows.slice(1).map((id) => m.degree.get(id)!);
    expect(degrees).toEqual([...degrees].sort((p, q) => q - p));
    for (let j = 1; j < m.columns.length; j++) expect(m.columns[j - 1].rows[0]).toBeLessThanOrEqual(m.columns[j].rows[0]);
  });

  it("'type'：行按类型分组（实体多的类型在前、无类型最后），列按超边 type 分组", () => {
    const m = incidenceMatrix(data, { order: 'type' });
    expect(m.rowGroups.map((g) => g.type)).toEqual(['B', 'A', null]);
    expect(m.rows.slice(0, 3).every((id) => data.vertices[id].entity_type === 'B')).toBe(true);
    expect(m.columnGroups.map((g) => g.type)).toEqual(['T1', 'T2', null]);
  });

  it("'cluster'：不连通的部分各自聚在一起", () => {
    const m = incidenceMatrix(data, { order: 'cluster' });
    const xi = m.rows.indexOf('x');
    expect(Math.abs(xi - m.rows.indexOf('y'))).toBe(1);
    const last = m.columns[m.columns.length - 1];
    const first = m.columns[0];
    expect([first.id, last.id]).toContain('e6');
  });
});

describe("graphEdges: 'star'", () => {
  const spec = toG6Spec(data, { mode: 'graph', graphEdges: 'star' });

  it('3 元及以上超边画成超边节点、连向各成员，2 元超边仍为连线', () => {
    const nodeIds = spec.data.nodes!.map((n) => n.id);
    ['e1', 'e2', 'e3', 'e5'].forEach((id) => expect(nodeIds).toContain(hyperedgeNodeId(id)));
    expect(nodeIds).not.toContain(hyperedgeNodeId('e4'));
    // 没有连线的顶点也保留（不同于 binary）
    expect(nodeIds).toEqual(expect.arrayContaining(Object.keys(data.vertices)));
    expect(spec.hyperedgeNodes.get(hyperedgeNodeId('e5'))).toBe('e5');
    const links = spec.data.edges!.filter((e) => e.source === hyperedgeNodeId('e5'));
    expect(links.map((e) => e.target).sort()).toEqual(['a', 'b', 'd', 'hub']);
    links.forEach((e) => expect(spec.lineHyperedges.get(e.id!)).toEqual(['e5']));
  });

  it('超边节点与连线用超边颜色，节点画成菱形、不带标签', () => {
    const style = spec.node.style as any;
    const he = spec.data.nodes!.find((n) => n.id === hyperedgeNodeId('e1'))!;
    const spec2 = toG6Spec(data, { mode: 'graph', graphEdges: 'star', hyperedgeColors: { e1: '#123456' } });
    expect((spec2.node.style as any).fill(he)).toBe('#123456');
    const link = spec2.data.edges!.find((e) => e.source === hyperedgeNodeId('e1'))!;
    expect((spec2.edge.style as any).stroke(link)).toBe('#123456');
    expect((spec.node as any).type(he)).toBe('diamond');
    expect((spec.node as any).type({ id: 'a' })).toBe('circle');
    expect(style.labelText(he)).toBe('');
    expect(style.labelText({ id: 'a' })).toBe('a');
  });

  it('选中超边：它的超边节点与连线高亮，其余超边节点变淡', () => {
    const { states } = selectionStyles(spec, { nodes: [], hyperedges: ['e1'] });
    expect(states[hyperedgeNodeId('e1')]).toEqual(['highlight']);
    expect(states[hyperedgeNodeId('e2')]).toEqual(['inactive']);
    const link = spec.data.edges!.find((e) => e.source === hyperedgeNodeId('e1'))!;
    expect(states[link.id!]).toEqual(['highlight']);
    // 选中实体：含它的超边节点保持常态
    const byNode = selectionStyles(spec, { nodes: ['c'], hyperedges: [] }).states;
    expect(byNode[hyperedgeNodeId('e2')]).toEqual([]);
    expect(byNode[hyperedgeNodeId('e1')]).toEqual(['inactive']);
  });
});
