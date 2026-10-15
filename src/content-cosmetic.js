/**
 * ZeroBlock - Universal Cosmetic Content Script
 * Injected at document_start to collapse empty ad placeholders,
 * remove anti-adblock overlay locks, and handle dynamic feed ads.
 */

(() => {
  'use strict';

  // Core ad container signatures to collapse
  const AD_SELECTORS = [
    '.adsbygoogle',
    'ins.adsbygoogle',
    '[id*="google_ads_"]',
    '[id^="ad-"]',
    '[class*="ad-box"]',
    '[class*="ad-banner"]',
    '[class*="ad-placement"]',
    '[class*="ad-wrapper"]',
    '[data-ad-client]',
    '[data-ad-slot]',
    '.taboola-container',
    '.outbrain_widget',
    '.trc_related_container',
    // Vietnam ad networks
    '.eclick-box',
    '[id*="eclick"]',
    '.ambient-ad',
    '.blueseed-player',
    '.ants-ad',
    '.quangcao',
    '.qc-banner',
    '.adv-block'
  ].join(',');

  // Check if an element should be hidden
  function collapseElement(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.dataset?.zbHidden) return;

    el.dataset.zbHidden = '1';
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('height', '0px', 'important');
    el.style.setProperty('min-height', '0px', 'important');
    el.style.setProperty('margin', '0px', 'important');
    el.style.setProperty('padding', '0px', 'important');

    // Also collapse immediate parent if parent's only child is this ad
    const parent = el.parentElement;
    if (parent && parent.children.length === 1 && parent !== document.body && parent !== document.documentElement) {
      parent.style.setProperty('display', 'none', 'important');
      parent.style.setProperty('height', '0px', 'important');
    }
  }

  // Scan and clean DOM
  function scanAndClean(root) {
    if (!root || !root.querySelectorAll) return;

    // 1. Clean known ad containers
    try {
      const adElements = root.querySelectorAll(AD_SELECTORS);
      for (let i = 0; i < adElements.length; i++) {
        collapseElement(adElements[i]);
      }
    } catch (e) {
      // Ignore invalid query
    }

    // 2. Collapse empty or blocked iframes
    try {
      const iframes = root.querySelectorAll('iframe');
      for (let i = 0; i < iframes.length; i++) {
        const frame = iframes[i];
        const src = frame.getAttribute('src') || '';
        if (
          src.includes('doubleclick.net') ||
          src.includes('googlesyndication.com') ||
          src.includes('adnxs.com') ||
          src.includes('eclick.vn') ||
          src === 'about:blank' && (frame.offsetWidth === 0 || frame.offsetHeight === 0)
        ) {
          collapseElement(frame);
        }
      }
    } catch (e) {
      // Ignore
    }

    // 3. Unlock anti-adblock scroll lock on article/news pages
    if (document.body) {
      if (document.body.style.overflow === 'hidden') {
        document.body.style.setProperty('overflow', 'auto', 'important');
      }
      if (document.documentElement.style.overflow === 'hidden') {
        document.documentElement.style.setProperty('overflow', 'auto', 'important');
      }
    }
  }

  // Throttled observer to minimize CPU usage
  let isPending = false;
  function scheduleScan() {
    if (isPending) return;
    isPending = true;

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        scanAndClean(document);
        isPending = false;
      });
    } else {
      setTimeout(() => {
        scanAndClean(document);
        isPending = false;
      }, 50);
    }
  }

  // Initial early execution
  scheduleScan();

  // Watch for dynamic DOM additions
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (let i = 0; i < mutations.length; i++) {
      if (mutations[i].addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }
    if (shouldScan) {
      scheduleScan();
    }
  });

  // Start observing as early as possible
  function initObserver() {
    const target = document.documentElement || document;
    observer.observe(target, {
      childList: true,
      subtree: true
    });
  }

  if (document.documentElement) {
    initObserver();
  } else {
    document.addEventListener('DOMContentLoaded', initObserver, { once: true });
  }

  // Re-run on full load
  window.addEventListener('load', () => {
    scheduleScan();
  }, { once: true });
})();
