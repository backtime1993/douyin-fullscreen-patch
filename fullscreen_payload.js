// ═══════════════════════════════════════════════════════════════════
// DOUYIN TRUE FULLSCREEN PATCH V1-CLEAN
// 真全屏模式 — 按 F 或点击左下角按钮切换 · Escape 退出
// 保留弹幕 · 竖屏视频不裁切
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── Guard: only run in MAIN_WINDOW ──
  try {
    const wn = process.argv.find(a => a.startsWith('--window-name='));
    if (wn && !wn.includes('MAIN_WINDOW')) return;
  } catch (e) {}

  const FADE_MS = 280;
  const IDLE_MS = 2500;
  let active = false;
  let mouseTimer = null;
  let cursorTimer = null;
  let observer = null;
  let enforceTimer = null;
  let chromeSweepRaf = null;
  let chromeSweepFrames = 0;
  let btn = null;

  function log(msg) { console.log('[TRUE-FS] ' + msg); }

  // ═══════════════════════════════════════════════════════════════
  //  CSS
  // ═══════════════════════════════════════════════════════════════
  const CSS = `
/* ── Toggle Button ── */
#dyfs-btn {
  position: fixed; bottom: 20px; left: 20px;
  z-index: 2147483647;
  width: 40px; height: 40px; border-radius: 50%;
  background: rgba(0,0,0,.55); backdrop-filter: blur(8px);
  border: 1.5px solid rgba(255,255,255,.18);
  color: #fff; font-size: 18px; line-height: 40px; text-align: center;
  cursor: pointer; transition: all .25s ease;
  user-select: none; font-family: system-ui, sans-serif;
}
#dyfs-btn:hover { background: rgba(0,0,0,.8); transform: scale(1.1); }
#dyfs-btn.on { background: rgba(254,44,85,.65); border-color: rgba(254,44,85,.85); }
#dyfs-btn.hide { opacity: 0; pointer-events: none; }

/* ═══════════ FULLSCREEN MODE ═══════════ */
body.dyfs {
  overflow: hidden !important;
  background: #000 !important;
}

/* ─── 1. Route container covers entire viewport ─── */
body.dyfs .parent-route-container,
body.dyfs .parent-route-container.route-scroll-container {
  position: fixed !important;
  top: 0 !important; left: 0 !important;
  width: 100vw !important; height: 100vh !important;
  z-index: 2147483645 !important;
  background: #000 !important;
  box-sizing: border-box !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}

/* ─── 2. SLIDE LIST hierarchy ─── */
body.dyfs #slidelist,
body.dyfs .slidelist {
  width: 100vw !important; height: 100vh !important;
  min-height: 100vh !important;
  max-width: none !important; overflow: hidden !important;
}
body.dyfs [data-e2e="slideList"] {
  width: 100vw !important; height: 100vh !important;
  min-height: 100vh !important;
  max-width: none !important; overflow: hidden !important;
  top: 0 !important; left: 0 !important;
  scroll-snap-type: none !important;
}

/* ─── 3. EACH SLIDE ─── */
body.dyfs .dySwiperSlide,
body.dyfs .page-recommend-container {
  width: 100vw !important; height: 100vh !important;
  margin-bottom: 0 !important;
  margin-top: 0 !important;
  box-sizing: border-box !important;
  padding: 0 !important;
  overflow: hidden !important;
}

/* ─── 4. VIDEO CONTAINER CHAIN ─── */
body.dyfs .sliderVideo,
body.dyfs [data-e2e="feed-active-video"],
body.dyfs [data-e2e="feed-video"],
body.dyfs .playerContainer,
body.dyfs .slider-video,
body.dyfs .basePlayerContainer {
  width: 100vw !important; height: 100vh !important;
  max-width: none !important; max-height: none !important;
  box-sizing: border-box !important;
  background: #000 !important;
  margin: 0 !important; padding: 0 !important;
  overflow: hidden !important;
}
body.dyfs .xgplayer {
  width: 100vw !important; height: 100vh !important;
  background: #000 !important;
}
body.dyfs xg-video-container,
body.dyfs .xg-video-container {
  width: 100% !important; height: 100% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: hidden !important;
}

/* ─── 5. VIDEO ELEMENT (contain = no crop for portrait) ─── */
body.dyfs video {
  object-fit: contain !important;
  object-position: center top !important;
  display: block !important;
  width: 100% !important; height: 100% !important;
  max-width: 100vw !important; max-height: 100vh !important;
  margin: 0 !important; padding: 0 !important;
}

/* ─── 6. HIDE: Right interaction buttons ─── */
body.dyfs .positionBox,
body.dyfs [class*="positionBox"],
body.dyfs [data-e2e="video-player-digg"],
body.dyfs [data-e2e="feed-comment-icon"],
body.dyfs [data-e2e="video-player-collect"],
body.dyfs [data-e2e="video-player-share"],
body.dyfs [data-e2e="video-play-more"],
body.dyfs [data-e2e="video-avatar"],
body.dyfs [data-e2e="feed-follow-icon"] {
  opacity: 0 !important; pointer-events: none !important;
  transition: opacity ${FADE_MS}ms ease !important;
}

/* ─── 7. HIDE: Bottom video info / author / desc ─── */
body.dyfs .video-info-detail,
body.dyfs [class*="isVideoInfoOptimi"],
body.dyfs .video-info-mask,
body.dyfs [class*="video-info-mask"],
body.dyfs .xgplayer-video-info-wrap,
body.dyfs [class*="xgplayer-video-info-wrap"],
body.dyfs [data-e2e="video-info"],
body.dyfs [data-e2e="feed-video-nickname"],
body.dyfs [data-e2e="video-desc"],
body.dyfs .account-name,
body.dyfs .title.cursorPointer {
  opacity: 0 !important; pointer-events: none !important;
  transition: opacity ${FADE_MS}ms ease !important;
}

/* ─── 8. HIDE: Bottom bar / safety / tags / recommend ─── */
body.dyfs .feedbar-new-style,
body.dyfs [class*="feedbar"],
body.dyfs .safetyBar,
body.dyfs [class*="safetyBar"],
body.dyfs .under-title-tag,
body.dyfs [class*="under-title-tag"],
body.dyfs [data-e2e="feed-recommend"],
body.dyfs [class*="recommend-bar"],
body.dyfs [class*="recommendBar"],
body.dyfs [class*="RecommendBar"],
body.dyfs [class*="recommend_bar"] {
  display: none !important;
}

/* ─── 9. HIDE: Player controls ─── */
body.dyfs xg-controls,
body.dyfs xg-inner-controls,
body.dyfs xg-progress,
body.dyfs .xgplayer-controls,
body.dyfs .xg-inner-controls,
body.dyfs .xgplayer-progress,
body.dyfs xg-start,
body.dyfs xg-replay,
body.dyfs xg-prompt {
  opacity: 0 !important; pointer-events: none !important;
  transition: opacity ${FADE_MS}ms ease !important;
}

/* ─── 10. HIDE: Chapters only (danmu preserved) ─── */
body.dyfs .chapterContainer,
body.dyfs [data-e2e="chapter-container"] {
  display: none !important;
}

/* ─── 11. HIDE: Left nav sidebar ─── */
body.dyfs [data-e2e="douyin-navigation"] {
  display: none !important;
}

/* ─── 12. HIDE: Top-left hover chrome (search / back) ─── */
body.dyfs header,
body.dyfs nav,
body.dyfs [data-e2e*="search"],
body.dyfs [data-e2e*="back"],
body.dyfs [class*="searchBar"],
body.dyfs [class*="SearchBar"],
body.dyfs [class*="search-bar"],
body.dyfs [class*="searchBox"],
body.dyfs [class*="SearchBox"],
body.dyfs [class*="search-box"],
body.dyfs [class*="searchInput"],
body.dyfs [class*="SearchInput"],
body.dyfs [class*="search-input"],
body.dyfs [class*="topBar"],
body.dyfs [class*="TopBar"],
body.dyfs [class*="top-bar"],
body.dyfs [class*="backButton"],
body.dyfs [class*="BackButton"],
body.dyfs [class*="back-button"],
body.dyfs [class*="backArrow"],
body.dyfs [class*="BackArrow"],
body.dyfs [class*="backIcon"],
body.dyfs [class*="BackIcon"],
body.dyfs input[placeholder*="搜索"],
body.dyfs [placeholder*="搜索"],
body.dyfs [aria-label*="搜索"],
body.dyfs [title*="搜索"],
body.dyfs [aria-label*="返回"],
body.dyfs [title*="返回"] {
  opacity: 0 !important; pointer-events: none !important;
  transition: opacity ${FADE_MS}ms ease !important;
}

/* ─── 13. HIDE: Blur / gradient backgrounds ─── */
body.dyfs .imgBackground,
body.dyfs [class*="imgBackground"],
body.dyfs [class*="imgbackground"],
body.dyfs .backgroundCover,
body.dyfs [class*="backgroundCover"],
body.dyfs .background[class*="byYitTXq"] {
  display: none !important;
}

/* ─── 14. Cursor auto-hide ─── */
body.dyfs.cursor-hidden,
body.dyfs.cursor-hidden * { cursor: none !important; }

/* ─── 15. Toast ─── */
#dyfs-toast {
  position: fixed; top: 50%; left: 50%;
  transform: translate(-50%,-50%);
  background: rgba(0,0,0,.78); color: #fff;
  padding: 12px 26px; border-radius: 8px;
  font-size: 14px; z-index: 2147483647;
  font-family: system-ui, sans-serif;
  pointer-events: none; transition: opacity .5s;
  backdrop-filter: blur(8px);
}
`;

  // ═══════════════════════════════════════════════════════════════
  //  INJECT
  // ═══════════════════════════════════════════════════════════════
  function injectStyle() {
    if (document.getElementById('dyfs-style')) return;
    const el = document.createElement('style');
    el.id = 'dyfs-style';
    el.textContent = CSS;
    (document.head || document.documentElement).appendChild(el);
  }

  function createButton() {
    if (document.getElementById('dyfs-btn')) return document.getElementById('dyfs-btn');
    const b = document.createElement('div');
    b.id = 'dyfs-btn';
    b.textContent = '\u26F6';
    b.title = '\u771F\u5168\u5C4F (F)';
    b.addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault(); toggle();
    });
    document.body.appendChild(b);
    return b;
  }

  function isDyfsUi(el) {
    return !!(el && (el.id === 'dyfs-btn' || el.id === 'dyfs-toast' || (el.closest && el.closest('#dyfs-btn, #dyfs-toast'))));
  }

  function isVideoSurface(el) {
    return !!(el && el.matches && el.matches(
      'video, xg-video-container, .xg-video-container, .xgplayer, .basePlayerContainer, .playerContainer, [data-e2e="feed-active-video"], [data-e2e="feed-video"]'
    ));
  }

  function getElementMeta(el) {
    if (!el || el.nodeType !== 1) return '';
    return [
      el.getAttribute && el.getAttribute('placeholder'),
      el.getAttribute && el.getAttribute('aria-label'),
      el.getAttribute && el.getAttribute('title'),
      typeof el.className === 'string' ? el.className : '',
      el.textContent || ''
    ].join(' ').replace(/\s+/g, '');
  }

  function isTopLeftOverlay(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    var topLimit = Math.min(180, window.innerHeight * 0.25);
    var leftLimit = Math.min(520, window.innerWidth * 0.4);
    if (rect.top > topLimit || rect.left > leftLimit) return false;
    if (rect.width > Math.min(560, window.innerWidth * 0.55) || rect.height > 160) return false;

    var meta = getElementMeta(el);
    return /搜索|返回|search|Search|back|Back/.test(meta) || !!el.querySelector('input, svg, button');
  }

  function isBottomLeftRecommend(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    var leftLimit = Math.min(360, window.innerWidth * 0.28);
    if (rect.left > leftLimit || rect.bottom < window.innerHeight * 0.55) return false;
    if (rect.width > Math.min(360, window.innerWidth * 0.35) || rect.height > 120) return false;

    return /推荐/.test(getElementMeta(el));
  }

  function pickOverlayRoot(el, predicate) {
    var candidate = null;
    for (var node = el; node && node !== document.body; node = node.parentElement) {
      if (isDyfsUi(node)) return null;
      if (isVideoSurface(node)) return candidate;
      if (predicate(node)) candidate = node;
    }
    return candidate;
  }

  function hideElement(el) {
    if (!el || isDyfsUi(el) || isVideoSurface(el) || el.dataset.dyfsHidden === '1') return;

    el.dataset.dyfsHidden = '1';
    el.dataset.dyfsOldOpacity = el.style.opacity || '';
    el.dataset.dyfsOldPe = el.style.pointerEvents || '';
    el.dataset.dyfsOldVisibility = el.style.visibility || '';

    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('transition', 'opacity ' + FADE_MS + 'ms ease', 'important');
  }

  function restoreHiddenElements() {
    document.querySelectorAll('[data-dyfs-hidden="1"]').forEach(function (el) {
      el.style.opacity = el.dataset.dyfsOldOpacity || '';
      el.style.pointerEvents = el.dataset.dyfsOldPe || '';
      el.style.visibility = el.dataset.dyfsOldVisibility || '';
      el.style.removeProperty('transition');

      delete el.dataset.dyfsHidden;
      delete el.dataset.dyfsOldOpacity;
      delete el.dataset.dyfsOldPe;
      delete el.dataset.dyfsOldVisibility;
    });
  }

  function hideMatchingElements(selectors, predicate) {
    document.querySelectorAll(selectors).forEach(function (el) {
      var target = pickOverlayRoot(el, predicate);
      if (target) hideElement(target);
    });
  }

  function hideOverlayByPoint(x, y, predicate) {
    if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return;
    var el = document.elementFromPoint(x, y);
    if (!el) return;
    var target = pickOverlayRoot(el, predicate);
    if (target) hideElement(target);
  }

  function cleanupDynamicChrome() {
    if (!active) return;

    hideMatchingElements([
      'input[placeholder*="搜索"]',
      '[placeholder*="搜索"]',
      '[aria-label*="搜索"]',
      '[title*="搜索"]',
      '[aria-label*="返回"]',
      '[title*="返回"]',
      '[data-e2e*="search"]',
      '[data-e2e*="back"]',
      '[class*="search"]',
      '[class*="Search"]',
      '[class*="back"]',
      '[class*="Back"]'
    ].join(','), isTopLeftOverlay);

    hideMatchingElements([
      '[data-e2e*="recommend"]',
      '[class*="recommend"]',
      '[class*="Recommend"]'
    ].join(','), isBottomLeftRecommend);

    var searchY = Math.min(84, Math.max(48, window.innerHeight * 0.08));
    [24, 72, 136, 228, 320].forEach(function (x) {
      hideOverlayByPoint(x, searchY, isTopLeftOverlay);
    });

    var backY = Math.min(120, Math.max(56, window.innerHeight * 0.09));
    [16, 36, 56].forEach(function (x) {
      hideOverlayByPoint(x, backY, isTopLeftOverlay);
    });

    var recommendY = Math.max(window.innerHeight - 150, Math.floor(window.innerHeight * 0.76));
    [56, 112, 180].forEach(function (x) {
      hideOverlayByPoint(x, recommendY, isBottomLeftRecommend);
    });
  }

  function pumpChromeSweep() {
    chromeSweepRaf = null;
    if (!active) {
      chromeSweepFrames = 0;
      return;
    }

    cleanupDynamicChrome();
    chromeSweepFrames -= 1;

    if (chromeSweepFrames > 0) {
      chromeSweepRaf = requestAnimationFrame(pumpChromeSweep);
    }
  }

  function scheduleChromeSweep(frames) {
    if (!active) return;
    chromeSweepFrames = Math.max(chromeSweepFrames, frames || 10);
    if (!chromeSweepRaf) {
      chromeSweepRaf = requestAnimationFrame(pumpChromeSweep);
    }
  }

  function compensateVideoTopGap() {
    if (!active) return;

    document.querySelectorAll('video').forEach(function (v) {
      if (v.closest('.__pre_create_player__')) return;

      var rect = v.getBoundingClientRect();
      var gap = rect.top > 0.01 && rect.top <= 4 ? Math.ceil(rect.top) : 0;

      if (gap > 0) {
        v.dataset.dyfsTopGap = String(gap);
        v.style.setProperty('margin-top', (-gap) + 'px', 'important');
        v.style.setProperty('height', 'calc(100% + ' + gap + 'px)', 'important');
      } else {
        delete v.dataset.dyfsTopGap;
        v.style.removeProperty('margin-top');
        v.style.setProperty('height', '100%', 'important');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  CORE TOGGLE
  // ═══════════════════════════════════════════════════════════════
  function toggle() { active ? deactivate() : activate(); }

  function activate() {
    active = true;
    document.body.classList.add('dyfs');
    if (btn) btn.classList.add('on');

    enforceLayout();
    cleanupDynamicChrome();
    scheduleChromeSweep(18);
    startObserver();
    startEnforceLoop();
    resetMouseTimer();
    showToast('\u771F\u5168\u5C4F\u5DF2\u5F00\u542F');
    log('Fullscreen ON');
  }

  function deactivate() {
    active = false;
    document.body.classList.remove('dyfs', 'cursor-hidden');
    if (btn) btn.classList.remove('on', 'hide');

    restoreLayout();
    restoreHiddenElements();
    stopObserver();
    stopEnforceLoop();
    if (chromeSweepRaf) {
      cancelAnimationFrame(chromeSweepRaf);
      chromeSweepRaf = null;
    }
    chromeSweepFrames = 0;
    clearTimeout(mouseTimer);
    clearTimeout(cursorTimer);
    showToast('\u771F\u5168\u5C4F\u5DF2\u5173\u95ED');
    log('Fullscreen OFF');
  }

  // ═══════════════════════════════════════════════════════════════
  //  LAYOUT ENFORCEMENT — override inline styles set by Douyin JS
  // ═══════════════════════════════════════════════════════════════
  function enforceLayout() {
    if (!active) return;

    document.querySelectorAll('.dySwiperSlide, .page-recommend-container').forEach(function (el) {
      el.style.setProperty('height', '100vh', 'important');
      el.style.setProperty('min-height', '100vh', 'important');
      el.style.setProperty('margin-top', '0', 'important');
      el.style.setProperty('margin-bottom', '0', 'important');
      el.style.setProperty('padding', '0', 'important');
    });

    document.querySelectorAll('#slidelist, .slidelist, [data-e2e="slideList"]').forEach(function (el) {
      el.style.setProperty('height', '100vh', 'important');
      el.style.setProperty('width', '100vw', 'important');
      el.style.setProperty('min-height', '100vh', 'important');
    });

    document.querySelectorAll('video').forEach(function (v) {
      if (v.closest('.__pre_create_player__')) return;
      v.style.setProperty('object-fit', 'contain', 'important');
      v.style.setProperty('object-position', 'center top', 'important');
      v.style.setProperty('width', '100%', 'important');
      v.style.setProperty('height', '100%', 'important');
      v.style.setProperty('max-width', '100vw', 'important');
      v.style.setProperty('max-height', '100vh', 'important');
    });

    compensateVideoTopGap();
    cleanupDynamicChrome();
  }

  function restoreLayout() {
    var selectors = ['.dySwiperSlide', '.page-recommend-container', '#slidelist', '.slidelist', '[data-e2e="slideList"]'];
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        el.style.removeProperty('height');
        el.style.removeProperty('width');
        el.style.removeProperty('min-height');
        el.style.removeProperty('margin-top');
        el.style.removeProperty('margin-bottom');
        el.style.removeProperty('padding');
      });
    });
    document.querySelectorAll('video').forEach(function (v) {
      v.style.removeProperty('object-fit');
      v.style.removeProperty('object-position');
      v.style.removeProperty('width');
      v.style.removeProperty('height');
      v.style.removeProperty('margin-top');
      v.style.removeProperty('max-width');
      v.style.removeProperty('max-height');
      delete v.dataset.dyfsTopGap;
    });
  }

  function startEnforceLoop() {
    stopEnforceLoop();
    enforceTimer = setInterval(function () {
      if (active) enforceLayout();
    }, 500);
  }
  function stopEnforceLoop() {
    if (enforceTimer) { clearInterval(enforceTimer); enforceTimer = null; }
  }

  // ═══════════════════════════════════════════════════════════════
  //  MUTATION OBSERVER — react to video switches
  // ═══════════════════════════════════════════════════════════════
  function startObserver() {
    if (observer) return;
    var debounce = null;
    observer = new MutationObserver(function () {
      if (!active) return;
      cleanupDynamicChrome();
      scheduleChromeSweep(18);
      clearTimeout(debounce);
      debounce = setTimeout(enforceLayout, 80);
    });

    var target = document.getElementById('slidelist') || document.body;
    observer.observe(target, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (observer) { observer.disconnect(); observer = null; }
  }

  // ═══════════════════════════════════════════════════════════════
  //  EVENTS
  // ═══════════════════════════════════════════════════════════════
  function resetMouseTimer() {
    clearTimeout(mouseTimer);
    clearTimeout(cursorTimer);
    mouseTimer = setTimeout(function () {
      if (active && btn) btn.classList.add('hide');
    }, IDLE_MS);
    cursorTimer = setTimeout(function () {
      if (active) document.body.classList.add('cursor-hidden');
    }, IDLE_MS);
  }

  function setupEvents() {
    document.addEventListener('keydown', function (e) {
      if (e.key.toLowerCase() !== 'f') return;
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      var tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.target.isContentEditable) return;
      e.preventDefault();
      e.stopPropagation();
      toggle();
    }, true);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && active) {
        e.preventDefault();
        e.stopPropagation();
        deactivate();
      }
    }, true);

    document.addEventListener('mousemove', function () {
      if (!active) return;
      document.body.classList.remove('cursor-hidden');
      if (btn) btn.classList.remove('hide');
      cleanupDynamicChrome();
      resetMouseTimer();
    }, { passive: true });

    document.addEventListener('wheel', function () {
      if (!active) return;
      scheduleChromeSweep(18);
    }, { passive: true });

    document.addEventListener('keydown', function (e) {
      if (!active) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'PageUp' || e.key === 'PageDown') {
        scheduleChromeSweep(18);
      }
    }, true);
  }

  // ═══════════════════════════════════════════════════════════════
  //  TOAST
  // ═══════════════════════════════════════════════════════════════
  function showToast(text) {
    var toast = document.getElementById('dyfs-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'dyfs-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toast.style.opacity = '0'; }, 1800);
  }

  // ═══════════════════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════════════════
  function init() {
    if (!document.getElementById('slidelist') && !document.querySelector('.slidelist')) {
      setTimeout(init, 2000);
      return;
    }

    injectStyle();
    btn = createButton();
    setupEvents();
    log('Ready \u2014 press F or click button for true fullscreen');
    setTimeout(function () {
      showToast('\u771F\u5168\u5C4F\u5DF2\u5C31\u7EEA \u00B7 \u6309 F \u5207\u6362');
    }, 3000);
  }

  if (document.body) {
    setTimeout(init, 3000);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 3000); });
  } else {
    var poll = setInterval(function () {
      if (document.body) { clearInterval(poll); setTimeout(init, 3000); }
    }, 200);
  }
})();

