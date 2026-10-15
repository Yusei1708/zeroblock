/**
 * Test & Verification Suite for ZeroBlock MV3 Rules
 * Validates manifest.json and DeclarativeNetRequest ruleset schemas
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const VALID_RESOURCE_TYPES = new Set([
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
  'font', 'object', 'xmlhttprequest', 'ping', 'csp_report',
  'media', 'websocket', 'webtransport', 'webbundle', 'other'
]);

const VALID_ACTIONS = new Set(['block', 'allow', 'allowAllRequests', 'upgradeScheme']);
const VALID_DOMAIN_TYPES = new Set(['firstParty', 'thirdParty']);

let totalErrors = 0;

function reportError(msg) {
  console.error(`❌ [ERROR] ${msg}`);
  totalErrors++;
}

console.log('🧪 Starting ZeroBlock MV3 Validation Suite...\n');

// 1. Validate manifest.json
console.log('📋 Validating manifest.json...');
try {
  const manifestRaw = fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf-8');
  const manifest = JSON.parse(manifestRaw);

  if (manifest.manifest_version !== 3) reportError('manifest_version must be 3');
  if (!manifest.name) reportError('manifest.name is missing');
  if (!manifest.version) reportError('manifest.version is missing');

  const perms = new Set(manifest.permissions || []);
  if (!perms.has('declarativeNetRequest') && !perms.has('declarativeNetRequestWithHostAccess')) {
    reportError('Missing "declarativeNetRequest" or "declarativeNetRequestWithHostAccess" permission');
  }
  if (perms.has('declarativeNetRequest') && perms.has('declarativeNetRequestWithHostAccess')) {
    reportError('"declarativeNetRequest" and "declarativeNetRequestWithHostAccess" are mutually exclusive in Chrome MV3');
  }

  const hostPerms = manifest.host_permissions || [];
  if (!hostPerms.includes('<all_urls>') && !hostPerms.includes('*://*/*')) {
    reportError('Missing "<all_urls>" in host_permissions');
  }

  const ruleResources = manifest.declarative_net_request?.rule_resources || [];
  if (ruleResources.length < 2) {
    reportError('declarative_net_request.rule_resources must define at least ads_rules and privacy_rules');
  } else {
    for (const res of ruleResources) {
      const fullPath = path.join(rootDir, res.path);
      if (!fs.existsSync(fullPath)) {
        reportError(`Referenced rule file does not exist: ${res.path}`);
      }
    }
  }

  // Check content scripts
  const contentScripts = manifest.content_scripts || [];
  if (contentScripts.length < 2) {
    reportError('Expected at least 2 content script registrations (cosmetic and youtube stealth)');
  }

  console.log('   ✓ manifest.json is valid MV3 specification.\n');
} catch (err) {
  reportError(`Failed reading or parsing manifest.json: ${err.message}`);
}

// 2. Validate rulesets
const ruleFiles = ['rules/ads_rules.json', 'rules/privacy_rules.json'];
const seenGlobalIds = new Set();

