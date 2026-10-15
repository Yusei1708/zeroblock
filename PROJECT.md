# Project: ZeroBlock Lite MV3

## Architecture
ZeroBlock Lite is a high-performance, zero-config, plug-and-play Manifest V3 ad-blocker extension inspired by uBlock Origin Lite's modern architecture. It operates via three core layers:
1. **Network Layer (DeclarativeNetRequest)**:
   - High-throughput static rulesets (`rules/ads_rules.json` and `rules/privacy_rules.json`) compiled ahead-of-time from major filter lists (uBlock Filters, EasyList, EasyPrivacy, Peter Lowe, ABPVN).
   - Zero background memory footprint for network matching; evaluated natively in Chromium's C++ network stack.
   - Background service worker (`src/background.js`) guarantees active static rulesets on startup/install and cleans stale dynamic rules.
2. **Cosmetic & DOM Layer**:
   - Injected at `document_start` across all frames (`src/cosmetic.css` and `src/content-cosmetic.js`).
   - Pure, sanitized CSS hiding rules (generic selectors, collapsed empty ad containers/iframes).
   - Throttled MutationObserver with `requestAnimationFrame` collapsing dynamically injected ad containers without CPU overhead.
3. **Stealth & Bypass Layer**:
   - Isolated IIFE script (`src/youtube-stealth.js`) on YouTube.
   - Detects ad streams (`.ad-showing`), accelerates playback to 16x, mutes audio, jumps to end, clicks native skip buttons, and auto-dismisses anti-adblock modals (`ytd-enforcement-message-view-model`).
   - Uses zero-fingerprint in-memory `WeakSet` (no DOM attribute mutations, no window/document prototype pollution).
4. **Toolchain & Verification**:
   - Zero-dependency Node.js compiler (`scripts/build-filters.js`) with offline fallback seeds.
   - Schema & semantic validator (`scripts/test-rules.js`).
   - Comprehensive E2E test harness (`scripts/test-e2e.js`) validating blocking, cosmetic injection, and YouTube stealth (292 tests, 100% pass).
   - Adversarial challenger harness (`scripts/test-challenger.js`, 27 tests, 100% pass).

## Feature Inventory
| # | Feature | Description | Milestone | Status | Source |
|---|---------|-------------|-----------|--------|--------|
| F01 | MV3 Manifest Specification | Fully compliant MV3 `manifest.json` with declared permissions, host permissions, background worker, static rulesets, and content scripts | M_CORE | DONE | R1, Survey |
| F02 | Zero-Config Setup | Automatically enables maximum static rulesets on startup/install without requiring user popups or interaction | M_CORE | DONE | R1, R3 |
| F03 | Static Ruleset Configuration | Declaration of `ads_rules` and `privacy_rules` in `rule_resources` with valid JSON file targets | M_CORE | DONE | R1 |
| F04 | Multi-Source Filter Downloader | Standalone Node.js fetcher for 5 upstream lists (uBlock, EasyList, EasyPrivacy, Peter Lowe, ABPVN) using native `fetch` | M_CORE | DONE | R2 |
| F05 | Offline & Resilient Seed Fallback | Robust timeout handling and source-level fallback seeds when upstream lists time out (e.g. Peter Lowe TLS timeout) | M_CORE | DONE | R2, Explorer 2 |
| F06 | ABP Network Rule Parser | Convert `||domain.com^`, `|http...|`, resource types, and domain qualifiers into valid DNR JSON rules | M_CORE | DONE | R2 |
| F07 | Cosmetic Rule Boundary Trap | Strict parser trap for cosmetic rules (`##`, `#?#`, and `#@#` cosmetic unhides) preventing cosmetic rules from leaking into network DNR rules | M_CORE | DONE | R2, Explorer 2 |
| F08 | Regex Filter Sanitization | Prevent raw regular expressions from leaking into literal `urlFilter` rules; handle option splitting correctly | M_CORE | DONE | R2, Explorer 2 |
| F09 | Whitelist / Exception Handling | Parse `@@||domain.com^` into `action: { type: "allow" }` with higher priority (`priority: 2`) | M_CORE | DONE | R2, Spec Miner 1 |
| F10 | Unique Disjoint Rule IDs | Guarantee unique integer IDs (>= 1) disjoint across ruleset files (e.g., ads starting at 1, privacy starting at 50,001) | M_CORE | DONE | R2 |
| F11 | Cosmetic CSS Sanitizer | Extract generic CSS selectors, discarding scriptlets (`+js`), procedural selectors (`:has-text`, `:xpath`, `:upward`), and invalid domain prefixes | M_CORE | DONE | R2, Explorer 2 |
| F12 | Service Worker Lifecycle Hooks | Handle `chrome.runtime.onInstalled` and `chrome.runtime.onStartup` in `src/background.js` | M_CORE | DONE | R3 |
| F13 | Ruleset State Synchronization | Check `getEnabledRulesets()` and activate `ads_rules` and `privacy_rules` via `updateEnabledRulesets()` | M_CORE | DONE | R3 |
| F14 | Dynamic Rules Clean-Up | Query `getDynamicRules()` and clean up stale dynamic rules via `updateDynamicRules()` | M_CORE | DONE | R3 |
| F15 | Early Cosmetic Injection | Inject `src/cosmetic.css` and `src/content-cosmetic.js` at `document_start` on `<all_urls>` across all frames | M_CORE | DONE | R4 |
| F16 | Throttled MutationObserver | Throttled DOM observer collapsing dynamically created ad containers and empty iframes with minimal CPU impact | M_CORE | DONE | R4 |
| F17 | Anti-Adblock Scroll Restorer | Automatically override body/html scroll locks (`overflow: hidden` -> `overflow: auto !important`) | M_CORE | DONE | R4 |
| F18 | Isolated IIFE Scope | Wrap YouTube script in pure IIFE without global window/document pollution | M_CORE | DONE | R5 |
| F19 | Ad Stream Detection & Acceleration | Detect `.ad-showing`, accelerate video to 16x, mute audio, and seek to end | M_CORE | DONE | R5 |
| F20 | Native Skip Button Clicker | Reliably click modern and legacy YouTube skip buttons | M_CORE | DONE | R5 |
| F21 | Modal Dismissal & Playback Resume | Dismiss `ytd-enforcement-message-view-model` dialogs and resume playback | M_CORE | DONE | R5 |
| F22 | Zero-Fingerprint Stealth Tracking | Replace DOM `dataset.zbCleaned` markers with an in-memory `WeakSet` to prevent anti-adblock detection | M_CORE | DONE | R5, Explorer 2 |
| F23 | Playback Rate & Volume Restorer | Restore original playback rate and mute state when ad stream ends | M_CORE | DONE | R5 |
| F24 | Rule Schema & Semantic Validator | `scripts/test-rules.js` validating manifest, DNR schema, unique IDs, character validity, and prohibiting `#` in `urlFilter` | M_CORE | DONE | R6, Explorer 2 |
| F25 | Dual-Track E2E Test Suite | Automated end-to-end integration test runner validating packaging, network blocking, cosmetic hiding, and YouTube stealth | M_TEST, M_FINAL | DONE | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M_CORE | Core Hardening & Anti-Adblock Stealth Remediation | `scripts/build-filters.js`, `src/youtube-stealth.js`, `scripts/test-rules.js`, rules and cosmetic CSS rebuild | none | DONE |
| M_TEST | E2E Testing Track Suite Creation | `scripts/test-e2e.js`, `TEST_READY.md`, 4-tier opaque-box test cases | none | DONE |
| M_FINAL | Final Milestone: 100% E2E Test Pass & Adversarial Hardening | Validate all Tier 1-4 tests pass (292/292) and Tier 5 adversarial challenges (27/27) | M_CORE, M_TEST | DONE |

