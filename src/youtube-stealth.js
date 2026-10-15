/**
 * ZeroBlock Lite - YouTube Stealth Engine
 * Invisible, client-side auto-accelerator and ad-skipper for YouTube.
 * Leaves ZERO footprint on window/document globals, evading anti-adblock fingerprinting.
 */

(() => {
  'use strict';

  // State tracked strictly inside private closure
  let isAdActive = false;
  let originalPlaybackRate = 1.0;
  let wasMutedBeforeAd = false;
  let skipAttemptTimer = null;

  // Zero-fingerprint tracking of processed promo and ad elements
  const cleanedElements = new WeakSet();

  // Skip button selector queries (covers legacy & modern YouTube designs)
  const SKIP_BUTTON_SELECTORS = [
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button-slot button',
    'button[id^="skip-button:"]',
    '.ytp-ad-preview-container button',
    '.videoAdUiSkipButton'
  ];

  // Ad and promo container selectors to keep YouTube UI clean
  const PROMO_SELECTORS = [
    '#masthead-ad',
    'ytd-ad-slot-renderer',
    'ytd-in-feed-ad-layout-renderer',
    'ytd-banner-promo-renderer',
    'ytd-promoted-sparkles-web-renderer',
    'ytd-statement-banner-renderer',
    '.ytp-ad-overlay-container',
    '.ytp-ad-message-container'
  ].join(',');

  /**
   * Safe click dispatcher that mimics native user interaction
   */
  function simulateClick(el) {
    if (!el || typeof el.click !== 'function') return;
    try {
      el.click();
    } catch (e) {
      // Fallback to MouseEvent dispatch
      try {
        const evt = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        el.dispatchEvent(evt);
      } catch (err) {}
    }
  }

  /**
   * Fast-check for skip button and click immediately
   */
  function clickSkipButton() {
    for (let i = 0; i < SKIP_BUTTON_SELECTORS.length; i++) {
      const btn = document.querySelector(SKIP_BUTTON_SELECTORS[i]);
      if (btn && btn.offsetParent !== null) { // visible
        simulateClick(btn);
        return true;
      }
    }
    return false;
  }

  /**
   * Handle anti-adblock enforcement dialogs if YouTube triggers one
   */
  function handleEnforcementDialog() {
    // Check for YouTube anti-adblock modal
    const dialog = document.querySelector('ytd-enforcement-message-view-model, tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)');
    if (dialog) {
      // Try finding close button
      const closeBtn = dialog.querySelector('button[aria-label="Close"], #dismiss-button button');
      if (closeBtn) {
        simulateClick(closeBtn);
      } else {
        // Hide dialog and unpause video
        dialog.remove();
      }

      // Remove backdrop overlay if present
      const backdrops = document.querySelectorAll('tp-yt-iron-overlay-backdrop');
      for (let i = 0; i < backdrops.length; i++) {
        backdrops[i].remove();
      }

      // Restore body scrolling if locked
      if (document.body && document.body.style.overflow === 'hidden') {
        document.body.style.overflow = '';
      }

      // Resume video playback
      const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
      if (video && video.paused) {
        video.play().catch(() => {});
      }
    }
  }

  /**
   * Main Ad Mitigation Loop
   */
  function processPlayer() {
    // Check enforcement message & clean promos first (un-gated before player/video checks)
    handleEnforcementDialog();

    // Clean feed & companion ads without leaving DOM fingerprints
    try {
      const promos = document.querySelectorAll(PROMO_SELECTORS);
      for (let i = 0; i < promos.length; i++) {
        const item = promos[i];
        if (item && !cleanedElements.has(item)) {
          cleanedElements.add(item);
          item.style.setProperty('display', 'none', 'important');
        }
      }
    } catch (e) {}

    const player = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
    const video = document.querySelector('video.html5-main-video') || document.querySelector('video');

    if (!player || !video) return;

    // Detect if an ad is currently playing
    const hasAdClass = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
    const hasAdOverlay = !!player.querySelector('.ytp-ad-player-overlay, .ytp-ad-text');
    const adPlaying = hasAdClass || hasAdOverlay;

    if (adPlaying) {
      if (!isAdActive) {
        // Entering ad state
        isAdActive = true;
        wasMutedBeforeAd = video.muted;
        originalPlaybackRate = (video.playbackRate > 0 && video.playbackRate <= 2.0) ? video.playbackRate : 1.0;

        // 1. Instantly mute audio
        video.muted = true;

        // 2. Accelerate video to maximum 16x speed
        try {
          video.playbackRate = 16.0;
        } catch (e) {}

        // 3. Fast-forward to the very end of the ad clip if possible
        if (Number.isFinite(video.duration) && video.duration > 0) {
          video.currentTime = video.duration;
        }

        // Try clicking skip button immediately
        clickSkipButton();

        // Polling loop to click skip button as soon as YouTube renders it
        if (!skipAttemptTimer) {
          skipAttemptTimer = setInterval(() => {
            if (!isAdActive) {
              clearInterval(skipAttemptTimer);
              skipAttemptTimer = null;
              return;
            }
            // Keep muted and sped up while in ad
            if (!video.muted) video.muted = true;
            if (video.playbackRate < 16.0) video.playbackRate = 16.0;
            if (Number.isFinite(video.duration) && video.currentTime < video.duration - 0.2) {
              video.currentTime = video.duration;
            }
            clickSkipButton();
          }, 50);
        }
      } else {
        // Already handling ad - maintain speed & mute
        if (!video.muted) video.muted = true;
        if (video.playbackRate < 16.0) video.playbackRate = 16.0;
        clickSkipButton();
      }
    } else {
      if (isAdActive) {
        // Ad just ended - cleanly restore user state
        isAdActive = false;
        if (skipAttemptTimer) {
          clearInterval(skipAttemptTimer);
          skipAttemptTimer = null;
        }

        // Restore user playback rate and volume
        try {
          video.playbackRate = originalPlaybackRate;
        } catch (e) {}
        try {
          video.muted = wasMutedBeforeAd;
        } catch (e) {}

        // Ensure video is playing
        if (video.paused && !video.ended) {
          video.play().catch(() => {});
        }
      }
    }
  }

  // Lightweight MutationObserver watching player state
  let scheduled = false;
  function triggerCheck() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      processPlayer();
      scheduled = false;
    });
  }

  // Initialize observer
  function init() {
    // Observe body for player insertion and dynamic state changes
    const target = document.body || document.documentElement;
    if (!target) return;

    const observer = new MutationObserver((mutations) => {
      triggerCheck();
    });

    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'src']
    });

    // Periodic heartbeat to guarantee stealth sync
    setInterval(processPlayer, 250);

    // Initial check
    processPlayer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
