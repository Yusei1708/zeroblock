/**
 * Build Filters Script for Manifest V3 DeclarativeNetRequest
 * Compiles upstream Adblock & Privacy filters into Chrome MV3 Ruleset JSON
 * Zero External Dependencies (Node 18+ Native Fetch)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const rulesDir = path.join(rootDir, 'rules');
const srcDir = path.join(rootDir, 'src');

if (!fs.existsSync(rulesDir)) fs.mkdirSync(rulesDir, { recursive: true });
if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });

// Filter Sources - Specialized & Regional lists prioritized first
const SOURCES = {
  ads: [
    {
      name: 'ABPVN (Vietnam Filter)',
      url: 'https://raw.githubusercontent.com/abpvn/abpvn/master/filter/abpvn.txt',
      quota: 8000
    },
    {
      name: 'uBlock Origin Filters',
      url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
      quota: 12000
    },
    {
      name: 'EasyList',
      url: 'https://easylist.to/easylist/easylist.txt',
      quota: 25000
    },
  ],
  privacy: [
    {
      name: 'Peter Lowe Ad & Tracking Servers',
      url: 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=0&mimetype=plaintext',
      quota: 10000
    },
    {
      name: 'EasyPrivacy',
      url: 'https://easylist.to/easylist/easyprivacy.txt',
      quota: 30000
    },
  ],
};

// Fallback seed lists if offline
const SEED_DOMAINS_ADS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com',
  'adnxs.com', 'criteo.com', 'rubiconproject.com', 'pubmatic.com', 'openx.net',
  'taboola.com', 'outbrain.com', 'revcontent.com', 'popads.net', 'popcash.net',
  'propellerads.com', 'adsterra.com', 'mgid.com', 'zergnet.com', 'infolinks.com',
  'bidswitch.net', 'casalemedia.com', 'smartadserver.com', 'sovrn.com', 'exponential.com',
  'yieldmo.com', 'triplelift.com', 'teads.tv', 'sharethrough.com', 'undertone.com',
  'adcolony.com', 'unityads.unity3d.com', 'applovin.com', 'chartboost.com', 'vungle.com',
  // Vietnam Ad Networks
  'eclick.vn', 'ambientplatform.vn', 'blueseed.tv', 'ants.vn', 'admicro.vn',
  'novanet.vn', 'microad.vn', 'adtrue.com', 'adnow.com', 'adflex.vn'
];

const SEED_DOMAINS_PRIVACY = [
  'google-analytics.com', 'analytics.google.com', 'googletagmanager.com',
  'hotjar.com', 'clarity.ms', 'segment.io', 'segment.com', 'mixpanel.com',
  'amplitude.com', 'crazyegg.com', 'mouseflow.com', 'fullstory.com', 'heap.io',
  'optimizely.com', 'inspectlet.com', 'statcounter.com', 'histats.com',
  'scorecardresearch.com', 'quantserve.com', 'imrworldwide.com', 'newrelic.com',
  'sentry.io', 'bugsnag.com', 'appsflyer.com', 'adjust.com', 'branch.io',
  'facebook.net', 'connect.facebook.net', 'pixel.facebook.com', 'tr.snapchat.com',
  'analytics.twitter.com', 'static.ads-twitter.com', 'ads.linkedin.com',
  'bat.bing.com', 'yandex.ru/metrika', 'mc.yandex.ru'
];

// Valid Chromium DeclarativeNetRequest resourceTypes
const VALID_RESOURCE_TYPES = new Set([
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
  'font', 'object', 'xmlhttprequest', 'ping', 'csp_report',
  'media', 'websocket', 'webtransport', 'webbundle', 'other'
]);

const TYPE_MAP = {
  'script': 'script',
  'image': 'image',
  'stylesheet': 'stylesheet',
  'css': 'stylesheet',
  'subdocument': 'sub_frame',
  'frame': 'sub_frame',
  'xmlhttprequest': 'xmlhttprequest',
  'xhr': 'xmlhttprequest',
  'media': 'media',
  'font': 'font',
  'websocket': 'websocket',
  'ping': 'ping',
  'beacon': 'ping',
  'object': 'object',
  'other': 'other'
};

/**
 * Fetch list with resilient timeout (6000ms default)
 */
