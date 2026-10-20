import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {VERSION} from '../shared/core.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(manifest.version, pkg.version); assert.equal(manifest.version, VERSION);
const optionsHtml = fs.readFileSync(path.join(root, 'options.html'), 'utf8');
assert.ok(optionsHtml.includes(`id="version">v${VERSION}<`));
assert.ok(optionsHtml.includes(`id="footer-version">${VERSION}<`));
assert.ok(fs.readFileSync(path.join(root, 'README.md'), 'utf8').includes(`Version **${VERSION}**`));
assert.ok(fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8').includes(`MetaFrasi v${VERSION}`));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['storage']);
assert.deepEqual(manifest.host_permissions, ['https://generativelanguage.googleapis.com/*']);
const runtime = ['background.js', 'content.js', 'selection.js', 'options.js', 'options.html', 'options.css', ...Object.values(manifest.icons), 'docs/privacy.html'];
for (const file of runtime) assert.ok(fs.existsSync(path.join(root, file)), `Missing runtime file: ${file}`);
function walk(folder) {
  return fs.readdirSync(folder, {withFileTypes:true}).flatMap(entry => {
    if (['.git', 'node_modules', 'dist', 'artifacts'].includes(entry.name)) return [];
    const full = path.join(folder, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
let checked = 0;
for (const file of walk(root)) {
  if (/\.(?:m?js)$/.test(file)) { execFileSync(process.execPath, ['--check', file], {stdio:'pipe'}); checked++; }
  if (/\.(?:html|js|mjs|json|md|yml|css)$/.test(file)) {
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(!/AIza[0-9A-Za-z_-]{30,}/.test(source), `Possible real API key in ${path.relative(root, file)}`);
    assert.ok(!/C:\\Users\\|AppData[\\/]|\.codex[\\/]/.test(source), `Local personal path in ${path.relative(root, file)}`);
    if (file.endsWith('.md')) {
      for (const match of source.matchAll(/!?\[[^\]]*\]\(([^\s)]+)\)/g)) {
        const link = match[1].split('#')[0];
        if (!link || /^(https?:|mailto:)/.test(link)) continue;
        assert.ok(fs.existsSync(path.resolve(path.dirname(file), link)), `Broken Markdown link in ${path.relative(root, file)}: ${link}`);
      }
    }
    if (file.endsWith('.html')) {
      assert.match(source, /<html lang="en"/);
      for (const match of source.matchAll(/(?:href|src)="([^"#]+)"/g)) {
        const link = match[1].split('#')[0];
        const release = link.match(/MetaFrasi\/releases\/download\/v([^/]+)\/metafrasi-([^/]+)\.zip$/);
        if (release) { assert.equal(release[1], VERSION); assert.equal(release[2], VERSION); }
        if (/^(https?:|mailto:|data:)/.test(link)) continue;
        const resolved = path.resolve(path.dirname(file), link === './' ? 'index.html' : link);
        assert.ok(fs.existsSync(resolved), `Broken local link in ${path.relative(root, file)}: ${link}`);
      }
    }
  }
}
for (const [filename, width, height] of [
  ['icons/icon128.png',128,128], ['store-assets/promo-small.png',440,280],
  ...['translation','summary','settings'].map(name => [`store-assets/screenshots/${name}.png`,1280,800])
]) {
  const png = fs.readFileSync(path.join(root, filename));
  assert.equal(png.subarray(0,8).toString('hex'), '89504e470d0a1a0a', `Invalid PNG: ${filename}`);
  assert.equal(png.readUInt32BE(16), width, `Incorrect image width: ${filename}`);
  assert.equal(png.readUInt32BE(20), height, `Incorrect image height: ${filename}`);
}
console.log(`Checks passed: ${checked} JavaScript files, runtime assets, English documents, local links, version consistency and secret-pattern scan.`);
