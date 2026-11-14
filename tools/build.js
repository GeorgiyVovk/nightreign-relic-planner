// Builds the planner from src/planner.html into two targets:
//   dist/web  - the website (GitHub Pages): plain page, bundled fonts
//   dist/app  - the desktop app (Tauri): same page plus the bridge that lets it list, read and watch save files
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src', 'planner.html'), 'utf8');

const FONTS = [
  ['Inter', '@fontsource/inter', 'inter', [400, 500, 600, 700]],
  ['Cinzel', '@fontsource/cinzel', 'cinzel', [600, 700]],
  ['IBM Plex Mono', '@fontsource/ibm-plex-mono', 'ibm-plex-mono', [400, 500, 600]],
];

function writeFonts(dir) {
  const out = path.join(dir, 'fonts');
  fs.mkdirSync(out, { recursive: true });
  let css = '';
  for (const [family, pkg, stem, weights] of FONTS) {
    for (const w of weights) {
      const file = `${stem}-latin-${w}-normal.woff2`;
      fs.copyFileSync(path.join(root, 'node_modules', pkg, 'files', file), path.join(out, file));
      css += `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:swap;src:url('${file}') format('woff2')}\n`;
    }
  }
  fs.writeFileSync(path.join(out, 'fonts.css'), css);
}

function page({ csp, extraHead = '', htmlAttrs = '' }) {
  let body = src
    .replace(/<link rel="preconnect"[^>]*>\n?/g, '')
    .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\n?/, '<link rel="stylesheet" href="fonts/fonts.css">\n');
  if (/fonts\.googleapis/.test(body)) throw new Error('Google Fonts link left in the page');
  const i = body.indexOf('</style>') + '</style>'.length;
  return `<!doctype html>
<html lang="en"${htmlAttrs}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${csp ? `<meta http-equiv="Content-Security-Policy" content="${csp}">\n` : ''}${extraHead}${body.slice(0, i)}
<style>body{margin:0}img{max-width:100%}</style>
</head>
<body>
${body.slice(i)}
</body>
</html>
`;
}

function build(name, html, extra = {}) {
  const dir = path.join(root, 'dist', name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  writeFonts(dir);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  for (const [file, from] of Object.entries(extra)) fs.copyFileSync(from, path.join(dir, file));
  console.log(`dist/${name}/index.html`, html.length, 'bytes');
}

const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:";
build('web', page({ csp: CSP + "; connect-src 'self'" }), { '.nojekyll': path.join(root, 'tools', 'nojekyll') });
build('app', page({ extraHead: '<script src="app-bridge.js"></script>\n', htmlAttrs: ' data-theme="dark"' }), { 'app-bridge.js': path.join(root, 'tools', 'app-bridge.js') });