async function fetchList(url, timeoutMs = 6000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZeroBlock/1.0' }
    });
    clearTimeout(timer);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    return await response.text();
  } catch (err) {
    console.warn(`[WARN] Failed to fetch ${url}: ${err.message}. Using built-in fallbacks.`);
    return null;
  }
}

/**
 * Inject curated seed domains into compiled ruleset
 */
function injectSeeds(seeds, idRef, seenPatterns, compiledRules) {
  for (const domain of seeds) {
    const pattern = `||${domain}^`;
    const key = `block:${pattern}`;
    if (!seenPatterns.has(key)) {
      seenPatterns.add(key);
      compiledRules.push({
        id: idRef.val++,
        priority: 1,
        action: { type: 'block' },
        condition: {
          urlFilter: pattern,
          resourceTypes: [
            'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
            'font', 'object', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other'
          ]
        }
      });
    }
  }
}

// Procedural pseudo-classes and uBlock operators to strictly exclude from native CSS
const PROCEDURAL_KEYWORDS = [
  ':has-text(',
  ':xpath(',
  ':upward(',
  ':matches-path(',
  ':-abp-',
  ':matches-css(',
  ':matches-attr(',
  ':matches-property(',
  ':min-text-length(',
  ':watch-attr(',
  ':style('
];

// Standard HTML and SVG element tag names for precise cosmetic domain-prefix detection
const HTML_TAGS = new Set([
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base', 'bdi', 'bdo',
  'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'cite', 'code', 'col',
  'colgroup', 'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl',
  'dt', 'em', 'embed', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2',
  'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img',
  'input', 'ins', 'kbd', 'label', 'legend', 'li', 'link', 'main', 'map', 'mark', 'menu',
  'meta', 'meter', 'nav', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p',
  'param', 'picture', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script',
  'section', 'select', 'slot', 'small', 'source', 'span', 'strong', 'style', 'sub',
  'summary', 'sup', 'svg', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th',
  'thead', 'time', 'title', 'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr',
  'path', 'g', 'circle', 'rect', 'line', 'polygon', 'polyline', 'text'
]);

/**
 * Sanitize candidate generic CSS selector for src/cosmetic.css
 * Guarantees zero scriptlets (+js), zero procedural pseudo-classes,
 * zero domain prefixes, and strict CSS syntax compliance.
 */
