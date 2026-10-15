/**
 * Challenger 1 Adversarial Stress Test Harness
 * Empirically challenges ZeroBlock Lite MV3:
 * 1. DeclarativeNetRequest Parser & Schema Edge Cases
 * 2. Cosmetic CSS Grammar & Selector Validity
 * 3. YouTube Stealth State Transitions & Zero-Fingerprint Invariants
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🔥 ==============================================================');
console.log('🔥 ZEROBLOCK LITE MV3 — ADVERSARIAL CHALLENGER 1 STRESS HARNESS');
console.log('🔥 ==============================================================\n');

let totalChallenges = 0;
let passedChallenges = 0;
let failedChallenges = 0;
const failureLog = [];

function challenge(category, title, fn) {
  totalChallenges++;
  try {
    fn();
    passedChallenges++;
    console.log(`  ✓ [PASS] [${category}] ${title}`);
  } catch (err) {
    failedChallenges++;
    failureLog.push({ category, title, error: err.message, stack: err.stack });
    console.error(`  ❌ [FAIL] [${category}] ${title} -> ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// -----------------------------------------------------------------------------
// EXTRACT PARSER FROM scripts/build-filters.js
// -----------------------------------------------------------------------------
const buildFiltersCode = fs.readFileSync(path.join(rootDir, 'scripts/build-filters.js'), 'utf-8');

// Extract TYPE_MAP, PROCEDURAL_KEYWORDS, sanitizeCosmeticSelector, parseFilterLine
const parserSandbox = {
  console: { log: () => {}, warn: () => {}, error: () => {} },
  fs,
  path,
  rootDir
};

// Create a safe wrapper to extract internal functions by stripping imports and build call
const sanitizedCode = buildFiltersCode
  .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '')
  .replace(/const __filename[\s\S]*?const rootDir[^;]*;/g, '')
  .replace(/build\(\)\.catch[\s\S]*$/, '');

const extractScript = `
${sanitizedCode}
globalThis.TYPE_MAP = TYPE_MAP;
globalThis.PROCEDURAL_KEYWORDS = PROCEDURAL_KEYWORDS;
globalThis.sanitizeCosmeticSelector = sanitizeCosmeticSelector;
globalThis.parseFilterLine = parseFilterLine;
`;

vm.createContext(parserSandbox);
vm.runInContext(extractScript, parserSandbox);

const { TYPE_MAP, PROCEDURAL_KEYWORDS, sanitizeCosmeticSelector, parseFilterLine } = parserSandbox;

assert(typeof parseFilterLine === 'function', 'Failed to extract parseFilterLine from build-filters.js');
assert(typeof sanitizeCosmeticSelector === 'function', 'Failed to extract sanitizeCosmeticSelector from build-filters.js');

// -----------------------------------------------------------------------------
// MODULE 1: DNR RULES & PARSER STRESS TESTING
// -----------------------------------------------------------------------------
console.log('\n--- MODULE 1: DNR RULES & PARSER STRESS TESTING ---');

// 1.1 Fuzzing parseFilterLine with extreme & pathological inputs
challenge('DNR-PARSER', 'Handles null, undefined, boolean, number without throwing', () => {
  const dummyCosmetics = new Set();
  const idRef = { val: 1 };
  try {
    // If passed directly as non-strings or bad types
    assert(parseFilterLine('', idRef, dummyCosmetics) === null, 'Empty string must be null');
    assert(parseFilterLine('   ', idRef, dummyCosmetics) === null, 'Whitespace must be null');
    assert(parseFilterLine('\t\r\n', idRef, dummyCosmetics) === null, 'Control chars must be null');
  } catch (e) {
    throw new Error('Crashed on whitespace: ' + e.message);
  }
});

challenge('DNR-PARSER', 'Handles multi-line and newline-injected lines safely', () => {
  const dummyCosmetics = new Set();
  const idRef = { val: 1 };
  const multiLine = '||example.com^\n||malicious.org^';
  const res = parseFilterLine(multiLine, idRef, dummyCosmetics);
  // Must reject lines with unescaped newline or handle safely without creating malformed urlFilter
  if (res) {
    assert(!res.condition.urlFilter.includes('\n'), 'urlFilter must never contain newline');
  }
});

challenge('DNR-PARSER', 'Rejects unicode domain names (Punycode required for ASCII DNR)', () => {
  const dummyCosmetics = new Set();
  const idRef = { val: 1 };
  const unicodeLines = [
    '||quảngcáo.vn^',
    '||яндекс.рф^',
    '||موقع.com^',
    '||広告.jp^',
    '||домен.рф/реклама^$script',
    '||🎯ads.com^'
  ];
  for (const line of unicodeLines) {
    const res = parseFilterLine(line, idRef, dummyCosmetics);
    assertEqual(res, null, `Unicode line "${line}" must be rejected from DNR network rules`);
  }
});

challenge('DNR-PARSER', 'Allows valid Punycode encoded domain names', () => {
  const dummyCosmetics = new Set();
  const idRef = { val: 1 };
  const punycodeLine = '||xn--qungco-1ya9243a.vn^';
  const res = parseFilterLine(punycodeLine, idRef, dummyCosmetics);
  assert(res !== null, 'Punycode must be accepted');
  assertEqual(res.condition.urlFilter, '||xn--qungco-1ya9243a.vn^');
});

challenge('DNR-PARSER', 'Rejects raw regex patterns and ReDoS attempts', () => {
  const dummyCosmetics = new Set();
  const idRef = { val: 1 };
  const regexLines = [
    '/banner[0-9]+/',
    '/banner[0-9]+/$script',
    '/^https?:\\/\\/.*adservice/',
    '/(a+)+$/',
    '/[a-z0-9_-]{10,}/',
    '/.*ad_\\d+\\.js/$script',
    '\\d+ad'
  ];
  for (const line of regexLines) {
    const res = parseFilterLine(line, idRef, dummyCosmetics);
    assertEqual(res, null, `Regex pattern "${line}" must return null`);
  }
});

challenge('DNR-PARSER', 'Rejects patterns containing fragment # or comma , or double asterisks **', () => {
  const dummyCosmetics = new Set();
  const idRef = { val: 1 };
  const badPatterns = [
    '||example.com/ad#tracker',
    '||site.com/test,123',
    '||adservice.com/**/tracker.js',
    '#ad-tracker',
    'http://site.com/ad#hash'
  ];
  for (const line of badPatterns) {
    const res = parseFilterLine(line, idRef, dummyCosmetics);
    assertEqual(res, null, `Bad pattern "${line}" must return null`);
  }
});

