/**
 * ZeroBlock - Package Extension Script for Chrome Web Store distribution
 * 
 * Creates an optimized, production-ready ZIP archive in dist/ containing
 * only runtime extension files compliant with Google Manifest V3 policies.
 * 
 * @module scripts/package-extension
 * @author Yusei1708
 * @license GPL-3.0
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
  const fileBuffer = fs.readFileSync(zipPath);
  const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  let totalRawBytes = 0;
  console.log('   Package contents:');
  for (const f of filesToInclude) {
    const full = path.join(rootDir, f);
    const sz = fs.statSync(full).size;
    totalRawBytes += sz;
    console.log(`     - ${f.padEnd(26)} ${(sz / 1024).toFixed(1)} KB`);
  }

  const ratio = totalRawBytes > 0 ? ((1 - stats.size / totalRawBytes) * 100).toFixed(1) : '0.0';

  console.log(`\n✅ Extension package generated successfully!`);
  console.log(`   File: ${path.relative(rootDir, zipPath)}`);
  console.log(`   Size: ${sizeMB > 1 ? sizeMB + ' MB' : sizeKB + ' KB'} (Compressed: ${ratio}%)`);
  console.log(`   SHA256: ${sha256}`);
  console.log(`   Included files: ${filesToInclude.length}`);
  console.log(`\nReady to upload to Chrome Web Store Developer Dashboard.`);
} catch (err) {
  console.error(`❌ Packaging failed:`, err.message);
  process.exit(1);
}
