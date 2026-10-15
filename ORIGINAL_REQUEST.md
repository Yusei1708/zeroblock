# Original User Request

## 2026-10-15T09:22:48Z

Build a complete, production-ready, zero-config, plug-and-play Google Chrome Manifest V3 Ad-Blocker extension inspired by uBlock Origin Lite's modern architecture.

Working directory: /home/yusei1708/code/ublock
Integrity mode: development

## Requirements

### R1. Complete Manifest V3 Architecture & Zero-Config Setup
- Write `manifest.json` fully compliant with Chrome MV3 standards without using deprecated `webRequestBlocking` or remote hosted code.
- Zero-config: on installation or startup, automatically activate maximum rule capacity in the background without any user interaction or configuration popup.
- Register static declarativeNetRequest rulesets (`rules/ads_rules.json` and `rules/privacy_rules.json`) utilizing allowed static ruleset capacity.
- Declare appropriate permissions (`declarativeNetRequest`, `declarativeNetRequestWithHostAccess`, `storage`) and host permissions (`<all_urls>`).

### R2. Automated Filter Compiler (`scripts/build-filters.js`)
- Write a standalone Node.js script using native APIs (zero external npm dependencies required) that fetches upstream filter lists:
  - uBlock Origin Filters (`https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt`)
  - EasyList (`https://easylist.to/easylist/easylist.txt`)
  - EasyPrivacy (`https://easylist.to/easylist/easyprivacy.txt`)
  - Peter Lowe's Ad & Tracking list (`https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=0&mimetype=plaintext`)
  - ABPVN (`https://raw.githubusercontent.com/abpvn/abpvn/master/filter/abpvn.txt`)
- Parse ABP/uBlock network filter syntax into valid Chrome DeclarativeNetRequest JSON rules:
  - Convert `||domain.com^` patterns into `urlFilter`
  - Handle resource types (`$script`, `$image`, `$subdocument`, `$xmlhttprequest`, `$stylesheet`)
  - Handle domain qualifiers (`third-party`, `domain=...`)
  - Handle exceptions / whitelist rules (`@@||domain.com^`) with higher priority
  - Assign valid unique integer IDs (starting at 1) to each rule
- Split compiled rules into `rules/ads_rules.json` and `rules/privacy_rules.json`.
- Extract cosmetic element hiding rules (`##selector`, `###id`, `.class`) and compile into `src/cosmetic.css`.
- Include fallback/seed rules if network is offline during build.

### R3. Service Worker Background Engine (`src/background.js`)
- Handle extension lifecycle events (`chrome.runtime.onInstalled`, `chrome.runtime.onStartup`).
- Ensure static rulesets (`ads_rules`, `privacy_rules`) are enabled via `chrome.declarativeNetRequest.updateEnabledRulesets`.
- Manage and clean up dynamic rulesets.

### R4. Universal Cosmetic Filtering (`src/content-cosmetic.js` & `src/cosmetic.css`)
- Inject at `document_start` on `<all_urls>` to eliminate blank frames, banner placeholders, and layout shifts before page rendering.
- DOM MutationObserver cleans dynamically injected ad frames, empty ad slots, and sponsor wrappers with minimal CPU overhead.

### R5. YouTube Stealth & Anti-Adblock Bypass (`src/youtube-stealth.js`)
- Runs in an isolated scope (IIFE) without polluting global `window` or `document` variables to evade detection.
- Detects ad playback stream (`.ad-showing`, video ad containers).
- Automatically mutes audio, accelerates video playback to 16x (or jumps to end), and clicks "Skip Ad" buttons natively.
- Dismisses anti-adblock modals (`ytd-enforcement-message-view-model`) and companion ads without breaking video playback or triggering YouTube anti-adblock detection.
- Restores original playback speed and unmutes when the ad stream ends.

### R6. Verification & Test Suite (`scripts/test-rules.js`)
- Automated verification script to validate `rules/ads_rules.json` and `rules/privacy_rules.json` conform to Chrome DeclarativeNetRequest JSON schema.

## Acceptance Criteria

### DeclarativeNetRequest & MV3 Validation
- [ ] `manifest.json` passes Chrome MV3 extension schema validation with no warnings or errors.
- [ ] Extension loads unpacked in Chromium-based browsers without errors.
- [ ] `rules/ads_rules.json` and `rules/privacy_rules.json` contain valid declarativeNetRequest rule syntax with unique IDs and valid action/condition fields.

### Build Script Verification
- [ ] Running `node scripts/build-filters.js` downloads lists, parses rules, and writes `rules/ads_rules.json`, `rules/privacy_rules.json`, and updates `src/cosmetic.css`.
- [ ] Running `node scripts/test-rules.js` passes all rule syntax and schema checks.

### YouTube Stealth Verification
- [ ] Content script contains no global window variables or detectable prototypes.
- [ ] Video playback recovers automatically to normal rate (1.0x) and unmutes once the ad stream ends.
