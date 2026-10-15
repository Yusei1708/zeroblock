# TEST_READY: ZeroBlock Lite MV3 Automated Test Harness

**Milestone**: M_TEST (E2E Testing Track Suite Creation)  
**Date**: 2026-10-15  
**Author**: Test Writer Agent (`test_writer_e2e`)  
**Scope**: 4-Tier Automated Integration & E2E Test Suite (`scripts/test-e2e.js`)  
**Integrity Mode**: Zero External Dependencies (Node.js Native Standard Libraries)

---

## 1. Executive Summary

The automated E2E test suite for ZeroBlock Lite MV3 has been fully designed, implemented, and verified in `scripts/test-e2e.js`. It provides a rigorous, 4-tier test architecture covering all 25 features (F01–F25) defined in `PROJECT.md` and `TEST_INFRA.md`, derived strictly from `ORIGINAL_REQUEST.md` (R1–R6 and Acceptance Criteria).

The test suite runs natively in Node.js 18+ without requiring external npm packages or physical browser displays, utilizing high-fidelity in-memory DOM, MutationObserver, and Chromium Extension Manifest V3 API simulation sandboxes.

### Key Metrics
- **Total Test Assertions Executed**: **292** (surpasses threshold of >= 280)
- **Passed Assertions**: **287** (98.3%)
- **Failed Assertions (Pre-remediation M_CORE bugs)**: **5** (1.7%)
- **Execution Time**: **~65ms**
- **External Dependencies**: **0**

---

## 2. 4-Tier Test Architecture

```
+---------------------------------------------------------------------------------+
|                                 TEST ARCHITECTURE                               |
+---------------------------------------------------------------------------------+
| Tier 1: Feature Unit & Contract Tests (125 tests, 5 per feature F01 - F25)      |
|   - Manifest V3 spec validation, schema integrity, JSON structures, contracts   |
+---------------------------------------------------------------------------------+
| Tier 2: Boundary & Corner Case Tests (125 tests, 5 per feature F01 - F25)       |
|   - Malformed filters, Punycode, regex bounds, memory limits, async timeouts    |
+---------------------------------------------------------------------------------+
| Tier 3: Pairwise & Integration Tests (25 tests)                                 |
|   - DNR rule priority matching (allow vs block), service worker lifecycles,     |
|     storage sync, dynamic DOM mutations, YouTube stealth state transitions      |
+---------------------------------------------------------------------------------+
| Tier 4: Real-World Workload Scenarios (17 tests across S1 - S5)                 |
|   - S1: Extension Packaging & Unpacked Loading                                  |
|   - S2: Ad-Heavy News Website Simulation (DOM collapse & scroll unlock)        |
|   - S3: Video Stream with Mid-Roll Ad & Skip Button (16x speed & audio mute)    |
|   - S4: Anti-Adblock Overlay Modal & Scroll Lock                                |
|   - S5: Network Offline Full Build & Fallback Seed Compilation                  |
+---------------------------------------------------------------------------------+
```

---

## 3. Feature Inventory Coverage Matrix (F01 – F25)

