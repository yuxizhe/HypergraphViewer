/**
 * 关联矩阵导出为 SVG（V-mat）：MR 编号、列标签上下各一遍、行编号在右侧、MR 下不显示度数、枢纽虚线圈、转义
 */
import { describe, expect, it } from 'vitest';
import { incidenceMatrixSVG, modelReadableKey } from '../src';
import type { HypergraphData } from '../src';

const data: HypergraphData = {
  vertices: { hub: {}, 'a<b': {}, c: {}, d: {} },
  hyperedges: [
    { id: 'h1', members: ['hub', 'a<b', 'c'], description: 'first & only' },
    { id: 'h2', members: ['hub', 'd'] },
  ],
};
const count = (s: string, sub: string) => s.split(sub).length - 1;

describe('incidenceMatrixSVG', () => {
  it('labels rows and columns with the canvas codes in MR mode', () => {
    const { svg, width, height } = incidenceMatrixSVG(data, { modelReadable: true, hubNodes: ['hub'] });
    const key = modelReadableKey(data);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    key.hyperedges.forEach((code) => expect(count(svg, `>${code}</text>`)).toBe(2));
    // 行标签含编号与名称（转义），右侧再标一次编号
    expect(svg).toContain(`>${key.vertices.get('a<b')} a&lt;b</text>`);
    expect(count(svg, `>${key.vertices.get('c')}</text>`)).toBe(1);
    expect(svg).toContain('stroke-dasharray');
    // 3 + 2 个成员点
    expect(count(svg, '<circle cx="')).toBeGreaterThanOrEqual(5 + 4);
  });

  it('shows degrees and descriptions outside MR mode', () => {
    const { svg } = incidenceMatrixSVG(data);
    expect(svg).toContain('first &amp; only');
    expect(svg).toMatch(/text-anchor="end">2</);
  });

  it('hides degrees in MR mode unless asked', () => {
    expect(incidenceMatrixSVG(data, { modelReadable: true }).svg).not.toMatch(/text-anchor="end">/);
    expect(incidenceMatrixSVG(data, { modelReadable: true, showDegree: true }).svg).toMatch(/text-anchor="end">2</);
  });
});
