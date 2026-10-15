/**
 * Package Extension Script for Chrome Web Store distribution
 * Creates a clean, production-ready ZIP archive in dist/
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const manifestPath = path.join(rootDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
const version = manifest.version || '1.0.0';
const zipName = `zeroblock-v${version}.zip`;
const zipPath = path.join(distDir, zipName);

// Delete existing zip if present
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

console.log(`📦 Packaging ZeroBlock v${version}...`);

// Included runtime files
const filesToInclude = [
  'manifest.json',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
  'rules/ads_rules.json',
  'rules/privacy_rules.json',
  'src/background.js',
  'src/content-cosmetic.js',
  'src/cosmetic.css',
  'src/youtube-stealth.js'
];

// Validate all files exist before zipping
for (const f of filesToInclude) {
  const full = path.join(rootDir, f);
  if (!fs.existsSync(full)) {
    console.error(`❌ Missing mandatory file: ${f}`);
    process.exit(1);
  }
}

try {
  // Use zip command with optimal compression
  const cmd = `zip -9 -r "${zipPath}" ${filesToInclude.map(f => `"${f}"`).join(' ')}`;
  execSync(cmd, { cwd: rootDir, stdio: 'pipe' });

  const stats = fs.statSync(zipPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  const sizeKB = (stats.size / 1024).toFixed(1);

  console.log(`✅ Extension package generated successfully!`);
  console.log(`   File: ${path.relative(rootDir, zipPath)}`);
  console.log(`   Size: ${sizeMB > 1 ? sizeMB + ' MB' : sizeKB + ' KB'}`);
  console.log(`   Included files: ${filesToInclude.length}`);
  console.log(`\nReady to upload to Chrome Web Store Developer Dashboard.`);
} catch (err) {
  console.error(`❌ Packaging failed:`, err.message);
  process.exit(1);
}
