/**
 * 把 <script> 版（dist/hypergraph-viz.global.js）拷到不经 npm 引用本包的项目中，并在文件头注明来源与版本
 * Copy the <script> build into projects that vendor it instead of installing from npm
 *
 * 用法 / Usage: node scripts/copy-global.mjs <dir> [<dir> ...]
 *   npm run sync:hypergraph-db  # → ../../../Hypergraph-DB/hyperdb/templates
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const name = 'hypergraph-viz.global.js';
const dirs = process.argv.slice(2);
if (dirs.length === 0) throw new Error('usage: node scripts/copy-global.mjs <dir> [<dir> ...]');

const header = `/* hypergraph-viz@${version}：由 HypergraphViewer/packages/hypergraph-viz 构建（npm run build）后经 scripts/copy-global.mjs 拷入，请勿手改。
 * 需先引入 G6 的 UMD 包（window.G6），全局变量为 window.HypergraphViz */
`;
const code = fs.readFileSync(path.join(root, 'dist', name), 'utf8').replace(/\n\/\/# sourceMappingURL=.*\n?$/, '\n');
for (const dir of dirs) {
  const out = path.join(path.resolve(dir), name);
  fs.writeFileSync(out, header + code);
  console.log(`${name} → ${out}`);
}
