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

  /**
   * Collapse ad placeholder element and single-child parent containers
   * @param {Element} el Target DOM element to collapse
   */
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

    // 3. YouTube feed grid & UI cleanup (collapses parent grid containers, sections & mealbars)
    try {
      if (typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname.includes('youtube.com')) {
        const gridAds = root.querySelectorAll(
          'ytd-rich-item-renderer:has(ytd-ad-slot-renderer), ytd-rich-item-renderer:has(ytd-in-feed-ad-layout-renderer), ytd-rich-item-renderer:has(ytd-display-ad-renderer), ytd-rich-item-renderer:has(ytd-promoted-sparkles-web-renderer), ytd-rich-item-renderer:has(ytd-promoted-video-renderer), ytd-rich-item-renderer:has(ytd-brand-video-singleton-renderer), ytd-rich-item-renderer:has(ytd-statement-banner-renderer), ytd-rich-item-renderer:has(ytd-banner-promo-renderer), ytd-rich-section-renderer:has(#masthead-ad), ytd-rich-section-renderer:has(ytd-brand-video-shelf-renderer), ytd-rich-section-renderer:has(ytd-ad-slot-renderer), ytd-rich-section-renderer:has(ytd-in-feed-ad-layout-renderer), ytd-rich-section-renderer:has(ytd-statement-banner-renderer), ytd-rich-section-renderer:has(ytd-banner-promo-renderer), #masthead-ad'
        );
        for (let i = 0; i < gridAds.length; i++) {
          const item = gridAds[i];
          if (item.id === 'masthead-ad') {
            const section = item.closest ? item.closest('ytd-rich-section-renderer') : null;
            if (section) section.remove();
            else item.remove();
          } else {
            item.remove();
          }
        }

        const adSlots = root.querySelectorAll(
          'ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-display-ad-renderer, ytd-promoted-sparkles-web-renderer, ytd-promoted-video-renderer, ytd-brand-video-singleton-renderer, ytd-statement-banner-renderer, ytd-banner-promo-renderer'
        );
        for (let i = 0; i < adSlots.length; i++) {
          const parent = adSlots[i].closest ? adSlots[i].closest('ytd-rich-item-renderer, ytd-rich-section-renderer') : null;
          if (parent) {
            parent.remove();
          } else {
            adSlots[i].remove();
          }
        }

        const mealbars = root.querySelectorAll('ytd-mealbar-promo-renderer');
        for (let i = 0; i < mealbars.length; i++) {
          const mb = mealbars[i];
          const dismissBtn = mb.querySelector ? mb.querySelector('#dismiss-button button, yt-button-renderer#dismiss-button button, [aria-label="Dismiss"], [aria-label="No thanks"], [aria-label="Not now"]') : null;
          if (dismissBtn && typeof dismissBtn.click === 'function') {
            try { dismissBtn.click(); } catch (err) {}
          }
          const dialog = mb.closest ? mb.closest('tp-yt-paper-dialog') : null;
          if (dialog) {
            dialog.remove();
          } else {
            mb.remove();
          }
          const backdrops = root.querySelectorAll ? root.querySelectorAll('tp-yt-iron-overlay-backdrop') : [];
          for (let j = 0; j < backdrops.length; j++) {
            backdrops[j].remove();
          }
          if (document.body && document.body.style.overflow === 'hidden') {
            document.body.style.overflow = '';
          }
          if (document.documentElement && document.documentElement.style.overflow === 'hidden') {
            document.documentElement.style.overflow = '';
          }
        }

        const companionAds = root.querySelectorAll(
          'ytd-companion-ad-renderer, ytd-action-companion-ad-renderer, #player-ads, .ytp-ad-companion-slot, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]'
        );
        for (let i = 0; i < companionAds.length; i++) {
          companionAds[i].remove();
        }

        // Mobile YouTube (m.youtube.com) ad slots & compact promo wrappers
        const mobileAds = root.querySelectorAll(
          'ytm-promoted-sparkles-web-renderer, ytm-companion-ad-renderer, ytm-ad-slot-renderer, ytm-inline-ad-renderer, ytm-promoted-video-renderer'
        );
        for (let i = 0; i < mobileAds.length; i++) {
          mobileAds[i].remove();
        }

        // Dismiss "Experiencing interruptions?" notification toast and tooltip
        const interruptionElements = root.querySelectorAll(
          '.ytp-tooltip, tp-yt-paper-toast, yt-notification-action-renderer, .paper-toast-open, .ytp-ad-message-container, .ytp-bezel'
        );
        for (let i = 0; i < interruptionElements.length; i++) {
          const el = interruptionElements[i];
          if (el && el.textContent && el.textContent.toLowerCase().includes('experiencing interruptions')) {
            el.remove();
          }
        }
      }
    } catch (e) {
      // Ignore
    }

    // 4. Unlock anti-adblock scroll lock on article/news pages
    if (document.body) {
      if (document.body.style.overflow === 'hidden') {
        document.body.style.setProperty('overflow', 'auto', 'important');
      }
      if (document.documentElement.style.overflow === 'hidden') {
        document.documentElement.style.setProperty('overflow', 'auto', 'important');
      }
    }
  }

  // Throttled observer to minimize CPU usage and prevent background frame delays
  let isPending = false;
  let fallbackTimer = null;
  /**
   * Schedule a throttled DOM pass using requestAnimationFrame with background tab fallback
   */
  function scheduleScan() {
    if (isPending) return;
    isPending = true;

    const runCleanup = () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      scanAndClean(document);
      isPending = false;
    };

    if (typeof requestAnimationFrame === 'function' && !document.hidden) {
      requestAnimationFrame(runCleanup);
      fallbackTimer = setTimeout(runCleanup, 100);
    } else {
      setTimeout(runCleanup, 50);
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