for (const relPath of ruleFiles) {
  const fullPath = path.join(rootDir, relPath);
  console.log(`🔍 Validating ${relPath}...`);
  if (!fs.existsSync(fullPath)) {
    reportError(`File missing: ${relPath}`);
    continue;
  }

  try {
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const rules = JSON.parse(raw);

    if (!Array.isArray(rules)) {
      reportError(`${relPath} must be an array of rule objects`);
      continue;
    }

    let fileErrors = 0;
    const seenLocalIds = new Set();
    let hashErrorCount = 0;
    let commaErrorCount = 0;
    let regexErrorCount = 0;
    let asciiErrorCount = 0;

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];

      // Validate ID
      if (typeof rule.id !== 'number' || !Number.isInteger(rule.id) || rule.id < 1) {
        if (fileErrors < 5) reportError(`Rule at index ${i} has invalid id: ${rule.id}`);
        fileErrors++;
      } else {
        if (seenLocalIds.has(rule.id)) {
          if (fileErrors < 5) reportError(`Duplicate rule ID ${rule.id} found within ${relPath}`);
          fileErrors++;
        }
        if (seenGlobalIds.has(rule.id)) {
          if (fileErrors < 5) reportError(`Cross-ruleset duplicate rule ID ${rule.id} found in ${relPath}`);
          fileErrors++;
        }
        seenLocalIds.add(rule.id);
        seenGlobalIds.add(rule.id);
      }

      // Validate Priority
      if (rule.priority !== undefined && (typeof rule.priority !== 'number' || rule.priority < 1)) {
        if (fileErrors < 5) reportError(`Rule ID ${rule.id} has invalid priority: ${rule.priority}`);
        fileErrors++;
      }

      // Validate Action
      if (!rule.action || !VALID_ACTIONS.has(rule.action.type)) {
        if (fileErrors < 5) reportError(`Rule ID ${rule.id} has invalid action: ${JSON.stringify(rule.action)}`);
        fileErrors++;
      }

      // Validate Condition
      if (!rule.condition) {
        if (fileErrors < 5) reportError(`Rule ID ${rule.id} missing condition`);
        fileErrors++;
      } else {
        const uf = rule.condition.urlFilter;

        if (uf !== undefined) {
          if (typeof uf !== 'string' || uf.length === 0) {
            if (fileErrors < 5) reportError(`Rule ID ${rule.id} invalid urlFilter`);
            fileErrors++;
          } else {
            // Check 2.1: Strict ASCII check (0x20 - 0x7E)
            if (!/^[\x20-\x7E]+$/.test(uf)) {
              if (asciiErrorCount < 5) reportError(`Rule ID ${rule.id} urlFilter has non-ASCII characters: "${uf}"`);
              asciiErrorCount++;
              fileErrors++;
            }

            // Check 2.2: Ensure ZERO rules contain '#' in urlFilter (cosmetic rule leakage / invalid fragment)
            if (uf.includes('#')) {
              if (hashErrorCount < 5) reportError(`Rule ID ${rule.id} has forbidden '#' in urlFilter (cosmetic leak): "${uf}"`);
              hashErrorCount++;
              fileErrors++;
            }

            // Check 2.3: Ensure ZERO rules contain unparsed commas or unhandled options
            if (uf.includes(',')) {
              if (commaErrorCount < 5) reportError(`Rule ID ${rule.id} has unparsed comma in urlFilter: "${uf}"`);
              commaErrorCount++;
              fileErrors++;
            }

            // Check 2.4: Ensure ZERO rules contain raw regex syntax in urlFilter
            const isRawRegex = (uf.startsWith('/') && uf.endsWith('/')) ||
              uf.includes('(?:') ||
              uf.includes('(?=') ||
              /\[[0-9a-zA-Z\-_]{3,}\]/.test(uf) ||
              /\\\d|\\w|\\s|\\b/.test(uf) ||
              uf.startsWith('/^') ||
              uf.startsWith('^https?:\\/\\/');

            if (isRawRegex) {
              if (regexErrorCount < 5) reportError(`Rule ID ${rule.id} contains raw regex in urlFilter: "${uf}"`);
              regexErrorCount++;
              fileErrors++;
            }

            // Check 2.5: Ensure ZERO rules violate Chromium DNR urlFilter anchor rules
            if (
              uf.startsWith('||*') ||
              uf.startsWith('||.') ||
              uf.startsWith('||/') ||
              uf.startsWith('||:') ||
              uf.startsWith('|*') ||
              uf.endsWith('*|') ||
              uf.endsWith('^|') ||
              uf.endsWith('|^') ||
              uf.includes('**')
            ) {
              reportError(`Rule ID ${rule.id} violates Chrome urlFilter syntax: "${uf}"`);
              fileErrors++;
            }
          }
        }

        if (rule.condition.domainType && !VALID_DOMAIN_TYPES.has(rule.condition.domainType)) {
          if (fileErrors < 5) reportError(`Rule ID ${rule.id} invalid domainType: ${rule.condition.domainType}`);
          fileErrors++;
        }

        if (rule.condition.resourceTypes) {
          if (!Array.isArray(rule.condition.resourceTypes)) {
            if (fileErrors < 5) reportError(`Rule ID ${rule.id} resourceTypes must be array`);
            fileErrors++;
          } else {
            for (const rType of rule.condition.resourceTypes) {
              if (!VALID_RESOURCE_TYPES.has(rType)) {
                if (fileErrors < 5) reportError(`Rule ID ${rule.id} invalid resourceType: ${rType}`);
                fileErrors++;
              }
            }
          }
        }

        if (rule.condition.initiatorDomains && !Array.isArray(rule.condition.initiatorDomains)) {
          if (fileErrors < 5) reportError(`Rule ID ${rule.id} initiatorDomains must be array`);
          fileErrors++;
        }

        if (rule.condition.excludedInitiatorDomains && !Array.isArray(rule.condition.excludedInitiatorDomains)) {
          if (fileErrors < 5) reportError(`Rule ID ${rule.id} excludedInitiatorDomains must be array`);
          fileErrors++;
        }
      }

      if (fileErrors >= 30) {
        reportError(`Too many errors in ${relPath}. Aborting detailed rule iteration for this file.`);
        break;
      }
    }

    if (hashErrorCount > 0) reportError(`Total rules with '#' in urlFilter in ${relPath}: ${hashErrorCount}`);
    if (commaErrorCount > 0) reportError(`Total rules with unparsed comma in urlFilter in ${relPath}: ${commaErrorCount}`);
    if (regexErrorCount > 0) reportError(`Total rules with raw regex in urlFilter in ${relPath}: ${regexErrorCount}`);
    if (asciiErrorCount > 0) reportError(`Total rules with non-ASCII characters in ${relPath}: ${asciiErrorCount}`);

    totalErrors += fileErrors;
    if (fileErrors === 0) {
      console.log(`   ✓ ${relPath} passed: ${rules.length} valid rules, 0 errors.\n`);
    }
  } catch (err) {
    reportError(`Failed parsing ${relPath}: ${err.message}`);
  }
}

