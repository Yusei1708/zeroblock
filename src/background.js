/**
 * ZeroBlock - Background Service Worker (Manifest V3)
 * Handles DeclarativeNetRequest ruleset activation and silent lifecycle management.
 */

const RULESET_IDS = ['ads_rules', 'privacy_rules'];

/**
 * Activate and verify all static rulesets
 */
async function activateRulesets() {
  try {
    const enabledIds = await chrome.declarativeNetRequest.getEnabledRulesets();
    const disabledIds = RULESET_IDS.filter(id => !enabledIds.includes(id));

    if (disabledIds.length > 0) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: disabledIds
      });
      console.log(`[ZeroBlock] Activated rulesets: ${disabledIds.join(', ')}`);
    } else {
      console.log(`[ZeroBlock] All rulesets active: ${enabledIds.join(', ')}`);
    }

    // Diagnostic logging for developer mode
    if (chrome.declarativeNetRequest.getMatchedStyles) {
      console.log('[ZeroBlock] DeclarativeNetRequest active with host access permissions.');
    }
  } catch (err) {
    console.error('[ZeroBlock] Error activating rulesets:', err);
  }
}

/**
 * Clean up redundant dynamic rules to maintain pristine state
 */
async function cleanupDynamicRules() {
  try {
    const existingDynamic = await chrome.declarativeNetRequest.getDynamicRules();
    if (existingDynamic && existingDynamic.length > 0) {
      const removeRuleIds = existingDynamic.map(r => r.id);
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds
      });
      console.log(`[ZeroBlock] Cleaned up ${removeRuleIds.length} stale dynamic rules.`);
    }
  } catch (err) {
    console.warn('[ZeroBlock] Dynamic rule cleanup notice:', err);
  }
}

/**
 * Extension Installation Handler
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[ZeroBlock] Extension installed/updated. Reason: ${details.reason}`);
  await cleanupDynamicRules();
  await activateRulesets();

  // Initialize extension storage for zero-config defaults
  try {
    await chrome.storage.local.set({
      installedAt: Date.now(),
      version: chrome.runtime.getManifest().version,
      enabled: true
    });
  } catch (e) {
    // Storage optional fallback
  }
});

/**
 * Browser / Service Worker Startup Handler
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('[ZeroBlock] Service worker startup - ensuring rulesets are active.');
  await activateRulesets();
});

// Immediate invocation on service worker spin-up
activateRulesets();
