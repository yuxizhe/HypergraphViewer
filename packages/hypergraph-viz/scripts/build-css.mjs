// 编译 src/explorer/style.css → dist/style.css：Tailwind（主题、预置样式、用到的工具类），
// 工具类去掉 @layer（宿主不在层里的样式会盖过层里的），选择器限定在 .hv-root 下，不影响宿主页面
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const from = resolve(root, 'src/explorer/style.css');
const to = resolve(root, 'dist/style.css');
const SCOPE = '.hv-root';

// :root / :host / html / body 换成 .hv-root 本身，其余选择器加上 .hv-root 前缀
const scopeSelector = (sel) => {
  const s = sel.trim();
  if (/^(:root|:host|html|body)\b/.test(s)) return s.replace(/^(:root|:host|html|body)(\([^)]*\))?/, SCOPE);
  return `${SCOPE} ${s}`;
};

const scope = () => ({
  postcssPlugin: 'hv-scope',
  OnceExit(css) {
    // 预置样式留在 @layer hv-base：宿主放进插槽的内容用宿主自己的工具类（Tailwind 4 在层里，本样式先引入时）能盖过它；
    // 不叫 base，Tailwind 3 的宿主会把 @layer base 当作自己的指令而报错。其余去掉层
    css.walkAtRules('layer', (rule) => {
      if (rule.params === 'hv-base' && rule.nodes) return;
      if (rule.nodes) rule.replaceWith(rule.nodes);
      else rule.remove();
    });
    css.walkRules((rule) => {
      // @keyframes 中的 from / to / 百分比不是选择器；嵌套规则（&）随外层
      if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
      if (/(^|[^\\])&/.test(rule.selector)) return;
      rule.selectors = [...new Set(rule.selectors.map(scopeSelector))];
    });
  },
});
scope.postcss = true;

const css = await readFile(from, 'utf8');
const result = await postcss([tailwind({ base: root, optimize: { minify: false } }), scope]).process(css, { from, to });
await mkdir(dirname(to), { recursive: true });
await writeFile(to, result.css);
console.log(`style.css ${(result.css.length / 1024).toFixed(1)} KB`);