## Interface Contracts
### Filter Compiler ↔ Rulesets (`scripts/build-filters.js` -> `rules/*.json`, `src/cosmetic.css`)
- Input: Upstream filter list URLs + curated seed domain fallbacks.
- Outputs:
  - `rules/ads_rules.json`: 26,774 valid DeclarativeNetRequest Rule objects with IDs starting at 1. `urlFilter` strictly ASCII, no `#`, no unparsed commas, no interior pipes, no raw regexes.
  - `rules/privacy_rules.json`: 33,549 valid DeclarativeNetRequest Rule objects with IDs starting at 50,001.
  - `src/cosmetic.css`: 13,715 pure CSS stylesheet generic hiding selectors (`display: none !important;`). No `+js` scriptlets, no procedural pseudo-classes, no domain prefixes, no CSS injection syntax.

### Extension Lifecycle ↔ Chrome DNR API (`src/background.js` -> `chrome.declarativeNetRequest`)
- `onInstalled` & `onStartup`:
  - `chrome.declarativeNetRequest.getEnabledRulesets()` returns current active ruleset IDs.
  - `chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: ["ads_rules", "privacy_rules"] })` ensures zero-config activation.
  - `chrome.declarativeNetRequest.getDynamicRules()` followed by `updateDynamicRules({ removeRuleIds })` clears stale dynamic rules.

### YouTube Stealth Script ↔ YouTube DOM (`src/youtube-stealth.js`)
- Runs in isolated world at `document_start`.
- No properties attached to `window` or `document`.
- Tracks processed ad elements via private `const cleanedElements = new WeakSet();`.
- Interacts with video element properties (`playbackRate`, `muted`, `currentTime`, `play()`).
- Un-gated execution of modal dismissal (`ytd-enforcement-message-view-model`) and promo cleanup.
- Simulates user clicks on skip buttons (`.click()`, `dispatchEvent(new MouseEvent(...))`).

## Code Layout
- `manifest.json`: Root manifest declaring extension configuration.
- `package.json`: Project manifest with zero external npm dependencies.
- `rules/`:
  - `ads_rules.json`: Static DNR rules for ad blocking (26,774 rules).
  - `privacy_rules.json`: Static DNR rules for tracking protection (33,549 rules).
- `scripts/`:
  - `build-filters.js`: Standalone filter compiler.
  - `test-rules.js`: Schema and semantic validation test suite.
  - `generate-icons.js`: Icon generation script.
  - `test-e2e.js`: End-to-end integration test runner (292 tests).
  - `test-challenger.js`: Adversarial stress-test harness (27 challenges).
- `src/`:
  - `background.js`: MV3 background service worker.
  - `content-cosmetic.js`: Universal cosmetic content script.
  - `cosmetic.css`: Compiled CSS ad-hiding stylesheet (13,715 selectors).
  - `youtube-stealth.js`: Zero-fingerprint YouTube ad bypass script.
- `icons/`:
  - `icon16.png`, `icon48.png`, `icon128.png`.
