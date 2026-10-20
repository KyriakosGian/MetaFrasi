import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {version} = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid release version.');
const files = ['manifest.json','background.js','content.js','selection.js','options.html','options.js','options.css','LICENSE',
  'shared/core.js','shared/gemini.js','shared/service.js',
  'icons/icon16.png','icons/icon32.png','icons/icon48.png','icons/icon128.png','icons/logo.svg',
  'docs/privacy.html','docs/support.html','docs/index.html','docs/site.css','docs/site.js','docs/assets/logo.svg'];
for (const file of files) {
  let checkedPath = root;
  for (const segment of file.split('/')) {
    checkedPath = path.join(checkedPath, segment);
    if (fs.lstatSync(checkedPath).isSymbolicLink()) throw new Error(`Symbolic links are not allowed in release files: ${file}`);
  }
  if (!fs.lstatSync(path.join(root, file)).isFile()) throw new Error(`Expected a regular runtime file: ${file}`);
}
const table = Array.from({length:256}, (_, n) => {
  let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff; for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0;
}
const localParts = [], centralParts = [];
let offset = 0;
const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
for (const filename of files.sort()) {
  const name = Buffer.from(filename); const raw = fs.readFileSync(path.join(root, filename));
  const compressed = deflateRawSync(raw, {level:9}); const crc = crc32(raw);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20,4); local.writeUInt16LE(0x800,6); local.writeUInt16LE(8,8); local.writeUInt16LE(dosDate,12);
  local.writeUInt32LE(crc,14); local.writeUInt32LE(compressed.length,18); local.writeUInt32LE(raw.length,22); local.writeUInt16LE(name.length,26);
  localParts.push(local,name,compressed);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20,4); central.writeUInt16LE(20,6); central.writeUInt16LE(0x800,8); central.writeUInt16LE(8,10); central.writeUInt16LE(dosDate,14);
  central.writeUInt32LE(crc,16); central.writeUInt32LE(compressed.length,20); central.writeUInt32LE(raw.length,24); central.writeUInt16LE(name.length,28); central.writeUInt32LE(offset,42);
  centralParts.push(central,name); offset += local.length + name.length + compressed.length;
}
const central = Buffer.concat(centralParts), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length,8); end.writeUInt16LE(files.length,10); end.writeUInt32LE(central.length,12); end.writeUInt32LE(offset,16);
const zip = Buffer.concat([...localParts,central,end]);
const directory = path.join(root, 'dist'); fs.mkdirSync(directory,{recursive:true});
const output = `metafrasi-${version}.zip`;
fs.writeFileSync(path.join(directory, output), zip);
fs.writeFileSync(path.join(directory, output + '.sha256'), `${createHash('sha256').update(zip).digest('hex')}  ${output}\n`);
console.log(`Built dist/${output}: ${files.length} files, ${zip.length} bytes.`);