// ═══════════════════════════════════════════════════════════════════
// DOUYIN CLEAN MODE PERSISTENCE MODULE
// 让"清屏"开关默认开启，切视频后不被重置
// ═══════════════════════════════════════════════════════════════════
(function cleanModeModule() {
  'use strict';

  try {
    var wn = process.argv.find(function (a) { return a.startsWith('--window-name='); });
    if (wn && !wn.includes('MAIN_WINDOW')) return;
  } catch (e) {}

  // DEBUG=true 时才把探测日志写入磁盘。生产版本只保留 click 事件。
  var DEBUG = false;
  var PROBE_LOG = null;
  try {
    if (DEBUG) {
      var os = require('os');
      var path = require('path');
      PROBE_LOG = path.join(os.tmpdir(), 'douyin-clean-probe.log');
    }
  } catch (e) {}

  function log() {
    var args = Array.prototype.slice.call(arguments);
    try { console.log.apply(console, ['[CLEAN-MODE]'].concat(args)); } catch (e) {}
    if (PROBE_LOG) {
      try {
        var line = new Date().toISOString() + ' ' + args.map(function (a) {
          try { return typeof a === 'string' ? a : JSON.stringify(a); } catch (e) { return String(a); }
        }).join(' ') + '\n';
        require('fs').appendFileSync(PROBE_LOG, line);
      } catch (e) {}
    }
  }

  // ── 状态快照（避免短时间内重复点击） ──
  var lastActionAt = 0;
  var ACTION_COOLDOWN_MS = 800;

  // ── 查找所有清屏按钮（基于 7.7.0 探测结果的精确选择器） ──
  // DOM 结构：
  //   xg-icon.xgplayer-immersive-switch-setting.immersive-switch
  //     └─ div.xgplayer-icon
  //        └─ div.xgplayer-setting-label
  //           ├─ button.xg-switch[.xg-switch-checked]  ← 目标
  //           └─ span.xgplayer-setting-title ("清屏")
  // 注意：抖音有多个播放器实例（active + 预加载的 inactive），都要处理
  function findAllCleanButtons() {
    var btns = document.querySelectorAll(
      'xg-icon.xgplayer-immersive-switch-setting button.xg-switch, ' +
      '[class*="immersive-switch"] button.xg-switch'
    );
    return Array.prototype.slice.call(btns);
  }

  function findCleanButton() {
    var all = findAllCleanButtons();
    return all[0] || null;
  }

  // ── 判断清屏是否已开启（基于 xg-switch-checked class） ──
  function isCleanOn(btn) {
    if (!btn) return null;
    var cls = ((btn.className || '') + '');
    if (cls.indexOf('xg-switch-checked') >= 0) return true;
    // 兄弟元素（xg-switch 的同级 label/title）有 checked 标记
    var parent = btn.parentElement;
    if (parent && (parent.className + '').indexOf('checked') >= 0) return true;
    return false;
  }

  // ── 向上遍历找 React onClick handler ──
  function findReactOnClick(el) {
    var cur = el;
    for (var depth = 0; depth < 6 && cur && cur !== document.body; depth++) {
      try {
        var keys = Object.keys(cur);
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          if (k.indexOf('__reactProps$') === 0 || k.indexOf('__reactEventHandlers$') === 0) {
            var props = cur[k];
            if (props && typeof props.onClick === 'function') {
              return { fn: props.onClick, el: cur, depth: depth };
            }
          }
        }
      } catch (e) {}
      cur = cur.parentElement;
    }
    return null;
  }

  // ── 模拟点击（优先 React onClick handler） ──
  function clickButton(btn) {
    if (!btn) return false;
    var found = findReactOnClick(btn);
    if (found) {
      try {
        var evt = {
          type: 'click',
          target: btn,
          currentTarget: found.el,
          preventDefault: function () {},
          stopPropagation: function () {},
          isTrusted: true,
          nativeEvent: new MouseEvent('click', { bubbles: true, cancelable: true })
        };
        found.fn(evt);
        log('click via React onClick depth=' + found.depth + ' el=' + (found.el.tagName || '?'));
        return true;
      } catch (e) { log('react click err', String(e)); }
    }

    // Fallback: 合成 DOM 事件序列（冒泡到 React root）
    try {
      ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (t) {
        var Ctor = t.indexOf('pointer') === 0 ? (window.PointerEvent || MouseEvent) : MouseEvent;
        btn.dispatchEvent(new Ctor(t, { bubbles: true, cancelable: true, view: window }));
      });
      log('click via dispatchEvent');
      return true;
    } catch (e) {
      try { btn.click(); log('click via .click()'); return true; }
      catch (e2) { log('click all failed', String(e2)); return false; }
    }
  }

  // ── 核心：确保所有播放器实例的清屏开启 ──
  var PROBE_ONLY = false;
  function ensureCleanMode() {
    if (PROBE_ONLY) return;
    var now = Date.now();
    if (now - lastActionAt < ACTION_COOLDOWN_MS) return;
    var btns = findAllCleanButtons();
    if (!btns.length) return;
    var clickedAny = false;
    for (var i = 0; i < btns.length; i++) {
      var btn = btns[i];
      if (isCleanOn(btn) === false) {
        var ok = clickButton(btn);
        if (ok) {
          clickedAny = true;
          log('清屏[' + i + '/' + btns.length + '] 关→开', 'cls=' + (btn.className || '').slice(0, 60));
        }
      }
    }
    if (clickedAny) lastActionAt = now;
  }

  // ── 深度探测：收集所有可能的清屏候选 ──
  function nodePath(el, depth) {
    if (!el) return '';
    var parts = [];
    var cur = el;
    for (var i = 0; i < (depth || 4) && cur && cur !== document.body; i++) {
      var seg = cur.tagName.toLowerCase();
      if (cur.className) seg += '.' + (cur.className + '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
      if (cur.getAttribute && cur.getAttribute('data-e2e')) seg += '[data-e2e=' + cur.getAttribute('data-e2e') + ']';
      parts.unshift(seg);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function describeEl(el) {
    if (!el) return null;
    var r = el.getBoundingClientRect ? el.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0 };
    var cs = null;
    try { cs = getComputedStyle(el); } catch (e) {}
    return {
      tag: el.tagName,
      cls: (el.className || '').toString().slice(0, 180),
      dataE2e: el.getAttribute && el.getAttribute('data-e2e'),
      ariaChecked: el.getAttribute && el.getAttribute('aria-checked'),
      role: el.getAttribute && el.getAttribute('role'),
      text: (el.textContent || '').trim().slice(0, 40),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      bg: cs && cs.backgroundColor,
      path: nodePath(el, 5),
      reactKeys: Object.keys(el).filter(function (k) { return k.indexOf('__react') === 0; }).slice(0, 3)
    };
  }

  function probeDetailed() {
    if (!DEBUG || !PROBE_LOG) return;
    try {
      // 1. 所有文字 === "清屏" 的候选
      var candidates = [];
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          return (n.nodeValue || '').trim() === '清屏' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      var n;
      while ((n = walker.nextNode())) {
        var el = n.parentElement;
        if (!el) continue;
        candidates.push({
          el: describeEl(el),
          parent: describeEl(el.parentElement),
          grandparent: el.parentElement && describeEl(el.parentElement.parentElement),
          prevSib: describeEl(el.previousElementSibling),
          prevSibOfParent: el.parentElement && describeEl(el.parentElement.previousElementSibling),
          neighbors: Array.from((el.parentElement && el.parentElement.children) || []).map(function (c) {
            return (c.textContent || '').trim().slice(0, 20);
          }).filter(Boolean).slice(0, 10)
        });
      }
      log('probe.candidates.count=' + candidates.length);
      candidates.forEach(function (c, i) {
        log('probe.candidate[' + i + ']', c);
      });

      // 2. data-e2e 含 clean/clear 的元素
      var e2es = document.querySelectorAll('[data-e2e*="clean"],[data-e2e*="clear"]');
      log('probe.e2e.count=' + e2es.length);
      e2es.forEach(function (el, i) { log('probe.e2e[' + i + ']', describeEl(el)); });

      // 3. xgplayer 相关控件
      var xgControls = document.querySelectorAll(
        '[class*="xgplayer-controls"] [class*="switch"], xg-controls *'
      );
      log('probe.xgControls.count=' + xgControls.length);

      // 4. 所有 switch/toggle 元素
      var switches = document.querySelectorAll('[class*="switch"],[class*="toggle"],[role="switch"]');
      log('probe.switches.count=' + switches.length);
      Array.from(switches).slice(0, 15).forEach(function (el, i) {
        log('probe.switch[' + i + ']', describeEl(el));
      });
    } catch (e) { log('probeDetailed err', String(e), e.stack); }
  }

  // ── 探测快照（每次触发都记录一次，便于调试） ──
  function probeSnapshot(trigger) {
    if (!DEBUG || !PROBE_LOG) return;
    try {
      var btn = findCleanButton();
      if (!btn) {
        log('probe[' + trigger + ']', 'btn not found');
        return;
      }
      var info = {
        trigger: trigger,
        tag: btn.tagName,
        cls: (btn.className || '').toString().slice(0, 200),
        dataE2e: btn.getAttribute && btn.getAttribute('data-e2e'),
        parentCls: btn.parentElement && (btn.parentElement.className || '').toString().slice(0, 200),
        reactKeys: Object.keys(btn).filter(function (k) {
          return k.indexOf('__react') === 0;
        }),
        isCleanOnResult: isCleanOn(btn),
        rect: btn.getBoundingClientRect && (function () {
          var r = btn.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        })()
      };
      log('probe', info);
    } catch (e) { log('probe err', String(e)); }
  }

  // ── 切视频监听：hook <video> 的 loadstart ──
  function hookVideoLoadStart() {
    document.addEventListener('loadstart', function (e) {
      if (e.target && e.target.tagName === 'VIDEO') {
        setTimeout(ensureCleanMode, 250);
        setTimeout(ensureCleanMode, 800);
      }
    }, true);
  }

  // ── 启动 ──
  // 重要：只在首次加载和视频切换时触发 ensureCleanMode，
  // 不用 MutationObserver/setInterval 兜底，
  // 否则用户手动关清屏会被立即反弹回去，破坏 UX。
  function start() {
    if (!document.body) { setTimeout(start, 200); return; }
    log('clean-mode-module start, log=', PROBE_LOG || '(no fs)');

    // 首次进入：等 3/6 秒让页面加载完再各触发一次，把默认关的清屏开起来
    setTimeout(function () { probeSnapshot('initial'); probeDetailed(); ensureCleanMode(); }, 3000);
    setTimeout(function () { probeDetailed(); ensureCleanMode(); }, 6000);

    // 切视频触发：hook <video> 的 loadstart（hookVideoLoadStart 内部会 200ms + 800ms 各触发一次）
    hookVideoLoadStart();
  }

  if (document.body) {
    setTimeout(start, 100);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    var poll = setInterval(function () {
      if (document.body) { clearInterval(poll); start(); }
    }, 200);
  }
})();