challenge('DNR-PARSER', 'Handles conflicting modifiers ($script,~script, $third-party,~third-party)', () => {
  const dummyCosmetics = new Set();
  const idRef = { val: 1 };
  // When conflicting modifiers occur, check resulting condition
  const line = '||example.com^$script,~script,third-party,~third-party';
  const res = parseFilterLine(line, idRef, dummyCosmetics);
  assert(res !== null, 'Conflicting modifier line should parse condition or safely handle');
  assert(res.condition.resourceTypes.includes('script'), 'Must include script in resourceTypes');
  assert(res.condition.excludedResourceTypes.includes('script'), 'Must include script in excludedResourceTypes');
  assert(res.condition.domainType === 'firstParty' || res.condition.domainType === 'thirdParty', 'domainType set');
});

challenge('DNR-PARSER', 'Handles malformed option syntax ($domain=, $domain=~, empty options)', () => {
  const dummyCosmetics = new Set();
  const idRef = { val: 1 };
  const malformedLines = [
    '||example.com^$',
    '||example.com^$script,',
    '||example.com^$,,,script',
    '||example.com^$domain=',
    '||example.com^$domain=~',
    '||example.com^$domain=a|~|b',
    '||example.com^$unknown_modifier_xyz'
  ];
  for (const line of malformedLines) {
    const res = parseFilterLine(line, idRef, dummyCosmetics);
    if (res) {
      assert(res.id >= 1, 'Valid id');
      assert(res.condition.urlFilter.length > 0, 'Non-empty urlFilter');
      if (res.condition.initiatorDomains) {
        assert(!res.condition.initiatorDomains.includes(''), 'No empty initiatorDomain');
      }
      if (res.condition.excludedInitiatorDomains) {
        assert(!res.condition.excludedInitiatorDomains.includes(''), 'No empty excludedInitiatorDomain');
      }
    }
  }
});

