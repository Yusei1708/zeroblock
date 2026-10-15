# E2E Test Infra: ZeroBlock Lite MV3

## Test Philosophy
- **Opaque-Box & Requirement-Driven**: Tests are derived strictly from `ORIGINAL_REQUEST.md` (R1 through R6 and Acceptance Criteria) without relying on implementation internals.
- **Methodology**: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing across 4 systematic tiers.
- **Zero External Dependencies**: Harness runs natively using Node.js standard libraries (`child_process`, `fs`, `path`, `http`, `assert`) and native Chromium capabilities.

## Feature Inventory Coverage Matrix
| # | Feature | Source | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|--------|:------:|:------:|:------:|:------:|
| F01 | MV3 Manifest Specification | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| F02 | Zero-Config Setup | ORIGINAL_REQUEST §R1, R3 | 5 | 5 | ✓ | ✓ |
| F03 | Static Ruleset Configuration | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| F04 | Multi-Source Filter Downloader | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| F05 | Offline & Resilient Seed Fallback | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| F06 | ABP Network Rule Parser | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| F07 | Cosmetic Rule Boundary Trap | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| F08 | Regex Filter Sanitization | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| F09 | Whitelist / Exception Handling | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| F10 | Unique Disjoint Rule IDs | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| F11 | Cosmetic CSS Sanitizer | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| F12 | Service Worker Lifecycle Hooks | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| F13 | Ruleset State Synchronization | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| F14 | Dynamic Rules Clean-Up | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| F15 | Early Cosmetic Injection | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ | ✓ |
| F16 | Throttled MutationObserver | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ | ✓ |
| F17 | Anti-Adblock Scroll Restorer | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ | ✓ |
| F18 | Isolated IIFE Scope | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ | ✓ |
| F19 | Ad Stream Detection & Acceleration | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ | ✓ |
| F20 | Native Skip Button Clicker | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ | ✓ |
| F21 | Modal Dismissal & Playback Resume | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ | ✓ |
| F22 | Zero-Fingerprint Stealth Tracking | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ | ✓ |
| F23 | Playback Rate & Volume Restorer | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ | ✓ |
| F24 | Rule Schema & Semantic Validator | ORIGINAL_REQUEST §R6 | 5 | 5 | ✓ | ✓ |
| F25 | Dual-Track E2E Test Suite | Acceptance Criteria | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Test Runner**: `node scripts/test-e2e.js` and `npm run test:rules`.
- **Pass/Fail Semantics**: Exit code 0 indicates all assertion suites passed. Non-zero indicates failure.
- **Test Runner Modules**:
  1. `Tier 1: Feature Unit & Contract Tests`: Validates isolated functions, schema adherence, rule outputs, manifest structures.
  2. `Tier 2: Boundary & Corner Case Tests`: Malformed rules, unicode/Punycode, regex handling, empty inputs, network timeout simulation.
  3. `Tier 3: Pairwise & Integration Tests`: Ruleset priority override (allow vs block), service worker ruleset state transitions, cosmetic mutation reactions.
  4. `Tier 4: Real-World Workload Scenarios`: End-to-end simulated web page navigation, YouTube ad sequence simulation, Chrome CLI extension packaging.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| S1 | Extension Packaging & Unpacked Loading | F01, F02, F03, F12 | High |
| S2 | Ad-Heavy News Website Simulation | F06, F11, F15, F16 | High |
| S3 | Video Stream with Mid-Roll Ad & Skip Button | F18, F19, F20, F23 | High |
| S4 | Anti-Adblock Overlay Modal & Scroll Lock | F17, F21, F22 | Medium |
| S5 | Network Offline Full Build & Fallback Seed Compilation | F04, F05, F06, F10 | High |

## Coverage Thresholds
- Tier 1: >= 5 tests per feature (125 tests)
- Tier 2: >= 5 tests per feature (125 tests)
- Tier 3: >= 25 interaction tests
- Tier 4: >= 5 realistic workload scenarios
- Total: >= 280 test assertions
