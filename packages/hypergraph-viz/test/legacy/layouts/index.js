/**
 * 注册超图布局：同一超边的实体尽量挨在一起，非成员被推出超边轮廓
 * hypergraphLayout.js、bubbleSetsKey.js 由 G6 仓库 hypergraph/build-hypergraph-layout.mjs 生成，请勿手改
 */
import { ExtensionCategory, register } from '@antv/g6';
import { HypergraphLayout } from './hypergraphLayout.js';

export const HYPERGRAPH_LAYOUT = 'hypergraph';

register(ExtensionCategory.LAYOUT, HYPERGRAPH_LAYOUT, HypergraphLayout);