function sanitizeCosmeticSelector(selector) {
  if (!selector || typeof selector !== 'string') return null;
  const s = selector.trim();
  if (s.length < 2 || s.length > 150) return null;

  // 1. Scriptlet exclusion: strictly reject +js(...)
  if (s.includes('+js(') || s.startsWith('+js') || /\+js\s*\(/.test(s)) return null;

  // 2. Procedural selectors exclusion: reject non-standard pseudo-classes
  if (PROCEDURAL_KEYWORDS.some(kw => s.includes(kw))) return null;

  // Reject CSS block braces, semicolons, @ rules, and HTML tags/injection
  if (s.includes('{') || s.includes('}') || s.includes(';') || s.includes('@') || s.includes('<')) return null;

  // 3. Reject HTML filtering or caret prefix (e.g. ##^script)
  if (s.startsWith('^')) return null;

  // 4. Reject illegal leading or trailing combinators/punctuation
  if (/^[>+~,\s]/.test(s)) return null;
  if (/[>+~,\s]$/.test(s)) return null;

  // 5. Must begin with a valid CSS selector start token: '.', '#', '[', letter tag name, or '*'
  if (!/^[.#a-zA-Z*\[]/.test(s)) return null;

  // 6. Trap domain prefix leakage: only reject if the first token looks like a hostname
  const firstSpace = s.indexOf(' ');
  const token = firstSpace > 0 ? s.slice(0, firstSpace) : s;
  if (!token.startsWith('.') && !token.startsWith('#') && !token.startsWith('[') && !token.startsWith('*')) {
    if (token.includes('.')) {
      const bracketIdx = token.indexOf('[');
      const dotIdx = token.indexOf('.');
      if (bracketIdx === -1 || bracketIdx > dotIdx) {
        const tagPart = token.slice(0, dotIdx).toLowerCase();
        const looksLikeDomain =
          /\.(com|net|org|edu|gov|mil|io|co|vn|ru|de|uk|jp|fr|cn|info|biz|xyz|site|online|me|tv|cc|app|dev)(\.[a-z0-9]{2,})?$/i.test(token) ||
          (!HTML_TAGS.has(tagPart) && !/^[a-z][a-z0-9]*-/i.test(tagPart));
        if (looksLikeDomain) {
          return null;
        }
      }
    }
  }

  // 7. Verify balanced brackets, parentheses, and quotes
  let square = 0;
  let round = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (inSingleQuote || inDoubleQuote) continue;

    if (ch === '[') square++;
    else if (ch === ']') square--;
    else if (ch === '(') round++;
    else if (ch === ')') round--;

    if (square < 0 || round < 0) return null;
  }

  if (square !== 0 || round !== 0 || inSingleQuote || inDoubleQuote) return null;

  // 8. Strict printable ASCII validation
  if (!/^[\x20-\x7E]+$/.test(s)) return null;

  return s;
}

/**
 * Parse single ABP filter line into DNR rule or cosmetic selector
 */
function parseFilterLine(line, idRef, cosmeticSelectors) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[Adblock') || trimmed.startsWith('# ')) {
    return null;
  }

  // 1. Strictly trap ALL cosmetic rules: ##, #?#, #@#
  if (trimmed.includes('##') || trimmed.includes('#?#') || trimmed.includes('#@#')) {
    // Cosmetic unhide exceptions (#@#) and procedural filters (#?#) are not supported in static global CSS
    if (trimmed.includes('#@#') || trimmed.includes('#?#')) {
      return null;
    }

    const parts = trimmed.split('##');
    if (parts.length === 2) {
      const domains = parts[0].trim();
      const rawSelector = parts[1].trim();

      // Only accept purely generic selectors (no domain prefix).
      // src/cosmetic.css is injected globally across <all_urls>; domain-specific rules
      // cannot be safely applied globally and domain prefixes are invalid CSS element selectors.
      if (!domains && rawSelector) {
        const sanitized = sanitizeCosmeticSelector(rawSelector);
        if (sanitized) {
          cosmeticSelectors.add(sanitized);
        }
      }
    }
    return null;
  }

  // 2. Exception prefix parsing
  let isException = false;
  let ruleText = trimmed;

  if (ruleText.startsWith('@@')) {
    isException = true;
    ruleText = ruleText.slice(2);
  }

  // 3. Regex Filter Trap: check BEFORE option splitting
  // In ABP, regexes start with / and end with / or have options after closing / (/pattern/$options)
  if (ruleText.startsWith('/') && !ruleText.startsWith('//')) {
    if (ruleText.endsWith('/') || ruleText.includes('/$')) {
      return null;
    }
  }

  // 4. Split options at $
  let options = [];
  const dollarIdx = ruleText.indexOf('$');
  let pattern = ruleText;
  if (dollarIdx !== -1) {
    pattern = ruleText.slice(0, dollarIdx);
    options = ruleText.slice(dollarIdx + 1).split(',');
  }

  if (!pattern || pattern.length < 2) return null;

  // Interior pipe check: pipe '|' only allowed at pattern boundaries (| or || at start, | at end)
  const innerPattern = pattern.startsWith('||') ? pattern.slice(2) : (pattern.startsWith('|') ? pattern.slice(1) : pattern);
  const middle = innerPattern.endsWith('|') ? innerPattern.slice(0, -1) : innerPattern;
  if (middle.includes('|')) return null;

  // Regex escape check: Catch \d, \w, \s, \b escape sequences properly
  if (/\\[dwsb]/i.test(pattern)) return null;

  // 5. Pattern Sanitization & Normalization
  let urlFilter = pattern;

  // Normalize redundant wildcards: ||*.domain.com -> ||domain.com
  if (urlFilter.startsWith('||*.')) {
    urlFilter = '||' + urlFilter.slice(4);
  } else if (urlFilter.startsWith('||*')) {
    urlFilter = '||' + urlFilter.slice(3);
  } else if (urlFilter.startsWith('||.')) {
    urlFilter = '||' + urlFilter.slice(3);
  }

  // Normalize leading |* -> *
  if (urlFilter.startsWith('|*')) {
    urlFilter = urlFilter.slice(1);
  }

  // Normalize trailing *| -> *
  if (urlFilter.endsWith('*|')) {
    urlFilter = urlFilter.slice(0, -1);
  }

  // Only allow ASCII printable characters (0x20 - 0x7E)
  if (!/^[\x20-\x7E]+$/.test(urlFilter)) {
    return null;
  }

  // Prohibit URL fragments (#), unparsed commas (,), or invalid consecutive wildcards (**)
  if (urlFilter.includes('#') || urlFilter.includes(',') || urlFilter.includes('**')) {
    return null;
  }

  // Prohibit invalid Chrome DeclarativeNetRequest urlFilter anchor combinations:
  if (
    urlFilter.startsWith('||*') ||
    urlFilter.startsWith('||.') ||
    urlFilter.startsWith('||/') ||
    urlFilter.startsWith('||:') ||
    urlFilter.startsWith('|*') ||
    urlFilter.endsWith('*|') ||
    urlFilter.endsWith('^|') ||
    urlFilter.endsWith('|^') ||
    urlFilter === '||' ||
    urlFilter === '|' ||
    urlFilter.length < 2
  ) {
    return null;
  }

  // Secondary safety check for residual regexes and regex constructs
  const isRawRegex = (urlFilter.startsWith('/') && urlFilter.endsWith('/')) ||
    urlFilter.includes('(?:') ||
    urlFilter.includes('(?=') ||
    /\[[0-9a-zA-Z\-_]{3,}\]/.test(urlFilter) ||
    /\\[dwsb]/i.test(urlFilter) ||
    urlFilter.startsWith('/^') ||
    urlFilter.startsWith('^https?:\\/\\/');

  if (isRawRegex) {
    return null;
  }

  // 6. Option parsing & unsupported modifier filtering
  let resourceTypes = [];
  let excludedResourceTypes = [];
  let domainType = undefined;
  let initiatorDomains = [];
  let excludedInitiatorDomains = [];
  let skipRule = false;

  for (const opt of options) {
    const optLower = opt.toLowerCase().trim();
    if (!optLower) continue;

    if (optLower === 'third-party' || optLower === '3p') {
      domainType = 'thirdParty';
    } else if (optLower === '~third-party' || optLower === '~3p' || optLower === '1p') {
      domainType = 'firstParty';
    } else if (optLower.startsWith('domain=')) {
      const domList = opt.slice(7).split('|');
      for (const d of domList) {
        const dTrim = d.trim();
        if (dTrim.startsWith('~')) {
          const excl = dTrim.slice(1).trim();
          if (excl) excludedInitiatorDomains.push(excl);
        } else if (dTrim) {
          initiatorDomains.push(dTrim);
        }
      }
    } else if (TYPE_MAP[optLower]) {
      resourceTypes.push(TYPE_MAP[optLower]);
    } else if (optLower.startsWith('~') && TYPE_MAP[optLower.slice(1)]) {
      excludedResourceTypes.push(TYPE_MAP[optLower.slice(1)]);
    } else if (
      optLower.startsWith('replace=') ||
      optLower.startsWith('removeparam=') ||
      optLower.startsWith('redirect-rule=') ||
      optLower.startsWith('redirect=') ||
      optLower.startsWith('rewrite=') ||
      optLower.startsWith('urltransform=') ||
      optLower.startsWith('header=') ||
      optLower.startsWith('queryprune=') ||
      optLower.startsWith('permissions=') ||
      optLower.startsWith('cookie=') ||
      ['popup', 'csp', 'redirect', 'rewrite', 'badfilter', 'cname', 'stealth', 'denyallow'].includes(optLower)
    ) {
      skipRule = true;
      break;
    }
  }

  if (skipRule) return null;

  // 7. YouTube Playback Protection Guard:
  // Never block core YouTube video player / playback endpoints via DNR.
  // YouTube ad handling is handled smoothly via client-side stealth engine.
  const isYouTubePlayback =
    urlFilter.includes('youtube.com/youtubei/v1/player') ||
    urlFilter.includes('youtube.com/watch?') ||
    urlFilter.includes('youtube.com/playlist') ||
    urlFilter.includes('youtube.com/youtubei/v1/get_watch') ||
    urlFilter.includes('googlevideo.com/videoplayback') ||
    urlFilter.includes('googlevideo.com/initplayback');

  if (isYouTubePlayback && !isException) {
    return null;
  }

  // 8. Condition Construction
  const condition = { urlFilter };

  if (resourceTypes.length > 0) {
    condition.resourceTypes = Array.from(new Set(resourceTypes));
  }

  if (excludedResourceTypes.length > 0) {
    condition.excludedResourceTypes = Array.from(new Set(excludedResourceTypes));
  }

  if (domainType) {
    condition.domainType = domainType;
  }

  if (initiatorDomains.length > 0) {
    condition.initiatorDomains = initiatorDomains;
  }

  if (excludedInitiatorDomains.length > 0) {
    condition.excludedInitiatorDomains = excludedInitiatorDomains;
  }

  return {
    id: idRef.val++,
    priority: isException ? 2 : 1,
    action: {
      type: isException ? 'allow' : 'block'
    },
    condition
  };
}

/**
 * Main Builder
 */
async function build() {
  console.log('🚀 Starting ZeroBlock Filter Compilation...');

  const cosmeticSelectors = new Set([
    // Core high-impact ad selectors (Global)
    '.adsbygoogle',
    'ins.adsbygoogle',
    '[id*="google_ads_"]',
    '[id^="google_ads_iframe"]',
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication.com"]',
    '.ad-banner',
    '.ad-container',
    '.ad-placement',
    '.ad-wrapper',
    '.ad_box',
    '.ad_banner',
    '.advertisement',
    '[aria-label="advertisement"]',
    '[aria-label="Advertisement"]',
    '[aria-label="Ads"]',
    '[data-ad-client]',
    '[data-ad-slot]',
    '.taboola-container',
    '.trc_related_container',
    '.outbrain_widget',
    '#masthead-ad',
    'ytd-ad-slot-renderer',
    'ytd-in-feed-ad-layout-renderer',
    'ytd-banner-promo-renderer',
    'ytd-rich-item-renderer:has(ytd-ad-slot-renderer)',
    'ytd-rich-item-renderer:has(ytd-in-feed-ad-layout-renderer)',
    'ytd-rich-item-renderer:has(ytd-display-ad-renderer)',
    'ytd-rich-item-renderer:has(ytd-promoted-sparkles-web-renderer)',
    'ytd-rich-item-renderer:has(ytd-promoted-video-renderer)',
    'ytd-rich-item-renderer:has(ytd-brand-video-singleton-renderer)',
    'ytd-rich-item-renderer:has(ytd-statement-banner-renderer)',
    'ytd-rich-item-renderer:has(ytd-banner-promo-renderer)',
    'ytd-rich-section-renderer:has(#masthead-ad)',
    'ytd-rich-section-renderer:has(ytd-brand-video-shelf-renderer)',
    'ytd-rich-section-renderer:has(ytd-ad-slot-renderer)',
    'ytd-rich-section-renderer:has(ytd-in-feed-ad-layout-renderer)',
    'ytd-rich-section-renderer:has(ytd-statement-banner-renderer)',
    'ytd-rich-section-renderer:has(ytd-banner-promo-renderer)',
    '#masthead-ad',
    'ytd-masthead-ad-v3-renderer',
    'ytd-mealbar-promo-renderer',
    'ytd-companion-ad-renderer',
    'ytd-action-companion-ad-renderer',
    '#player-ads',
    '.ytp-ad-companion-slot',
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
    // Vietnam specific ad blocks
    '.eclick-box',
    '[id*="eclick"]',
    '.ambient-ad',
    '.blueseed-player',
    '.ants-ad',
    '.vads-item',
    '.quangcao',
    '.qc-banner',
    '.adv-block'
  ]);

  // 1. Process Network Rulesets
  const ruleCategories = ['ads', 'privacy'];
  let currentId = 1;

  for (const cat of ruleCategories) {
    console.log(`\n📦 Compiling [${cat.toUpperCase()}] Ruleset...`);
    const idRef = { val: currentId };
    const compiledRules = [];
    const seenPatterns = new Set();

    // Try fetching each upstream source
    for (const src of SOURCES[cat]) {
      console.log(`   Fetching ${src.name}...`);
      const rawText = await fetchList(src.url, 6000);
      if (rawText) {
        const lines = rawText.split('\n');
        let count = 0;
        const maxFromSource = src.quota || 15000;
        for (const line of lines) {
          const rule = parseFilterLine(line, idRef, cosmeticSelectors);
          if (rule) {
            // Deduplicate by action + urlFilter
            const key = `${rule.action.type}:${rule.condition.urlFilter}`;
            if (!seenPatterns.has(key)) {
              seenPatterns.add(key);
              compiledRules.push(rule);
              count++;
            }
          }
          const maxCategoryRules = cat === 'ads' ? 28000 : 35000;
          if (count >= maxFromSource) break;
          if (compiledRules.length >= maxCategoryRules) break;
        }
        console.log(`   ✓ Parsed ${count} active rules from ${src.name}`);
      } else if (src.name.includes('Peter Lowe')) {
        // Source-level immediate fallback: inject curated tracking seeds when Peter Lowe fails
        console.log(`   ⚡ Peter Lowe's list unavailable. Injecting curated tracking seeds immediately...`);
        injectSeeds(SEED_DOMAINS_PRIVACY, idRef, seenPatterns, compiledRules);
      }
      const maxCategoryRules = cat === 'ads' ? 28000 : 35000;
      if (compiledRules.length >= maxCategoryRules) break;
    }

    // Safety net fallback if entire ruleset is empty / offline
    if (compiledRules.length < 50) {
      console.log(`   ⚡ Adding curated seed rules for ${cat}...`);
      const seeds = (cat === 'ads') ? SEED_DOMAINS_ADS : SEED_DOMAINS_PRIVACY;
      injectSeeds(seeds, idRef, seenPatterns, compiledRules);
    }

    // Curated YouTube Ad Network & Streaming Rules (R2)
    if (cat === 'ads') {
      const YOUTUBE_RULES = [
        { urlFilter: '||googleads.g.doubleclick.net^', action: 'block', priority: 1 },
        { urlFilter: '||youtube.com/pagead/*', action: 'block', priority: 1 },
        { urlFilter: '||youtube.com/api/stats/ads*', action: 'block', priority: 1 },
        { urlFilter: '||youtube.com/ptracking*', action: 'block', priority: 1 },
        { urlFilter: '||youtube.com/get_midroll_info*', action: 'block', priority: 1 },
        { urlFilter: '||youtube.com/youtubei/v1/player*', action: 'allow', priority: 2 },
        { urlFilter: '||googlevideo.com/*', action: 'allow', priority: 2 }
      ];
      for (const yr of YOUTUBE_RULES) {
        const key = `${yr.action}:${yr.urlFilter}`;
        if (!seenPatterns.has(key)) {
          seenPatterns.add(key);
          compiledRules.push({
            id: idRef.val++,
            priority: yr.priority,
            action: { type: yr.action },
            condition: { urlFilter: yr.urlFilter }
          });
        }
      }
    }

    // Write JSON file
    const targetFile = path.join(rulesDir, `${cat}_rules.json`);
    fs.writeFileSync(targetFile, JSON.stringify(compiledRules, null, 2), 'utf-8');
    console.log(`   🎉 Successfully wrote ${compiledRules.length} rules to ${path.relative(rootDir, targetFile)}`);

    // Advance ID range for next category
    currentId = Math.max(idRef.val, currentId + 50000);
  }

  // 2. Compile Cosmetic CSS
  console.log('\n🎨 Compiling Cosmetic CSS Selectors...');
  // Sort deterministically for reproducible builds
  const selectorsArray = Array.from(cosmeticSelectors)
    .filter(s => s && s.length > 1)
    .sort();

  const cosmeticCssContent = `/**
 * ZeroBlock Cosmetic Filtering Engine
 * Auto-compiled from uAssets, EasyList, and curated high-impact rules.
 * Injected at document_start to suppress ad DOM layout shifts and visual flashes.
 *
 * SECTION INDEX:
 * 1. Global Cosmetic Filter Selectors
 * 2. Structural Iframe & Container Collapse
 * 3. YouTube Feed Grid, Companion & Masthead Ads
 * 4. YouTube Instant Ad Frame Suppression (Stealth Fallback)
 * 5. YouTube Interruption Modals & Toast Bypasses
 */

/* ==========================================================================
   1. GLOBAL COSMETIC FILTER SELECTORS
   ========================================================================== */
${selectorsArray.join(',\n')} {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
  max-height: 0 !important;
  min-height: 0 !important;
  width: 0 !important;
  opacity: 0 !important;
  pointer-events: none !important;
  position: absolute !important;
  z-index: -9999 !important;
}

/* ==========================================================================
   2. STRUCTURAL IFRAME & CONTAINER COLLAPSE
   ========================================================================== */
iframe[src="about:blank"]:not([id]):not([class]),
iframe[style*="display: none"],
iframe[style*="visibility: hidden"] {
  display: none !important;
}

/* ==========================================================================
   3. YOUTUBE FEED GRID, COMPANION & MASTHEAD ADS
   ========================================================================== */
ytd-rich-item-renderer:has(ytd-ad-slot-renderer),
ytd-rich-item-renderer:has(ytd-in-feed-ad-layout-renderer),
ytd-rich-item-renderer:has(ytd-display-ad-renderer),
ytd-rich-item-renderer:has(ytd-promoted-sparkles-web-renderer),
ytd-rich-item-renderer:has(ytd-promoted-video-renderer),
ytd-rich-item-renderer:has(ytd-brand-video-singleton-renderer),
ytd-rich-item-renderer:has(ytd-statement-banner-renderer),
ytd-rich-item-renderer:has(ytd-banner-promo-renderer),
ytd-rich-section-renderer:has(#masthead-ad),
ytd-rich-section-renderer:has(ytd-brand-video-shelf-renderer),
ytd-rich-section-renderer:has(ytd-ad-slot-renderer),
ytd-rich-section-renderer:has(ytd-in-feed-ad-layout-renderer),
ytd-rich-section-renderer:has(ytd-statement-banner-renderer),
ytd-rich-section-renderer:has(ytd-banner-promo-renderer),
#masthead-ad,
ytd-masthead-ad-v3-renderer,
ytd-mealbar-promo-renderer,
ytd-companion-ad-renderer,
ytd-action-companion-ad-renderer,
#player-ads,
.ytp-ad-companion-slot,
ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"] {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
  max-height: 0 !important;
  min-height: 0 !important;
  width: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* ==========================================================================
   4. YOUTUBE INSTANT AD FRAME SUPPRESSION (STEALTH FALLBACK)
   ========================================================================== */
.ad-showing video,
.ad-interrupting video {
  opacity: 0 !important;
}

/* ==========================================================================
   5. YOUTUBE INTERRUPTION MODALS & TOAST NOTIFICATIONS
   ========================================================================== */
tp-yt-paper-toast.yt-notification-action-renderer,
yt-notification-action-renderer,
.paper-toast-open.yt-notification-action-renderer,
.paper-toast-open {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
`;

  const cosmeticCssFile = path.join(srcDir, 'cosmetic.css');
  fs.writeFileSync(cosmeticCssFile, cosmeticCssContent, 'utf-8');
  console.log(`   🎉 Generated ${selectorsArray.length} pure sanitized cosmetic selectors in ${path.relative(rootDir, cosmeticCssFile)}`);

  console.log('\n✅ Build completed successfully!\n');
}

build().catch(err => {
  console.error('Fatal build error:', err);
  process.exit(1);
});