// 3. Validate Cosmetic CSS Sanitization
console.log('🎨 Validating src/cosmetic.css...');
const cosmeticPath = path.join(rootDir, 'src/cosmetic.css');
if (!fs.existsSync(cosmeticPath)) {
  reportError('File missing: src/cosmetic.css');
} else {
  const cssContent = fs.readFileSync(cosmeticPath, 'utf-8');
  if (cssContent.length === 0) {
    reportError('src/cosmetic.css is empty');
  } else {
    // Assert ZERO scriptlets (+js)
    const scriptletMatches = cssContent.match(/\+js\(/g);
    if (scriptletMatches) {
      reportError(`src/cosmetic.css contains ${scriptletMatches.length} forbidden '+js(' scriptlet directives`);
    } else {
      console.log('   ✓ Zero "+js(" scriptlets found.');
    }

    // Assert ZERO procedural pseudo-classes (:has-text, :xpath, :upward, :-abp-)
    const hasTextMatches = cssContent.match(/:has-text\(/g);
    if (hasTextMatches) {
      reportError(`src/cosmetic.css contains ${hasTextMatches.length} forbidden ':has-text(' procedural pseudo-classes`);
    } else {
      console.log('   ✓ Zero ":has-text(" pseudo-classes found.');
    }

    const xpathMatches = cssContent.match(/:xpath\(/g);
    if (xpathMatches) {
      reportError(`src/cosmetic.css contains ${xpathMatches.length} forbidden ':xpath(' procedural pseudo-classes`);
    } else {
      console.log('   ✓ Zero ":xpath(" pseudo-classes found.');
    }

    const upwardMatches = cssContent.match(/:upward\(/g);
    if (upwardMatches) {
      reportError(`src/cosmetic.css contains ${upwardMatches.length} forbidden ':upward(' procedural pseudo-classes`);
    } else {
      console.log('   ✓ Zero ":upward(" pseudo-classes found.');
    }

    // Assert ZERO domain prefixes starting with an unescaped digit
    const digitDomainMatches = cssContent.match(/^[0-9][a-zA-Z0-9_\-\.]+\.[a-z]{2,}\s/gm);
    if (digitDomainMatches) {
      reportError(`src/cosmetic.css contains ${digitDomainMatches.length} invalid domain-prefixed selectors starting with digits`);
    } else {
      console.log('   ✓ Zero invalid digit domain prefixes found.');
    }

    console.log(`   ✓ src/cosmetic.css passed basic structural sanity (${(cssContent.length / 1024).toFixed(1)} KB).\n`);
  }
}

// 4. Validate YouTube Stealth Engine (Zero-Fingerprint Verification)
console.log('📺 Validating src/youtube-stealth.js...');
const ytStealthPath = path.join(rootDir, 'src/youtube-stealth.js');
if (!fs.existsSync(ytStealthPath)) {
  reportError('File missing: src/youtube-stealth.js');
} else {
  const ytContent = fs.readFileSync(ytStealthPath, 'utf-8');

  // Check 4.1: Encapsulated in IIFE
  if (!ytContent.includes('(() => {') && !ytContent.includes('(function() {')) {
    reportError('src/youtube-stealth.js must be encapsulated in an IIFE');
  } else {
    console.log('   ✓ Encapsulated in isolated IIFE closure.');
  }

  // Check 4.2: Strict mode
  if (!ytContent.includes("'use strict';") && !ytContent.includes('"use strict";')) {
    reportError('src/youtube-stealth.js must use strict mode');
  } else {
    console.log('   ✓ Strict mode declared.');
  }

  // Check 4.3: Zero DOM dataset fingerprint (dataset.zbCleaned)
  if (ytContent.includes('dataset.zbCleaned') || ytContent.includes('zbCleaned')) {
    reportError('src/youtube-stealth.js must NOT use "dataset.zbCleaned" (leaks detectable DOM fingerprint)');
  } else {
    console.log('   ✓ Zero DOM dataset fingerprints detected.');
  }

  // Check 4.4: In-memory WeakSet tracking
  if (!ytContent.includes('new WeakSet()')) {
    reportError('src/youtube-stealth.js must use "new WeakSet()" for in-memory element tracking');
  } else {
    console.log('   ✓ In-memory WeakSet tracking confirmed.');
  }

  // Check 4.5: Zero global pollution
  const globalLeak = ytContent.match(/(?:window|document)\.[a-zA-Z0-9_$]+\s*=[^=]/g);
  if (globalLeak) {
    reportError(`src/youtube-stealth.js leaks global properties: ${globalLeak.join(', ')}`);
  } else {
    console.log('   ✓ Zero window/document global assignments.');
  }

  // Check 4.6: Playback rate & volume restoration
  if (!ytContent.includes('originalPlaybackRate')) {
    reportError('src/youtube-stealth.js missing originalPlaybackRate restoration');
  }
  if (!ytContent.includes('wasMutedBeforeAd')) {
    reportError('src/youtube-stealth.js missing wasMutedBeforeAd restoration');
  }
  console.log('   ✓ Playback rate and mute/unmute restoration logic confirmed.\n');
}

// 5. Validate Assets and Scripts Existence
console.log('📄 Validating Other Core Scripts...');
const otherFiles = [
  'src/background.js',
  'src/content-cosmetic.js'
];

for (const rel of otherFiles) {
  const fp = path.join(rootDir, rel);
  if (!fs.existsSync(fp)) {
    console.warn(`   ⚠️ File pending creation: ${rel}`);
  } else {
    const size = fs.statSync(fp).size;
    console.log(`   ✓ ${rel} exists (${(size / 1024).toFixed(1)} KB)`);
  }
}

console.log('\n=======================================');
if (totalErrors === 0) {
  console.log(`🎉 ALL VALIDATION CHECKS PASSED (Total unique rules: ${seenGlobalIds.size})`);
  process.exit(0);
} else {
  console.error(`💥 Validation failed with ${totalErrors} errors.`);
  process.exit(1);
}