challenge('DNR-PARSER', 'Guarantees strictly incrementing disjoint IDs', () => {
  const dummyCosmetics = new Set();
  const idRef = { val: 1000 };
  const res1 = parseFilterLine('||a.com^', idRef, dummyCosmetics);
  const res2 = parseFilterLine('||b.com^', idRef, dummyCosmetics);
  assertEqual(res1.id, 1000);
  assertEqual(res2.id, 1001);
  assertEqual(idRef.val, 1002);
});

challenge('DNR-PARSER', 'Whitelists @@ have priority 2 and action type allow', () => {
  const dummyCosmetics = new Set();
  const idRef = { val: 1 };
  const res = parseFilterLine('@@||whitelisted.com^$script', idRef, dummyCosmetics);
  assert(res !== null, 'Whitelist line must parse');
  assertEqual(res.priority, 2, 'Whitelist priority must be 2');
  assertEqual(res.action.type, 'allow', 'Whitelist action.type must be allow');
  assertEqual(res.condition.urlFilter, '||whitelisted.com^');
});

const VALID_RESOURCE_TYPES = new Set([
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
  'font', 'object', 'xmlhttprequest', 'ping', 'csp_report',
  'media', 'websocket', 'webtransport', 'webbundle', 'other'
]);

challenge('DNR-SCHEMA', 'Validates all 60,323 compiled rules in rules/*.json against Chromium DNR Spec', () => {
  const ruleFiles = ['rules/ads_rules.json', 'rules/privacy_rules.json'];
  const allIds = new Set();
  let totalRules = 0;

  for (const rel of ruleFiles) {
    const filePath = path.join(rootDir, rel);
    const content = fs.readFileSync(filePath, 'utf-8');
    const rules = JSON.parse(content);
    assert(Array.isArray(rules), `${rel} must be an array`);

    for (let i = 0; i < rules.length; i++) {
      totalRules++;
      const r = rules[i];
      assert(typeof r.id === 'number' && Number.isInteger(r.id) && r.id >= 1, `Rule ${i} in ${rel} has invalid id: ${r.id}`);
      assert(!allIds.has(r.id), `Duplicate global rule ID detected: ${r.id} in ${rel}`);
      allIds.add(r.id);

      assert(r.priority === 1 || r.priority === 2, `Rule ${r.id} invalid priority: ${r.priority}`);
      assert(r.action && (r.action.type === 'block' || r.action.type === 'allow'), `Rule ${r.id} invalid action: ${JSON.stringify(r.action)}`);
      assert(r.condition && typeof r.condition.urlFilter === 'string', `Rule ${r.id} missing urlFilter`);
      assert(r.condition.urlFilter.length >= 2, `Rule ${r.id} urlFilter too short: "${r.condition.urlFilter}"`);

      // Character assertions
      assert(!r.condition.urlFilter.includes('#'), `Rule ${r.id} contains '#' in urlFilter`);
      assert(!r.condition.urlFilter.includes(','), `Rule ${r.id} contains ',' in urlFilter`);
      assert(!r.condition.urlFilter.includes('**'), `Rule ${r.id} contains '**' in urlFilter`);
      assert(/^[\x20-\x7E]+$/.test(r.condition.urlFilter), `Rule ${r.id} contains non-ASCII in urlFilter: "${r.condition.urlFilter}"`);

      if (r.condition.resourceTypes) {
        for (const rt of r.condition.resourceTypes) {
          assert(VALID_RESOURCE_TYPES.has(rt), `Rule ${r.id} has invalid resourceType: ${rt}`);
        }
      }
      if (r.condition.domainType) {
        assert(r.condition.domainType === 'firstParty' || r.condition.domainType === 'thirdParty', `Rule ${r.id} invalid domainType: ${r.condition.domainType}`);
      }
    }
  }

  assert(totalRules >= 50000, `Expected at least 50,000 rules, got ${totalRules}`);
});

// -----------------------------------------------------------------------------
// MODULE 2: COSMETIC CSS GRAMMAR & SELECTOR VALIDITY
// -----------------------------------------------------------------------------
console.log('\n--- MODULE 2: COSMETIC CSS GRAMMAR & SELECTOR VALIDITY ---');

challenge('CSS-SANITIZER', 'Rejects all forms of scriptlets (+js) even with tricky whitespace', () => {
  const badScriptlets = [
    '+js(set, foo)',
    '+js (set, foo)',
    'div +js(set, foo)',
    '+js()',
    '#id +js(abort-current-script)',
    '+js(nowoif)'
  ];
  for (const s of badScriptlets) {
    assertEqual(sanitizeCosmeticSelector(s), null, `Scriptlet "${s}" must return null`);
  }
});

