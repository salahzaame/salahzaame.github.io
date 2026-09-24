// Approximate Jekyll build for local preview (no Ruby on this machine).
import fs from 'node:fs';
import path from 'node:path';
import { Liquid } from 'liquidjs';
import MarkdownIt from 'markdown-it';
import * as yaml from 'js-yaml';
import * as sass from 'sass';

const SRC = path.resolve(import.meta.dirname, '../..');
const OUT = path.resolve('site');
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f), { recursive: true, force: true });

const md = new MarkdownIt({ html: true, typographer: true });
const site = yaml.load(fs.readFileSync(`${SRC}/_config.yml`, 'utf8'));
site.time = new Date();

const engine = new Liquid({
  root: [`${SRC}/_includes`],
  layouts: [`${SRC}/_layouts`],
  extname: '',
  jekyllInclude: true,
  dynamicPartials: false,
});
engine.registerFilter('relative_url', (u) => (site.baseurl || '') + u);
engine.registerFilter('absolute_url', (u) => site.url + (site.baseurl || '') + u);
engine.registerFilter('date_to_xmlschema', (d) => new Date(d).toISOString());
engine.registerFilter('number_of_words', (s) => String(s).split(/\s+/).filter(Boolean).length);
engine.registerFilter('normalize_whitespace', (s) => String(s ?? '').replace(/\s+/g, ' ').trim());
engine.registerTag('feed_meta', { parse() {}, render() { return ''; } });

function parse(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  let fm = {}; if (m) { try { fm = yaml.load(m[1]) || {}; } catch { fm = {}; } }
  return m ? { fm, body: m[2] } : { fm: null, body: raw };
}

async function renderLayouts(page, html) {
  let layoutName = page.layout;
  let content = html;
  while (layoutName) {
    const { fm, body } = parse(`${SRC}/_layouts/${layoutName}.html`);
    content = await engine.parseAndRender(body, { site, page, content });
    layoutName = fm && fm.layout;
  }
  return content;
}

function write(url, html) {
  let rel = url.endsWith('/') ? url + 'index.html' : url;
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
}

// Posts
const posts = fs.readdirSync(`${SRC}/_posts`).filter((f) => f.endsWith('.md')).map((f) => {
  const { fm, body } = parse(`${SRC}/_posts/${f}`);
  const [, y, mo, d, slug] = f.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/);
  const categories = [].concat(fm.categories || []).flatMap((c) => String(c).split(' '));
  // kramdown leaves block HTML alone; markdown-it breaks it at blank lines
  const blocks = [];
  const protectedBody = body.replace(/<div class="mermaid">[\s\S]*?<\/div>/g, (m) => `\n\nMERMAIDBLOCK${blocks.push(m) - 1}\n\n`);
  const html = md.render(protectedBody).replace(/<p>MERMAIDBLOCK(\d+)<\/p>/g, (_, i) => blocks[i]);
  const excerpt = (html.match(/<p>[\s\S]*?<\/p>/) || [''])[0];
  return {
    ...fm, slug, categories, content: html, excerpt,
    date: new Date(fm.date || `${y}-${mo}-${d}`),
    url: `/${categories.join('/')}/${y}/${mo}/${d}/${slug}.html`,
  };
}).sort((a, b) => b.date - a.date);
posts.forEach((p, i) => { p.next = posts[i - 1] || null; p.previous = posts[i + 1] || null; });
site.posts = posts;

// Pages
const pageFiles = ['index.markdown', 'about.markdown', '404.html'];
site.pages = pageFiles.map((f) => {
  const { fm } = parse(`${SRC}/${f}`);
  return { ...fm, path: f, url: fm.permalink || (f.startsWith('index') ? '/' : '/' + f.replace(/\.\w+$/, '.html')) };
});

for (const p of posts) {
  const page = { ...p, layout: p.layout || 'post' };
  write(p.url, await renderLayouts(page, p.content));
}
for (const [i, f] of pageFiles.entries()) {
  const { body } = parse(`${SRC}/${f}`);
  const page = site.pages[i];
  let html = await engine.parseAndRender(body, { site, page });
  if (f.endsWith('.markdown')) html = md.render(html);
  write(page.url, await renderLayouts(page, html));
}

// Assets
const scss = parse(`${SRC}/assets/css/main.scss`).body;
const css = sass.compileString(scss, { loadPaths: [`${SRC}/_sass`], silenceDeprecations: ['import', 'slash-div', 'global-builtin'] }).css;
write('/assets/css/main.css', css);
fs.cpSync(`${SRC}/assets/js`, path.join(OUT, 'assets/js'), { recursive: true });
fs.copyFileSync(`${SRC}/assets/favicon.svg`, path.join(OUT, 'assets/favicon.svg'));
console.log('built', posts.length, 'posts,', pageFiles.length, 'pages →', OUT);
