const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX_FILE = path.join(ROOT, 'index.html');
const failures = [];
const warnings = [];

function relative(filePath) {
  return path.relative(ROOT, filePath).replaceAll(path.sep, '/');
}

function listHtmlFiles() {
  return fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => path.join(ROOT, entry.name))
    .sort();
}

function validateInlineScripts(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const scriptPattern = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let scriptNumber = 0;

  while ((match = scriptPattern.exec(html)) !== null) {
    scriptNumber += 1;
    const source = match[1].trim();
    if (!source) continue;

    try {
      // Parse only. The browser-dependent code is intentionally not executed.
      new Function(source);
    } catch (error) {
      failures.push(`${relative(filePath)} inline script ${scriptNumber}: ${error.message}`);
    }
  }
}

function validateGalleryLinks(htmlFiles) {
  const index = fs.readFileSync(INDEX_FILE, 'utf8');
  const hrefPattern = /href=["']([^"']+\.html(?:[?#][^"']*)?)["']/gi;
  const linkedFiles = new Set();
  let match;

  while ((match = hrefPattern.exec(index)) !== null) {
    const target = match[1].split(/[?#]/, 1)[0];
    linkedFiles.add(target);
    if (!fs.existsSync(path.join(ROOT, target))) {
      failures.push(`index.html links to missing file: ${target}`);
    }
  }

  for (const filePath of htmlFiles) {
    const name = path.basename(filePath);
    if (name !== 'index.html' && !linkedFiles.has(name)) {
      warnings.push(`animation is not linked from index.html: ${name}`);
    }
  }
}

const htmlFiles = listHtmlFiles();
for (const filePath of htmlFiles) validateInlineScripts(filePath);
validateGalleryLinks(htmlFiles);

console.log(`Validated ${htmlFiles.length} HTML files.`);

if (warnings.length > 0) {
  console.warn(`\nWarnings (${warnings.length}):`);
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (failures.length > 0) {
  console.error(`\nFailures (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('\nValidation passed.');
}