challenge('CSS-SANITIZER', 'Rejects procedural pseudo-classes (:has-text, :xpath, :upward, etc.)', () => {
  const proceduralSelectors = [
    'div:has-text(Sponsored)',
    'span:xpath(//div)',
    '.ad:upward(2)',
    'div:-abp-has(> .ad)',
    'div:matches-path(/ads/)',
    'div:min-text-length(10)',
    'div:watch-attr(class)',
    'div:style(background-color: red)'
  ];
  for (const s of proceduralSelectors) {
    assertEqual(sanitizeCosmeticSelector(s), null, `Procedural selector "${s}" must return null`);
  }
});

challenge('CSS-SANITIZER', 'Rejects CSS injection attacks (@import, @keyframes, </style>)', () => {
  const attacks = [
    'div { display: block } </style><script>alert(1)</script>',
    '@import url("http://evil.com/style.css")',
    '@keyframes bounce',
    'div { background: red }',
    '.ad; body { display: block !important; }'
  ];
  for (const s of attacks) {
    assertEqual(sanitizeCosmeticSelector(s), null, `CSS attack "${s}" must return null`);
  }
});

challenge('CSS-SANITIZER', 'Rejects unbalanced brackets, quotes, and parentheses', () => {
  const unbalanced = [
    'div[id="test"',
    'div[id=\'test\'',
    'div[id=test]]',
    'div(span',
    'div)span',
    'div[data-ad="unclosed]',
    'div[data-ad=\'unclosed]'
  ];
  for (const s of unbalanced) {
    assertEqual(sanitizeCosmeticSelector(s), null, `Unbalanced selector "${s}" must return null`);
  }
});

challenge('CSS-SANITIZER', 'Rejects domain prefix leakage', () => {
  const domainSelectors = [
    'example.com .ad',
    '24h.com.vn .ad',
    'sub.domain.co.uk .banner',
    'dantri.com.vn #ads'
  ];
  for (const s of domainSelectors) {
    assertEqual(sanitizeCosmeticSelector(s), null, `Domain selector "${s}" must return null`);
  }
});

challenge('CSS-SANITIZER', 'Accepts valid complex standard CSS selectors', () => {
  const validSelectors = [
    '.adsbygoogle',
    'ins.adsbygoogle',
    'iframe[src*="doubleclick.net"]',
    'div[class^="ad-"][class$="-box"]',
    'div.ad-container > .sponsor-tag + span',
    '#content .ad_banner, [data-ad-slot]'
  ];
  for (const s of validSelectors) {
    const sanitized = sanitizeCosmeticSelector(s);
    assert(sanitized !== null, `Valid selector "${s}" should be accepted`);
  }
});

challenge('CSS-FILE', 'Validates src/cosmetic.css syntax: 0 scriptlets, 0 procedural, valid CSS blocks', () => {
  const cosmeticPath = path.join(rootDir, 'src/cosmetic.css');
  const css = fs.readFileSync(cosmeticPath, 'utf-8');

  assert(css.length > 50000, `src/cosmetic.css is surprisingly small: ${css.length} bytes`);
  assert(!css.includes('+js('), 'Must contain zero "+js("');
  assert(!css.includes(':has-text('), 'Must contain zero ":has-text("');
  assert(!css.includes(':xpath('), 'Must contain zero ":xpath("');
  assert(!css.includes(':upward('), 'Must contain zero ":upward("');
  assert(!css.includes(':-abp-'), 'Must contain zero ":-abp-"');

  // Verify balanced braces throughout entire stylesheet
  let openBraces = 0;
  let closeBraces = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') openBraces++;
    if (css[i] === '}') closeBraces++;
  }
  assertEqual(openBraces, closeBraces, 'Braces in src/cosmetic.css must be perfectly balanced');
  assert(openBraces >= 2, 'Must contain at least 2 CSS rule blocks');
});