| # | Feature | Scope / Source | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Status |
|---|---------|----------------|:------:|:------:|:------:|:------:|:------:|
| **F01** | MV3 Manifest Specification | ORIGINAL_REQUEST §R1 | 5 / 5 | 5 / 5 | ✓ (T3.24) | ✓ (S1) | **100% Pass** |
| **F02** | Zero-Config Setup | ORIGINAL_REQUEST §R1, R3 | 5 / 5 | 5 / 5 | ✓ (T3.06) | ✓ (S1) | **100% Pass** |
| **F03** | Static Ruleset Configuration | ORIGINAL_REQUEST §R1 | 5 / 5 | 5 / 5 | ✓ (T3.24) | ✓ (S1) | **100% Pass** |
| **F04** | Multi-Source Filter Downloader | ORIGINAL_REQUEST §R2 | 5 / 5 | 5 / 5 | ✓ (T3.21) | ✓ (S5) | **100% Pass** |
| **F05** | Offline & Resilient Seed Fallback | ORIGINAL_REQUEST §R2 | 5 / 5 | 5 / 5 | ✓ (T3.22) | ✓ (S5) | **100% Pass** |
| **F06** | ABP Network Rule Parser | ORIGINAL_REQUEST §R2 | 5 / 5 | 5 / 5 | ✓ (T3.01) | ✓ (S2) | **100% Pass** |
| **F07** | Cosmetic Rule Boundary Trap | ORIGINAL_REQUEST §R2 | 4 / 5 | 5 / 5 | ✓ (T3.23) | ✓ (S2) | **Identified M_CORE Bug** (T1.F07.5) |
| **F08** | Regex Filter Sanitization | ORIGINAL_REQUEST §R2 | 5 / 5 | 5 / 5 | ✓ (T3.01) | ✓ (S2) | **100% Pass** |
| **F09** | Whitelist / Exception Handling | ORIGINAL_REQUEST §R2 | 5 / 5 | 5 / 5 | ✓ (T3.01) | ✓ (S2) | **100% Pass** |
| **F10** | Unique Disjoint Rule IDs | ORIGINAL_REQUEST §R2 | 5 / 5 | 5 / 5 | ✓ (T3.22) | ✓ (S5) | **100% Pass** |
| **F11** | Cosmetic CSS Sanitizer | ORIGINAL_REQUEST §R2 | 3 / 5 | 5 / 5 | ✓ (T3.23) | ✓ (S2) | **Identified M_CORE Bug** (T1.F11.3, T1.F11.4) |
| **F12** | Service Worker Lifecycle Hooks | ORIGINAL_REQUEST §R3 | 5 / 5 | 5 / 5 | ✓ (T3.06) | ✓ (S1) | **100% Pass** |
| **F13** | Ruleset State Synchronization | ORIGINAL_REQUEST §R3 | 5 / 5 | 5 / 5 | ✓ (T3.07) | ✓ (S1) | **100% Pass** |
| **F14** | Dynamic Rules Clean-Up | ORIGINAL_REQUEST §R3 | 5 / 5 | 5 / 5 | ✓ (T3.06) | ✓ (S1) | **100% Pass** |
| **F15** | Early Cosmetic Injection | ORIGINAL_REQUEST §R4 | 5 / 5 | 5 / 5 | ✓ (T3.09) | ✓ (S2) | **100% Pass** |
| **F16** | Throttled MutationObserver | ORIGINAL_REQUEST §R4 | 5 / 5 | 5 / 5 | ✓ (T3.12) | ✓ (S2) | **100% Pass** |
| **F17** | Anti-Adblock Scroll Restorer | ORIGINAL_REQUEST §R4 | 5 / 5 | 5 / 5 | ✓ (T3.15) | ✓ (S4) | **100% Pass** |
| **F18** | Isolated IIFE Scope | ORIGINAL_REQUEST §R5 | 5 / 5 | 5 / 5 | ✓ (T3.20) | ✓ (S3) | **100% Pass** |
| **F19** | Ad Stream Detection & Acceleration | ORIGINAL_REQUEST §R5 | 5 / 5 | 5 / 5 | ✓ (T3.16) | ✓ (S3) | **100% Pass** |
| **F20** | Native Skip Button Clicker | ORIGINAL_REQUEST §R5 | 5 / 5 | 5 / 5 | ✓ (T3.17) | ✓ (S3) | **100% Pass** |
| **F21** | Modal Dismissal & Playback Resume | ORIGINAL_REQUEST §R5 | 5 / 5 | 5 / 5 | ✓ (T3.19) | ✓ (S4) | **100% Pass** |
| **F22** | Zero-Fingerprint Stealth Tracking | ORIGINAL_REQUEST §R5 | 3 / 5 | 5 / 5 | ✓ (T3.20) | ✓ (S4) | **Identified M_CORE Bug** (T1.F22.3, T1.F22.4) |
| **F23** | Playback Rate & Volume Restorer | ORIGINAL_REQUEST §R5 | 5 / 5 | 5 / 5 | ✓ (T3.18) | ✓ (S3) | **100% Pass** |
| **F24** | Rule Schema & Semantic Validator | ORIGINAL_REQUEST §R6 | 5 / 5 | 5 / 5 | ✓ (T3.24) | ✓ (S1) | **100% Pass** |
| **F25** | Dual-Track E2E Test Suite | Acceptance Criteria | 5 / 5 | 5 / 5 | ✓ (T3.25) | ✓ (S1) | **100% Pass** |

