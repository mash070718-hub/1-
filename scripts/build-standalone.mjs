import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('..', import.meta.url));
const catalogPath = path.join(root, 'src/data/catalog.json');
const virtualCatalogId = '\0library-offline-catalog';
const outputPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(root, '../library-files/Library-of-Limbus.html');

// Use the official thumbnail once for each artwork. The source catalog and the
// normal website retain their full-resolution images; only this offline build
// uses the smaller art so the complete library fits in one downloadable file.
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
if (!Array.isArray(catalog.entries) || !catalog.entries.length) {
  throw new Error('The official catalog must contain entries before building the offline library.');
}
const embeddedImages = [];
const imageIndexes = new Map();
const bundledEntries = [];
for (const entry of catalog.entries) {
  if (typeof entry.thumbnail !== 'string' || !entry.thumbnail.startsWith('/images/catalog/')) {
    throw new Error(`Missing local catalog thumbnail: ${entry.id}`);
  }
  let index = imageIndexes.get(entry.thumbnail);
  if (index === undefined) {
    const imagePath = path.resolve(root, 'public', entry.thumbnail.slice(1));
    const allowedDirectory = `${path.resolve(root, 'public/images/catalog')}${path.sep}`;
    if (!imagePath.startsWith(allowedDirectory)) {
      throw new Error(`Catalog thumbnail is outside the supported directory: ${entry.id}`);
    }
    const mime = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }[path.extname(imagePath).toLowerCase()];
    if (!mime) throw new Error(`Unsupported thumbnail format: ${entry.thumbnail}`);
    const bytes = await readFile(imagePath);
    index = embeddedImages.length;
    imageIndexes.set(entry.thumbnail, index);
    embeddedImages.push(`data:${mime};base64,${bytes.toString('base64')}`);
  }
  bundledEntries.push({ ...entry, image: index, thumbnail: index });
}

const transformedCatalog = JSON.stringify({ ...catalog, entries: bundledEntries });
const catalogModule = `
const catalog = ${transformedCatalog};
const images = ${JSON.stringify(embeddedImages)};
catalog.entries = catalog.entries.map(entry => ({ ...entry, image: images[entry.image], thumbnail: images[entry.thumbnail] }));
export const entries = catalog.entries;
export const metadata = catalog.metadata;
export default catalog;
`;

const result = await build({
  root,
  configFile: false,
  mode: 'production',
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  logLevel: 'warn',
  plugins: [
    {
      name: 'library-offline-catalog',
      enforce: 'pre',
      resolveId(source, importer) {
        const candidate = source.startsWith('.') && importer
          ? path.resolve(path.dirname(importer.split('?')[0]), source)
          : source.split('?')[0];
        if (candidate === catalogPath) return virtualCatalogId;
      },
      load(id) {
        if (id === virtualCatalogId) return catalogModule;
      },
    },
    react(),
  ],
  build: {
    write: false,
    copyPublicDir: false,
    sourcemap: false,
    minify: 'esbuild',
    cssCodeSplit: false,
    assetsInlineLimit: Infinity,
    lib: {
      entry: path.join(root, 'src/main.tsx'),
      name: 'LibraryOfLimbus',
      formats: ['iife'],
      fileName: () => 'library.js',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});

const outputs = (Array.isArray(result) ? result : [result]).flatMap(item => item.output ?? []);
const javascript = outputs.filter(item => item.type === 'chunk');
const styles = outputs.filter(item => item.type === 'asset' && item.fileName.endsWith('.css'));
const externalAssets = outputs.filter(item => item.type === 'asset' && !item.fileName.endsWith('.css'));
if (javascript.length !== 1 || externalAssets.length) {
  throw new Error(`Offline build must contain one script and inline styles; unexpected output: ${outputs.map(item => item.fileName).join(', ')}`);
}
const css = styles.map(item => typeof item.source === 'string' ? item.source : Buffer.from(item.source).toString('utf8')).join('\n');
if (/url\(\s*["']?(?:https?:|\/images\/)/i.test(css)) {
  throw new Error('An external image or stylesheet asset remains in the offline bundle.');
}
const safeCss = css.replace(/<\/style/gi, '<\\/style');
const safeJavascript = javascript[0].code.replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="림버스 컴퍼니 인격 · E.G.O · 덱을 정리하는 개인 기록 도서관">
  <title>Library of Limbus — 개인 기록 도서관</title>
  <style>${safeCss}</style>
</head>
<body>
  <div id="root"></div>
  <noscript>도서관을 사용하려면 브라우저의 JavaScript를 켜 주세요.</noscript>
  <script>${safeJavascript}</script>
</body>
</html>
`;
const bytes = Buffer.byteLength(html, 'utf8');
if (bytes > 20 * 1024 * 1024) {
  throw new Error(`Offline bundle exceeds 20 MiB (${(bytes / 1024 / 1024).toFixed(2)} MiB); check thumbnail sizes before sharing.`);
}
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, 'utf8');
console.log(`Offline library: ${outputPath}`);
console.log(`${catalog.entries.length} official records · ${embeddedImages.length} embedded artworks · ${(bytes / 1024 / 1024).toFixed(2)} MiB`);