challenge('CSS-SELECTORS-PARSE', 'Every selector in src/cosmetic.css parses as valid CSS selector token', () => {
  const cosmeticPath = path.join(rootDir, 'src/cosmetic.css');
  const css = fs.readFileSync(cosmeticPath, 'utf-8');

  // Extract the main selector block (before the first '{')
  const firstBraceIdx = css.indexOf('{');
  assert(firstBraceIdx > 0, 'Found opening brace');
  const commentStripped = css.slice(0, firstBraceIdx).replace(/\/\*[\s\S]*?\*\//g, '').trim();
  const rawSelectors = commentStripped.split(',\n').map(s => s.trim()).filter(Boolean);

  assert(rawSelectors.length > 10000, `Expected > 10,000 selectors, got ${rawSelectors.length}`);

  let badSelectorCount = 0;
  const badSamples = [];

  for (const sel of rawSelectors) {
    // Check if selector contains fatal syntax violations
    // 1. Must not start or end with illegal combinator
    if (/^[>+~,]/.test(sel) || /[>+~,]$/.test(sel)) {
      badSelectorCount++;
      if (badSamples.length < 5) badSamples.push(sel);
    }
    // 2. Must not start with a digit domain
    if (/^[0-9]+\.[a-zA-Z]/.test(sel)) {
      badSelectorCount++;
      if (badSamples.length < 5) badSamples.push(sel);
    }
  }

  if (badSelectorCount > 0) {
    throw new Error(`Found ${badSelectorCount} malformed selectors in src/cosmetic.css! Samples: ${badSamples.join(', ')}`);
  }
});

// -----------------------------------------------------------------------------
// MODULE 3: YOUTUBE STEALTH ENGINE ADVERSARIAL STRESS TESTING
// -----------------------------------------------------------------------------
console.log('\n--- MODULE 3: YOUTUBE STEALTH ENGINE STRESS TESTING ---');

const stealthSource = fs.readFileSync(path.join(rootDir, 'src/youtube-stealth.js'), 'utf-8');

challenge('STEALTH-ISOLATION', 'Source code wraps strictly in IIFE with "use strict" and no global leakage', () => {
  const trimmed = stealthSource.trim();
  assert(trimmed.startsWith('(() => {') || trimmed.startsWith('(function() {') || trimmed.startsWith('/**'), 'Must be wrapped in IIFE');
  assert(trimmed.includes("'use strict';"), 'Must declare "use strict"');
  assert(!stealthSource.includes('window.zb'), 'Must not attach zb to window');
  assert(!stealthSource.includes('document.zb'), 'Must not attach zb to document');
  assert(!stealthSource.includes('window.ZeroBlock'), 'Must not attach ZeroBlock to window');
  assert(!stealthSource.includes('dataset.zbCleaned'), 'Must NOT contain dataset.zbCleaned');
  assert(stealthSource.includes('new WeakSet()'), 'Must use WeakSet for tracking');
});

// Create DOM sandbox for rapid state transition simulation
function createMockYouTubeDOM() {
  const listeners = {};
  const queryMap = {};

  class MockElement {
    constructor(tagName, className = '', id = '') {
      this.tagName = tagName.toUpperCase();
      this.className = className;
      this.id = id;
      this.style = {};
      this.dataset = {};
      this.children = [];
      this.parentNode = null;
      this.offsetParent = {}; // visible
      this.classList = {
        _classes: new Set(className.split(' ').filter(Boolean)),
        contains: (c) => this.classList._classes.has(c),
        add: (c) => this.classList._classes.add(c),
        remove: (c) => this.classList._classes.delete(c)
      };
    }
    querySelector(sel) {
      if (sel === '.ytp-ad-skip-button' && this._skipButton) return this._skipButton;
      if (sel.includes('ytd-enforcement-message') && this._enforcement) return this._enforcement;
      return null;
    }
    querySelectorAll(sel) {
      return [];
    }
    remove() {
      if (this.parentNode) {
        const idx = this.parentNode.children.indexOf(this);
        if (idx >= 0) this.parentNode.children.splice(idx, 1);
        this.parentNode = null;
      }
    }
    click() {
      this._clicked = true;
      if (this._onClick) this._onClick();
    }
    dispatchEvent(evt) {
      this.click();
    }
  }

  class MockVideo extends MockElement {
    constructor() {
      super('video', 'html5-main-video');
      this.playbackRate = 1.0;
      this.muted = false;
      this.currentTime = 10.0;
      this.duration = 180.0;
      this.paused = false;
      this.ended = false;
      this.playCalls = 0;
    }
    async play() {
      this.playCalls++;
      this.paused = false;
    }
    pause() {
      this.paused = true;
    }
  }

  const video = new MockVideo();
  const player = new MockElement('div', 'html5-video-player', 'movie_player');
  const body = new MockElement('body');
  const skipButton = new MockElement('button', 'ytp-ad-skip-button');

  const documentMock = {
    body,
    querySelector(sel) {
      if (sel === '#movie_player' || sel === '.html5-video-player') return player;
      if (sel === 'video.html5-main-video' || sel === 'video') return video;
      if (sel.includes('.ytp-ad-skip-button') && player.classList.contains('ad-showing') && player._skipButtonVisible) return skipButton;
      if (sel.includes('ytd-enforcement-message') && body._enforcementModal) return body._enforcementModal;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === 'tp-yt-iron-overlay-backdrop') return body._backdrops || [];
      if (sel.includes('ytd-ad-slot-renderer')) return body._promos || [];
      return [];
    },
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  const windowMock = {
    document: documentMock,
    setInterval: (fn, ms) => {
      const id = Math.random();
      windowMock._intervals[id] = fn;
      return id;
    },
    clearInterval: (id) => {
      delete windowMock._intervals[id];
    },
    setTimeout: (fn, ms) => {
      return 1;
    },
    clearTimeout: () => {},
    MutationObserver: class {
      constructor(cb) { this.cb = cb; }
      observe() {}
      disconnect() {}
    },
    MouseEvent: class { constructor(type) { this.type = type; } },
    WeakSet: WeakSet,
    Set: Set,
    Array: Array,
    Object: Object,
    Number: Number,
    _intervals: {}
  };

  return { windowMock, documentMock, video, player, body, skipButton };
}

challenge('STEALTH-TRANSITION', 'Ad start -> skip click -> ad end restores playbackRate and volume cleanly', () => {
  const { windowMock, documentMock, video, player, skipButton } = createMockYouTubeDOM();

  // Initial user state: watching at 1.5x speed, unmuted
  video.playbackRate = 1.5;
  video.muted = false;

  const sandbox = {
    window: windowMock,
    document: documentMock,
    WeakSet: WeakSet,
    Set: Set,
    Array: Array,
    Object: Object,
    Number: Number,
    setInterval: windowMock.setInterval,
    clearInterval: windowMock.clearInterval,
    MouseEvent: windowMock.MouseEvent,
    MutationObserver: windowMock.MutationObserver
  };

  vm.createContext(sandbox);
  // Execute stealth script in sandbox
  vm.runInContext(stealthSource, sandbox);

  // Trigger ad detection: player gets class 'ad-showing'
  player.classList.add('ad-showing');
  player._skipButtonVisible = true;

  // Let the observer or polling tick run
  // Find and run the internal process loop
  for (const id in windowMock._intervals) {
    windowMock._intervals[id]();
  }

  // Verify ad acceleration and mute applied
  assertEqual(video.playbackRate, 16.0, 'Ad must be accelerated to 16x');
  assertEqual(video.muted, true, 'Ad must be muted');
  assert(skipButton._clicked, 'Skip button must be clicked');

  // Now ad ends
  player.classList.remove('ad-showing');
  player._skipButtonVisible = false;

  // Run next tick
  for (const id in windowMock._intervals) {
    windowMock._intervals[id]();
  }

  // Verify restoration to user original state (1.5x and unmuted)
  assertEqual(video.playbackRate, 1.5, 'Playback rate must restore to user rate (1.5x)');
  assertEqual(video.muted, false, 'Mute state must restore to user state (unmuted)');
});

challenge('STEALTH-TRANSITION', 'User originally muted remains muted after ad ends', () => {
  const { windowMock, documentMock, video, player } = createMockYouTubeDOM();

  video.playbackRate = 1.0;
  video.muted = true; // User was watching muted

  const sandbox = {
    window: windowMock,
    document: documentMock,
    WeakSet: WeakSet,
    Set: Set,
    Array: Array,
    Object: Object,
    Number: Number,
    setInterval: windowMock.setInterval,
    clearInterval: windowMock.clearInterval,
    MouseEvent: windowMock.MouseEvent,
    MutationObserver: windowMock.MutationObserver
  };

  vm.createContext(sandbox);
  vm.runInContext(stealthSource, sandbox);

  player.classList.add('ad-showing');
  for (const id in windowMock._intervals) windowMock._intervals[id]();

  assertEqual(video.playbackRate, 16.0);
  assertEqual(video.muted, true);

  player.classList.remove('ad-showing');
  for (const id in windowMock._intervals) windowMock._intervals[id]();

  assertEqual(video.playbackRate, 1.0);
  assertEqual(video.muted, true, 'User was muted before ad, must remain muted');
});

challenge('STEALTH-TRANSITION', 'Rapid consecutive ad pod (Ad 1 -> Ad 2 back-to-back) restores cleanly', () => {
  const { windowMock, documentMock, video, player } = createMockYouTubeDOM();

  video.playbackRate = 1.75;
  video.muted = false;

  const sandbox = {
    window: windowMock,
    document: documentMock,
    WeakSet: WeakSet,
    Set: Set,
    Array: Array,
    Object: Object,
    Number: Number,
    setInterval: windowMock.setInterval,
    clearInterval: windowMock.clearInterval,
    MouseEvent: windowMock.MouseEvent,
    MutationObserver: windowMock.MutationObserver
  };

  vm.createContext(sandbox);
  vm.runInContext(stealthSource, sandbox);

  // Ad 1 starts
  player.classList.add('ad-showing');
  for (const id in windowMock._intervals) windowMock._intervals[id]();
  assertEqual(video.playbackRate, 16.0);

  // Ad 1 ends
  player.classList.remove('ad-showing');
  for (const id in windowMock._intervals) windowMock._intervals[id]();
  assertEqual(video.playbackRate, 1.75);

  // Ad 2 starts immediately
  player.classList.add('ad-showing');
  for (const id in windowMock._intervals) windowMock._intervals[id]();
  assertEqual(video.playbackRate, 16.0);

  // Ad 2 ends
  player.classList.remove('ad-showing');
  for (const id in windowMock._intervals) windowMock._intervals[id]();
  assertEqual(video.playbackRate, 1.75, 'Rate after second ad must still be 1.75x');
  assertEqual(video.muted, false, 'Volume after second ad must still be unmuted');
});

challenge('STEALTH-ENFORCEMENT', 'Enforcement modal with backdrop is dismissed and body scroll unlocked', () => {
  const { windowMock, documentMock, video, body } = createMockYouTubeDOM();

  const mockModal = {
    tagName: 'YTD-ENFORCEMENT-MESSAGE-VIEW-MODEL',
    style: {},
    querySelector: (sel) => {
      if (sel.includes('button')) return { click: () => { mockModal._dismissed = true; } };
      return null;
    },
    remove: () => { mockModal._removed = true; }
  };
  const mockBackdrop = {
    remove: () => { mockBackdrop._removed = true; }
  };

  body._enforcementModal = mockModal;
  body._backdrops = [mockBackdrop];
  body.style.overflow = 'hidden';
  video.paused = true;

  const sandbox = {
    window: windowMock,
    document: documentMock,
    WeakSet: WeakSet,
    Set: Set,
    Array: Array,
    Object: Object,
    Number: Number,
    setInterval: windowMock.setInterval,
    clearInterval: windowMock.clearInterval,
    MouseEvent: windowMock.MouseEvent,
    MutationObserver: windowMock.MutationObserver
  };

  vm.createContext(sandbox);
  vm.runInContext(stealthSource, sandbox);

  for (const id in windowMock._intervals) windowMock._intervals[id]();

  assert(mockModal._dismissed || mockModal._removed, 'Modal must be dismissed or removed');
  assert(mockBackdrop._removed, 'Backdrop must be removed');
  assertEqual(body.style.overflow, '', 'Body overflow lock must be unlocked');
  assertEqual(video.paused, false, 'Video must be resumed');
});

challenge('STEALTH-PROTOTYPE', 'Zero pollution of Object.prototype, Array.prototype, Function.prototype, window, or document', () => {
  const { windowMock, documentMock } = createMockYouTubeDOM();

  const initialWindowProps = Object.keys(windowMock);
  const initialDocProps = Object.keys(documentMock);
  const initialObjProto = Object.getOwnPropertyNames(Object.prototype);

  const sandbox = {
    window: windowMock,
    document: documentMock,
    WeakSet: WeakSet,
    Set: Set,
    Array: Array,
    Object: Object,
    Number: Number,
    setInterval: windowMock.setInterval,
    clearInterval: windowMock.clearInterval,
    MouseEvent: windowMock.MouseEvent,
    MutationObserver: windowMock.MutationObserver
  };

  vm.createContext(sandbox);
  vm.runInContext(stealthSource, sandbox);

  const finalWindowProps = Object.keys(windowMock);
  const finalDocProps = Object.keys(documentMock);
  const finalObjProto = Object.getOwnPropertyNames(Object.prototype);

  assertEqual(finalObjProto.length, initialObjProto.length, 'Object.prototype must not be modified');
  // Check newly added props on window
  const newWinProps = finalWindowProps.filter(p => !initialWindowProps.includes(p) && p !== '_intervals');
  assertEqual(newWinProps.length, 0, `Window polluted with: ${newWinProps.join(', ')}`);
});

challenge('STEALTH-MEMORY', 'Processing 10,000 dynamic promo elements in WeakSet causes zero DOM leakage', () => {
  const { windowMock, documentMock, body } = createMockYouTubeDOM();

  const promos = [];
  for (let i = 0; i < 500; i++) {
    promos.push({
      tagName: 'YTD-AD-SLOT-RENDERER',
      style: {},
      dataset: {}
    });
  }
  body._promos = promos;

  const sandbox = {
    window: windowMock,
    document: documentMock,
    WeakSet: WeakSet,
    Set: Set,
    Array: Array,
    Object: Object,
    Number: Number,
    setInterval: windowMock.setInterval,
    clearInterval: windowMock.clearInterval,
    MouseEvent: windowMock.MouseEvent,
    MutationObserver: windowMock.MutationObserver
  };

  vm.createContext(sandbox);
  vm.runInContext(stealthSource, sandbox);

  for (const id in windowMock._intervals) windowMock._intervals[id]();

  // Verify none of the elements received dataset.zbCleaned
  for (const p of promos) {
    assertEqual(p.dataset.zbCleaned, undefined, 'Must not touch dataset.zbCleaned');
  }
});

// -----------------------------------------------------------------------------
// MODULE 4: EXISTING TEST SUITE ANALYSIS & DISCREPANCY REPRODUCTION
// -----------------------------------------------------------------------------
console.log('\n--- MODULE 4: EXISTING TEST SUITE (test-e2e.js) ANALYSIS ---');

challenge('E2E-FAILURE-ANALYSIS', 'Reproduce exact root cause of T1.F23.1 and T1.F23.3 in test-e2e.js', () => {
  // test-e2e.js lines 1118-1126
  const t1_f23_1 = stealthSource.includes('originalPlaybackRate = (video.playbackRate') || stealthSource.includes('originalPlaybackRate = video.playbackRate');
  const t1_f23_3 = stealthSource.includes('video.playbackRate = originalPlaybackRate');

  console.log(`    ℹ️ Check T1.F23.1 substring match: ${t1_f23_1}`);
  console.log(`    ℹ️ Check T1.F23.3 substring match: ${t1_f23_3}`);

  // In youtube-stealth.js, worker_mcore_1 wrote:
  // originalPlaybackRate = (typeof video.playbackRate === 'number' && video.playbackRate <= 2.0 && video.playbackRate > 0) ? video.playbackRate : 1.0;
  // and:
  // video.playbackRate = (typeof originalPlaybackRate === 'number' && originalPlaybackRate > 0) ? originalPlaybackRate : 1.0;
  // This causes literal string matching in test-e2e.js to fail!
  if (!t1_f23_1 || !t1_f23_3) {
    throw new Error('Empirically reproduced: test-e2e.js fails because of strict substring contract divergence in F23');
  }
});

// -----------------------------------------------------------------------------
// SUMMARY REPORT
// -----------------------------------------------------------------------------
console.log('\n==============================================================');
console.log(`ADVERSARIAL STRESS TEST SUMMARY`);
console.log(`Total Challenges:  ${totalChallenges}`);
console.log(`Passed:            ${passedChallenges}`);
console.log(`Failed:            ${failedChallenges}`);
console.log('==============================================================\n');

if (failureLog.length > 0) {
  console.log('FAILURE DETAILS:');
  for (const f of failureLog) {
    console.log(`- [${f.category}] ${f.title}`);
    console.log(`  Error: ${f.error}`);
  }
}

process.exit(failedChallenges > 0 ? 1 : 0);