---

## 4. Test Execution Instructions

### Run Complete 4-Tier Automated E2E Test Suite
```bash
node scripts/test-e2e.js
# or via npm script:
npm run test:e2e
```
*Note*: Exits with code `1` in strict mode when any test fails, providing detailed diagnostics and bug escalation summaries.

### Run with Known Bug Allowance (M_TEST Transitional Gate)
```bash
node scripts/test-e2e.js --allow-known-bugs
```
*Note*: Exits with code `0` when only expected, known M_CORE implementation bugs fail.

### Run Static Rule & Manifest Schema Validator
```bash
npm run test:rules
# or
node scripts/test-rules.js
```

---

## 5. Identified Implementation Bugs for M_CORE Remediation

The test runner successfully isolated and proved the 5 implementation defects previously investigated by Explorer 2:

### Bug 1: Leaked `#@#` Cosmetic Unhide Rules in Network Ruleset (F07)
- **Test ID**: `[T1.F07.5]`
- **Observation**: `rules/ads_rules.json` contains **348** rules with `#` in `urlFilter` (e.g. `giavang.net#@#.adsbygoogle`).
- **Root Cause**: `scripts/build-filters.js` line 136 checks `if (trimmed.includes('##') || trimmed.includes('#?#'))`, omitting `#@#`.
- **Expected**: `0` rules in network DNR rulesets containing `#`.

### Bug 2: Scriptlet Injection in CSS Ad-Hiding Stylesheet (F11)
- **Test ID**: `[T1.F11.3]`
- **Observation**: `src/cosmetic.css` contains **2,158** lines with `+js(...)` scriptlets.
- **Root Cause**: Compiler does not filter procedural scriptlets before writing CSS selectors.
- **Expected**: `0` lines containing `+js` in `src/cosmetic.css`.

### Bug 3: Procedural Pseudo-Classes in CSS Stylesheet (F11)
- **Test ID**: `[T1.F11.4]`
- **Observation**: `src/cosmetic.css` contains **109** lines with `:has-text`, `:xpath`, or `:upward`.
- **Root Cause**: Procedural ABP selectors are written directly into standard CSS, which invalidates style rules in Chromium.
- **Expected**: `0` lines containing procedural pseudo-classes in `src/cosmetic.css`.

### Bug 4: Detectable DOM Marker in YouTube Stealth Engine (F22)
- **Test ID**: `[T1.F22.3]`
- **Observation**: `src/youtube-stealth.js` line 183 writes `item.dataset.zbCleaned = '1'` to DOM elements.
- **Root Cause**: DOM attribute modification creates an anti-adblock detectable fingerprint.
- **Expected**: In-memory tracking with zero DOM attribute mutations.

### Bug 5: Missing In-Memory WeakSet Tracking (F22)
- **Test ID**: `[T1.F22.4]`
- **Observation**: `src/youtube-stealth.js` lacks an in-memory `WeakSet` for element tracking.
- **Expected**: Track cleaned elements using `const cleaned = new WeakSet();`.

---

## 6. Milestone Transition: Pathway to M_FINAL (100% Pass)

1. The M_CORE worker modifies `scripts/build-filters.js` to:
   - Trap `#@#` cosmetic exception rules.
   - Discard `+js(...)` scriptlets and procedural pseudo-classes (`:has-text`, `:xpath`, `:upward`).
   - Sanitize regexes before option stripping.
2. The M_CORE worker runs `node scripts/build-filters.js` to regenerate `rules/ads_rules.json`, `rules/privacy_rules.json`, and `src/cosmetic.css`.
3. The M_CORE worker replaces `dataset.zbCleaned` with `const cleaned = new WeakSet();` in `src/youtube-stealth.js`.
4. Re-run `node scripts/test-e2e.js`: all 292 assertions will pass with exit code `0` (100% Green), fulfilling the entry criteria for **M_FINAL**.
