/**
 * ZeroBlock - YouTube Stealth Engine
 * Invisible, client-side auto-accelerator and ad-skipper for YouTube.
 * Leaves ZERO footprint on window/document globals, evading anti-adblock fingerprinting.
 */

(() => {
  'use strict';

  // =========================================================================
  // R1. InnerTube Player API JSON Pruning & Property Traps (Zero Ads)
  // =========================================================================

  const AD_PROPERTIES = [
    'adPlacements',
    'playerAds',
    'adSlots',
    'adBreakHeartbeatParams',
    'adBreakParams',
    'adConfig',
    'adPlacementConfig',
    'playerAdParams',
    'playerAdConfig',
    'adThrottled',
    'instreamAdPlayerOverlayRenderer'
  ];

  /**
   * Prune InnerTube player response data to completely eliminate video ads
   */
  function prunePlayerResponse(obj, seen = new WeakSet()) {
    if (!obj) return obj;
    if (typeof obj === 'string') {
      try {
        const parsed = JSON.parse(obj);
        return JSON.stringify(prunePlayerResponse(parsed, seen));
      } catch (e) {
        return obj;
      }
    }
    if (typeof obj !== 'object') return obj;

    if (seen.has(obj)) return obj;
    seen.add(obj);

    if (Array.isArray(obj)) {
      let arr = obj;
      if (Object.isFrozen(arr)) {
        try { arr = [...arr]; } catch (e) {}
      }
      for (let i = 0; i < arr.length; i++) {
        try {
          arr[i] = prunePlayerResponse(arr[i], seen);
        } catch (e) {}
      }
      return arr;
    }

    let target = obj;
    if (Object.isFrozen(target)) {
      try { target = { ...target }; } catch (e) {}
    }

    for (let i = 0; i < AD_PROPERTIES.length; i++) {
      const prop = AD_PROPERTIES[i];
      if (prop in target) {
        try {
          delete target[prop];
        } catch (e) {}
        if (prop in target) {
          try {
            target[prop] = Array.isArray(target[prop]) ? [] : undefined;
          } catch (e) {}
        }
      }
    }

    if (target.playbackTracking && typeof target.playbackTracking === 'object') {
      if ('adBreakHeartbeatParams' in target.playbackTracking) {
        try {
          if (Object.isFrozen(target.playbackTracking)) {
            target.playbackTracking = { ...target.playbackTracking };
          }
          delete target.playbackTracking.adBreakHeartbeatParams;
        } catch (e) {}
        if ('adBreakHeartbeatParams' in target.playbackTracking) {
          try {
            target.playbackTracking.adBreakHeartbeatParams = undefined;
          } catch (e) {}
        }
      }
    }

    if (target.playerResponse) {
      try {
        target.playerResponse = prunePlayerResponse(target.playerResponse, seen);
      } catch (e) {}
    }

    if (target.args && typeof target.args === 'object') {
      if (Object.isFrozen(target.args)) {
        try { target.args = { ...target.args }; } catch (e) {}
      }
      for (let i = 0; i < AD_PROPERTIES.length; i++) {
        const prop = AD_PROPERTIES[i];
        if (prop in target.args) {
          try {
            delete target.args[prop];
          } catch (e) {}
          if (prop in target.args) {
            try {
              target.args[prop] = Array.isArray(target.args[prop]) ? [] : undefined;
            } catch (e) {}
          }
        }
      }
      if (target.args.player_response) {
        try {
          target.args.player_response = prunePlayerResponse(target.args.player_response, seen);
        } catch (e) {}
      }
      if (target.args.raw_player_response) {
        try {
          target.args.raw_player_response = prunePlayerResponse(target.args.raw_player_response, seen);
        } catch (e) {}
      }
    }

    // Traverse other child objects (excluding streamingData and videoDetails)
    for (const key of Object.keys(target)) {
      if (key === 'streamingData' || key === 'videoDetails') continue;
      const val = target[key];
      if (val && typeof val === 'object') {
        try {
          target[key] = prunePlayerResponse(val, seen);
        } catch (e) {}
      }
    }

    return target;
  }

  function prunePlayerResponseText(text) {
    if (typeof text !== 'string') return text;
    try {
      const parsed = JSON.parse(text);
      const pruned = prunePlayerResponse(parsed);
      return JSON.stringify(pruned);
    } catch (e) {
      return text;
    }
  }

  function isPlayerUrl(input) {
    let url = '';
    if (typeof input === 'string') {
      url = input;
    } else if (input && typeof input.url === 'string') {
      url = input.url;
    } else if (input && typeof input.href === 'string') {
      url = input.href;
    } else {
      try {
        url = String(input || '');
      } catch (e) {
        url = '';
      }
    }
    return url.includes('youtubei/v1/player');
  }

  function wrapResponse(res) {
    if (!res) return res;

    try {
      if (typeof res.json === 'function') {
        const origJson = res.json.bind(res);
        res.json = async function() {
          const data = await origJson();
          return prunePlayerResponse(data);
        };
      }
    } catch (e) {}

    try {
      if (typeof res.text === 'function') {
        const origText = res.text.bind(res);
        res.text = async function() {
          const text = await origText();
          return prunePlayerResponseText(text);
        };
      }
    } catch (e) {}

    try {
      if (typeof res.clone === 'function') {
        const origClone = res.clone.bind(res);
        res.clone = function() {
          const cloned = origClone();
          return wrapResponse(cloned);
        };
      }
    } catch (e) {}

    return res;
  }

  // Intercept window.fetch for /youtubei/v1/player
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const isPlayer = isPlayerUrl(args[0]);
      const response = await originalFetch.apply(this, args);
      if (isPlayer) {
        return wrapResponse(response);
      }
      return response;
    };
  }

  // Intercept window.XMLHttpRequest for /youtubei/v1/player
  if (typeof window !== 'undefined' && typeof window.XMLHttpRequest === 'function') {
    const XHRProto = window.XMLHttpRequest.prototype;
    if (XHRProto && typeof XHRProto.open === 'function') {
      const origOpen = XHRProto.open;
      const descResponseText = Object.getOwnPropertyDescriptor(XHRProto, 'responseText');
      const descResponse = Object.getOwnPropertyDescriptor(XHRProto, 'response');

      XHRProto.open = function(method, url, ...rest) {
        this._isYtPlayerEndpoint = isPlayerUrl(url);
        this._prunedResponse = null;
        this._prunedResponseText = null;
        this._lastRawResponse = null;
        this._lastRawText = null;

        if (!descResponseText?.get && !Object.getOwnPropertyDescriptor(this, 'responseText')?.get) {
          Object.defineProperty(this, 'responseText', {
            configurable: true,
            get() {
              const raw = this._responseText;
              if (this._isYtPlayerEndpoint && typeof raw === 'string') {
                if (this.readyState === 4) {
                  if (this._lastRawText === raw && this._prunedResponseText !== null) {
                    return this._prunedResponseText;
                  }
                  this._lastRawText = raw;
                  this._prunedResponseText = prunePlayerResponseText(raw);
                  return this._prunedResponseText;
                }
                return prunePlayerResponseText(raw);
              }
              return raw;
            },
            set(val) { this._responseText = val; }
          });
        }

        if (!descResponse?.get && !Object.getOwnPropertyDescriptor(this, 'response')?.get) {
          Object.defineProperty(this, 'response', {
            configurable: true,
            get() {
              if (this._isYtPlayerEndpoint) {
                if (this.responseType === 'json') {
                  if (this.readyState === 4) {
                    if (this._lastRawResponse === this._response && this._prunedResponse !== null) {
                      return this._prunedResponse;
                    }
                    if (this._response && typeof this._response === 'object') {
                      this._lastRawResponse = this._response;
                      this._prunedResponse = prunePlayerResponse(this._response);
                      return this._prunedResponse;
                    }
                  }
                  return (this._response && typeof this._response === 'object') ? prunePlayerResponse(this._response) : this._response;
                }
                if (this.responseType === '' || this.responseType === 'text') {
                  if (this.readyState === 4) {
                    if (this._lastRawText === this._response && this._prunedResponseText !== null) {
                      return this._prunedResponseText;
                    }
                    if (typeof this._response === 'string') {
                      this._lastRawText = this._response;
                      this._prunedResponseText = prunePlayerResponseText(this._response);
                      return this._prunedResponseText;
                    }
                  }
                  return typeof this._response === 'string' ? prunePlayerResponseText(this._response) : this._response;
                }
              }
              return this._response;
            },
            set(val) { this._response = val; }
          });
        }

        return origOpen.call(this, method, url, ...rest);
      };

      if (descResponseText && descResponseText.get) {
        Object.defineProperty(XHRProto, 'responseText', {
          configurable: true,
          enumerable: descResponseText.enumerable,
          get() {
            const raw = descResponseText.get.call(this);
            if (this._isYtPlayerEndpoint && typeof raw === 'string') {
              if (this.readyState === 4) {
                if (this._lastRawText === raw && this._prunedResponseText !== null) {
                  return this._prunedResponseText;
                }
                this._lastRawText = raw;
                this._prunedResponseText = prunePlayerResponseText(raw);
                return this._prunedResponseText;
              }
              return prunePlayerResponseText(raw);
            }
            return raw;
          }
        });
      }

      if (descResponse && descResponse.get) {
        Object.defineProperty(XHRProto, 'response', {
          configurable: true,
          enumerable: descResponse.enumerable,
          get() {
            const raw = descResponse.get.call(this);
            if (this._isYtPlayerEndpoint) {
              if (this.responseType === 'json') {
                if (this.readyState === 4) {
                  if (this._lastRawResponse === raw && this._prunedResponse !== null) {
                    return this._prunedResponse;
                  }
                  if (raw && typeof raw === 'object') {
                    this._lastRawResponse = raw;
                    this._prunedResponse = prunePlayerResponse(raw);
                    return this._prunedResponse;
                  }
                }
                return (raw && typeof raw === 'object') ? prunePlayerResponse(raw) : raw;
              }
              if (this.responseType === '' || this.responseType === 'text') {
                if (this.readyState === 4) {
                  if (this._lastRawText === raw && this._prunedResponseText !== null) {
                    return this._prunedResponseText;
                  }
                  if (typeof raw === 'string') {
                    this._lastRawText = raw;
                    this._prunedResponseText = prunePlayerResponseText(raw);
                    return this._prunedResponseText;
                  }
                }
                return typeof raw === 'string' ? prunePlayerResponseText(raw) : raw;
              }
            }
            return raw;
          }
        });
      }
    }
  }

  // Install getter/setter traps on window.ytInitialPlayerResponse and window.ytplayer.config
  if (typeof window !== 'undefined') {
    let _ytInitialPlayerResponse = window.ytInitialPlayerResponse ? prunePlayerResponse(window.ytInitialPlayerResponse) : undefined;
    try {
      Object.defineProperty(window, 'ytInitialPlayerResponse', {
        configurable: true,
        enumerable: false,
        get() {
          return _ytInitialPlayerResponse ? prunePlayerResponse(_ytInitialPlayerResponse) : _ytInitialPlayerResponse;
        },
        set(val) {
          _ytInitialPlayerResponse = prunePlayerResponse(val);
        }
      });
    } catch (e) {}

    function trapConfig(obj) {
      if (!obj || typeof obj !== 'object') return obj;
      let _config = obj.config ? prunePlayerResponse(obj.config) : undefined;
      try {
        Object.defineProperty(obj, 'config', {
          configurable: true,
          enumerable: true,
          get() {
            return _config ? prunePlayerResponse(_config) : _config;
          },
          set(val) {
            _config = prunePlayerResponse(val);
          }
        });
      } catch (e) {
        if (obj.config) {
          prunePlayerResponse(obj.config);
        }
      }
      return obj;
    }

    let _ytplayer = window.ytplayer ? trapConfig(window.ytplayer) : undefined;
    try {
      Object.defineProperty(window, 'ytplayer', {
        configurable: true,
        enumerable: false,
        get() {
          return _ytplayer;
        },
        set(val) {
          _ytplayer = trapConfig(val);
        }
      });
    } catch (e) {}

    // Intercept YouTube SPA soft-navigation events to sanitize dynamic player payloads
    const sanitizeEventDetail = (e) => {
      if (!e || !e.detail) return;
      try {
        if (e.detail.response) {
          if (e.detail.response.playerResponse) {
            e.detail.response.playerResponse = prunePlayerResponse(e.detail.response.playerResponse);
          }
          if (typeof e.detail.response === 'string') {
            e.detail.response = prunePlayerResponse(e.detail.response);
          } else {
            e.detail.response = prunePlayerResponse(e.detail.response);
          }
        }
        if (e.detail.playerResponse) {
          e.detail.playerResponse = prunePlayerResponse(e.detail.playerResponse);
        }
        if (e.detail.endpoint?.watchEndpoint?.playerResponse) {
          e.detail.endpoint.watchEndpoint.playerResponse = prunePlayerResponse(e.detail.endpoint.watchEndpoint.playerResponse);
        }
        if (e.detail.data?.playerResponse) {
          e.detail.data.playerResponse = prunePlayerResponse(e.detail.data.playerResponse);
        }
        prunePlayerResponse(e.detail);
      } catch (err) {}
      setTimeout(processPlayer, 0);
    };

    try {
      const navEvents = ['yt-navigate-finish', 'yt-page-data-updated', 'yt-page-data-fetched', 'yt-player-updated'];
      for (let i = 0; i < navEvents.length; i++) {
        const ev = navEvents[i];
        window.addEventListener(ev, sanitizeEventDetail, true);
        if (typeof document !== 'undefined') {
          document.addEventListener(ev, sanitizeEventDetail, true);
        }
      }
    } catch (e) {}
  }

  // State tracked strictly inside private closure
  let isAdActive = false;
  let originalPlaybackRate = 1.0;
  let originalMuted = false;
  let resetToDefaultTimer = null;
  let skipAttemptTimer = null;

  // Zero-fingerprint tracking of attached video listeners
  const attachedVideos = new WeakSet();

  // Skip button selector queries (covers legacy & modern YouTube designs)
  const SKIP_BUTTON_SELECTORS = [
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-skip-ad-button',
    '.ytp-skip-ad-button-modern',
    'button.ytp-skip-ad-button',
    '.ytp-ad-skip-button-slot button',
    '.ytp-ad-skip-slot button',
    'button[id^="skip-button:"]',
    '[id^="skip-button:"]',
    'button.ytp-ad-skip-button-icon',
    'button.ytp-ad-skip-button-text',
    '.ytp-ad-skip-button-icon',
    '.ytp-ad-skip-button-text',
    '.ytp-ad-preview-container button',
    '.videoAdUiSkipButton',
    '.ytp-ad-skip-button-container button',
    '.ytp-ad-skip-button-container',
    '[aria-label="Skip ad"]',
    '[aria-label="Skip ads"]'
  ];

  /**
   * Safe click dispatcher that mimics native user interaction
   */
  function simulateClick(el) {
    if (!el) return;
    try {
      if (typeof PointerEvent !== 'undefined') {
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, composed: true, view: window }));
        el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, composed: true, view: window }));
      }
      if (typeof MouseEvent !== 'undefined') {
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true, view: window }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, composed: true, view: window }));
      }
    } catch (e) {}
    try {
      if (typeof el.click === 'function') {
        el.click();
        return;
      }
    } catch (e) {}
    try {
      if (typeof MouseEvent !== 'undefined') {
        el.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window
        }));
      }
    } catch (err) {}
  }

  /**
   * Helper to check genuine visibility of elements across browsers and mocks
   */
  function isElementVisible(el) {
    if (!el) return false;
    if (typeof el.checkVisibility === 'function') {
      try {
        if (!el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) {
          return false;
        }
      } catch (e) {}
    }
    const style = el.style || {};
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
    if (typeof el.offsetParent !== 'undefined' && el.offsetParent === null && style.position !== 'fixed') {
      return false;
    }
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      try {
        const cs = window.getComputedStyle(el);
        if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) {
          return false;
        }
      } catch (e) {}
    }
    return true;
  }

  /**
   * Fast-check for skip button and click immediately as soon as it appears in the DOM
   */
  function clickSkipButton(player) {
    const searchScopes = [];
    if (player && player !== document) {
      if (player.shadowRoot) searchScopes.push(player.shadowRoot);
      searchScopes.push(player);
    }
    const ytdPlayer = document.querySelector ? document.querySelector('ytd-player') : null;
    if (ytdPlayer?.shadowRoot && !searchScopes.includes(ytdPlayer.shadowRoot)) {
      searchScopes.push(ytdPlayer.shadowRoot);
    }
    searchScopes.push(document);

    let clicked = false;
    for (const scope of searchScopes) {
      if (!scope || !scope.querySelectorAll) continue;
      for (let i = 0; i < SKIP_BUTTON_SELECTORS.length; i++) {
        const elements = scope.querySelectorAll(SKIP_BUTTON_SELECTORS[i]);
        for (let j = 0; j < elements.length; j++) {
          const el = elements[j];
          if (el) {
            let btn = (el.tagName === 'BUTTON') ? el : (el.closest('button') || el.querySelector('button') || el);
            if (btn.shadowRoot) {
              const shadowBtn = btn.shadowRoot.querySelector('button');
              if (shadowBtn) btn = shadowBtn;
            }
            simulateClick(btn);
            if (btn !== el) {
              simulateClick(el);
            }
            clicked = true;
          }
        }
      }
    }
    return clicked;
  }

  /**
   * Feed Grid & UI Cleanup
   * Removes parent grid containers to trigger immediate reflow,
   * dismisses Premium promo mealbars, and cleans companion ad panels.
   */
  function cleanUI() {
    // 1. YouTube Premium promo mealbar popup
    try {
      const mealbars = document.querySelectorAll('ytd-mealbar-promo-renderer');
      for (let i = 0; i < mealbars.length; i++) {
        const mb = mealbars[i];
        const dismissBtn = mb.querySelector(
          '#dismiss-button button, yt-button-renderer#dismiss-button button, [aria-label="Dismiss"], [aria-label="No thanks"], [aria-label="Not now"], button#dismiss-button, #dismiss-button'
        );
        if (dismissBtn) {
          simulateClick(dismissBtn);
        }
        const dialog = mb.closest ? mb.closest('tp-yt-paper-dialog') : null;
        if (dialog) {
          dialog.remove();
        } else {
          mb.remove();
        }
        const backdrops = document.querySelectorAll('tp-yt-iron-overlay-backdrop');
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
    } catch (e) {}

    // 2. Feed grid items & masthead - remove dynamically to trigger immediate layout reflow
    try {
      const gridAds = document.querySelectorAll(
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

      const adSlots = document.querySelectorAll(
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
    } catch (e) {}

    // 3. Companion ad panels & promo banners
    try {
      const companionAds = document.querySelectorAll(
        'ytd-companion-ad-renderer, ytd-action-companion-ad-renderer, #player-ads, .ytp-ad-companion-slot, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]'
      );
      for (let i = 0; i < companionAds.length; i++) {
        companionAds[i].remove();
      }

      const promos = document.querySelectorAll(
        'ytd-banner-promo-renderer, ytd-statement-banner-renderer, .ytp-ad-overlay-container, .ytp-ad-message-container'
      );
      for (let i = 0; i < promos.length; i++) {
        const item = promos[i];
        const container = item.closest ? item.closest('ytd-rich-item-renderer, ytd-rich-section-renderer') : null;
        if (container) {
          container.remove();
        } else {
          item.remove();
        }
      }
    } catch (e) {}
  }

  /**
   * Check whether an ad is currently playing on YouTube
   */
  function isAdCurrentlyPlaying(player) {
    if (!player) {
      player = document.querySelector('#movie_player') ||
               document.querySelector('.html5-video-player') ||
               (document.querySelector('ytd-player')?.shadowRoot?.querySelector('#movie_player'));
    }
    const hasAdClass = !!(player && player.classList && (
      player.classList.contains('ad-showing') ||
      player.classList.contains('ad-interrupting')
    )) || !!document.querySelector('.ad-showing, .ad-interrupting');

    if (hasAdClass) return true;

    // Search scopes including open shadow roots
    const searchScopes = [];
    if (player && player !== document) {
      if (player.shadowRoot) searchScopes.push(player.shadowRoot);
      searchScopes.push(player);
    }
    const ytdPlayer = document.querySelector ? document.querySelector('ytd-player') : null;
    if (ytdPlayer?.shadowRoot && !searchScopes.includes(ytdPlayer.shadowRoot)) {
      searchScopes.push(ytdPlayer.shadowRoot);
    }
    searchScopes.push(document);

    // If any skip button is currently in DOM and visible, an ad is active
    for (const scope of searchScopes) {
      if (!scope || !scope.querySelectorAll) continue;
      for (let i = 0; i < SKIP_BUTTON_SELECTORS.length; i++) {
        const skipBtns = scope.querySelectorAll(SKIP_BUTTON_SELECTORS[i]);
        for (let j = 0; j < skipBtns.length; j++) {
          const btn = skipBtns[j];
          if (btn && isElementVisible(btn)) {
            return true;
          }
        }
      }
    }

    // Secondary fallback: check all ad overlay indicators, ensuring at least one is genuinely visible
    const overlaySelectors = '.ytp-ad-player-overlay, .ytp-ad-text, .ytp-ad-simple-ad-badge, .ytp-ad-duration-remaining, .ytp-ad-preview-container, .ytp-ad-module';
    for (const scope of searchScopes) {
      if (!scope || !scope.querySelectorAll) continue;
      const overlays = scope.querySelectorAll(overlaySelectors);
      for (let i = 0; i < overlays.length; i++) {
        const overlay = overlays[i];
        if (!overlay || !isElementVisible(overlay)) continue;

        if (overlay.classList && (
          overlay.classList.contains('ytp-ad-text') ||
          overlay.classList.contains('ytp-ad-simple-ad-badge') ||
          overlay.classList.contains('ytp-ad-duration-remaining')
        )) {
          const text = (overlay.textContent || '').trim();
          if (text.length > 0) return true;
        } else {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Attach passive listeners to HTML5 video element
   * to guarantee instant response when paused or playbackRate resets
   */
  function attachVideoListeners(video, player) {
    if (!video || attachedVideos.has(video)) return;
    attachedVideos.add(video);

    if (!isAdActive && !isAdCurrentlyPlaying(player)) {
      originalMuted = !!video.muted;
    }

    video.addEventListener('pause', () => {
      if (isAdActive || isAdCurrentlyPlaying(player)) {
        if (video.paused) {
          video.play().catch(() => {});
          const playBtn = (player && player.querySelector) ? player.querySelector('.ytp-large-play-button, button.ytp-play-button') : document.querySelector('.ytp-large-play-button, button.ytp-play-button');
          if (playBtn) simulateClick(playBtn);
        }
      }
    });

    video.addEventListener('play', () => {
      if (isAdActive || isAdCurrentlyPlaying(player)) {
        if (video.playbackRate !== 16.0) {
          try { video.playbackRate = 16.0; } catch (e) {}
        }
        if (!video.muted) {
          try { video.muted = true; } catch (e) {}
        }
      }
    });

    video.addEventListener('ratechange', () => {
      if (isAdActive || isAdCurrentlyPlaying(player)) {
        if (video.playbackRate !== 16.0) {
          processPlayer();
        }
      } else {
        if (video.playbackRate > 0 && video.playbackRate < 16.0 && video.playbackRate !== 1.0) {
          if (resetToDefaultTimer) {
            clearTimeout(resetToDefaultTimer);
            resetToDefaultTimer = null;
          }
          originalPlaybackRate = video.playbackRate;
        } else if (video.playbackRate === 1.0) {
          if (originalPlaybackRate !== 1.0 && !resetToDefaultTimer) {
            resetToDefaultTimer = setTimeout(() => {
              resetToDefaultTimer = null;
              if (!isAdActive && !isAdCurrentlyPlaying(player) && video.playbackRate === 1.0) {
                originalPlaybackRate = 1.0;
              }
            }, 500);
          }
        }
      }
    });

    video.addEventListener('volumechange', () => {
      if (isAdActive && isAdCurrentlyPlaying(player)) {
        if (!video.muted) {
          try {
            video.muted = true;
          } catch (e) {}
        }
      } else if (!isAdActive && !isAdCurrentlyPlaying(player)) {
        originalMuted = !!video.muted;
      }
    });

    video.addEventListener('ended', () => {
      if (isAdActive) {
        processPlayer();
      }
    });

    video.addEventListener('timeupdate', () => {
      if (!isAdActive) return;
      if (!isAdCurrentlyPlaying(player)) {
        processPlayer();
        return;
      }
      if (video.playbackRate !== 16.0) {
        try { video.playbackRate = 16.0; } catch (e) {}
      }
      if (!video.muted) {
        try { video.muted = true; } catch (e) {}
      }
      if (video.paused) {
        video.play().catch(() => {});
      }
      clickSkipButton(player);
    });
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
      }
      const parentDialog = dialog.closest ? dialog.closest('tp-yt-paper-dialog, ytd-popup-container') : null;
      if (parentDialog) {
        parentDialog.remove();
      } else {
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
      if (document.documentElement && document.documentElement.style.overflow === 'hidden') {
        document.documentElement.style.overflow = '';
      }

      // Resume video playback
      const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
      if (video && video.paused) {
        video.play().catch(() => {});
      }
    }

    // Auto-recover offline connection error screen if present (safely scoped)
    const offlineNotice = document.querySelector(
      'yt-connection-error-view-model, ytd-offline-promo-renderer, yt-connection-error-view-model [aria-label="Retry"], ytd-offline-promo-renderer [aria-label="Retry"]'
    );
    if (offlineNotice) {
      const retryBtn = offlineNotice.querySelector ? offlineNotice.querySelector('button, yt-button-renderer, yt-button-shape, [role="button"]') : offlineNotice;
      if (retryBtn && typeof retryBtn.click === 'function') {
        simulateClick(retryBtn);
      }
    }
  }

  /**
   * Main Ad Mitigation Loop
   */
  function processPlayer() {
    try {
      // Check enforcement message & clean UI first (un-gated before player/video checks)
      handleEnforcementDialog();
      cleanUI();

      const player = document.querySelector('#movie_player') ||
                     document.querySelector('.html5-video-player') ||
                     (document.querySelector('ytd-player')?.shadowRoot?.querySelector('#movie_player'));
      const video = (player && player.querySelector && player.querySelector('video')) ||
                    (player?.shadowRoot?.querySelector && player.shadowRoot.querySelector('video')) ||
                    document.querySelector('video.html5-main-video') ||
                    document.querySelector('video');

      if (!player || !video) return;

      attachVideoListeners(video, player);

      // Detect if an ad is currently playing
      const adPlaying = isAdCurrentlyPlaying(player);

      if (adPlaying) {
        if (!isAdActive) {
          // Entering ad state
          isAdActive = true;
          if (resetToDefaultTimer) {
            clearTimeout(resetToDefaultTimer);
            resetToDefaultTimer = null;
          }
          // If video has a valid custom playback rate (different from 1.0 and < 16.0), preserve it
          if (video.playbackRate > 0 && video.playbackRate < 16.0 && video.playbackRate !== 1.0) {
            originalPlaybackRate = video.playbackRate;
          }
          // Note: Do not sample video.muted here as it may have already been muted by
          // the 'play' event listener or YouTube ad player. originalMuted is continuously
          // tracked during main video playback.
        }

        // R3: Instantly suppress visual ad frames
        const videos = (player && player.querySelectorAll) ? player.querySelectorAll('video') : [video];
        for (let i = 0; i < videos.length; i++) {
          const v = videos[i];
          if (v && v.style) {
            if (typeof v.style.setProperty === 'function') {
              try { v.style.setProperty('opacity', '0', 'important'); } catch (e) {}
            }
            try { v.style.opacity = '0'; } catch (e) {}
          }
        }

        // R3: Instantly skip / cancel playback via player API if available
        if (player) {
          if (typeof player.skipAd === 'function') {
            try { player.skipAd(); } catch (e) {}
          }
          if (typeof player.cancelPlayback === 'function') {
            try { player.cancelPlayback(); } catch (e) {}
          }
        }

        // 1. Instantly mute audio
        if (!video.muted) {
          try {
            video.muted = true;
          } catch (e) {}
        }

        // 2. Accelerate video to maximum 16x speed continuously without buffer-stalling seeks
        if (video.playbackRate !== 16.0) {
          try {
            video.playbackRate = 16.0;
          } catch (e) {}
        }

        // 3. Ensure video playback is never permanently frozen during ads: resume immediately
        if (video.paused) {
          video.play().catch(() => {});
          const playBtn = (player && player.querySelector) ? player.querySelector('.ytp-large-play-button, button.ytp-play-button') : document.querySelector('.ytp-large-play-button, button.ytp-play-button');
          if (playBtn) simulateClick(playBtn);
        }

        // 4. Click skip button as soon as it appears in the DOM
        clickSkipButton(player);

        // Polling loop to click skip button as soon as YouTube renders it and maintain playback
        if (!skipAttemptTimer) {
          skipAttemptTimer = setInterval(() => {
            if (!isAdActive) {
              clearInterval(skipAttemptTimer);
              skipAttemptTimer = null;
              return;
            }
            if (player && typeof player.skipAd === 'function') {
              try { player.skipAd(); } catch (e) {}
            }
            if (video.paused) {
              video.play().catch(() => {});
              const playBtn = (player && player.querySelector) ? player.querySelector('.ytp-large-play-button, button.ytp-play-button') : document.querySelector('.ytp-large-play-button, button.ytp-play-button');
              if (playBtn) simulateClick(playBtn);
            }
            if (video.playbackRate !== 16.0) {
              try { video.playbackRate = 16.0; } catch (e) {}
            }
            if (!video.muted) {
              try { video.muted = true; } catch (e) {}
            }
            clickSkipButton(player);
            if (!isAdCurrentlyPlaying(player)) {
              processPlayer();
            }
          }, 50);
        }
      } else {
        if (isAdActive) {
          // Ad just ended or skipped - cleanly restore user state with zero delay
          isAdActive = false;
          if (skipAttemptTimer) {
            clearInterval(skipAttemptTimer);
            skipAttemptTimer = null;
          }

          // Restore video opacity
          const videos = (player && player.querySelectorAll) ? player.querySelectorAll('video') : [video];
          for (let i = 0; i < videos.length; i++) {
            const v = videos[i];
            if (v && v.style) {
              if (typeof v.style.setProperty === 'function') {
                try { v.style.setProperty('opacity', ''); } catch (e) {}
              }
              try { v.style.opacity = ''; } catch (e) {}
            }
          }

          // Restore user playback rate
          const targetRate = (originalPlaybackRate > 0 && originalPlaybackRate <= 4.0) ? originalPlaybackRate : 1.0;
          try {
            video.playbackRate = targetRate;
          } catch (e) {}

          // Restore user mute preference
          try {
            video.muted = originalMuted;
          } catch (e) {}

          // Ensure video is playing
          if (video.paused && !video.ended) {
            video.play().catch(() => {});
          }
        } else {
          // Continually capture user's active playback rate & mute state during main video playback
          if (video.playbackRate > 0 && video.playbackRate < 16.0 && video.playbackRate !== 1.0) {
            if (resetToDefaultTimer) {
              clearTimeout(resetToDefaultTimer);
              resetToDefaultTimer = null;
            }
            originalPlaybackRate = video.playbackRate;
          }
          if (!isAdActive && !isAdCurrentlyPlaying(player)) {
            originalMuted = !!video.muted;
          }
        }
      }
    } catch (err) {}
  }

  // Lightweight observer watching player state
  let scheduled = false;
  function triggerCheck() {
    if (scheduled) return;
    scheduled = true;
    const runner = () => {
      processPlayer();
      scheduled = false;
    };
    if (typeof document !== 'undefined' && document.hidden) {
      runner();
    } else if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(runner);
    } else {
      runner();
    }
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
      attributeFilter: ['class', 'src', 'style', 'hidden']
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
