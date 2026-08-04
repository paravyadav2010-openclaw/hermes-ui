/**
 * Build-time mobile patch injector (ESM .mjs).
 */
import { writeFile, readFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const MOBILE_VIEWPORT = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
const PATCH_VERSION = 7

const GESTURE_SCRIPT = `(function() {
  if (!('ontouchstart' in window)) return;
  var openSide = null;
  var lastAction = 0;
  function toggleLeft() {
    openSide = openSide === 'left' ? null : 'left';
    window.dispatchEvent(new CustomEvent('hermes:pane-toggle-reveal', { detail: { id: 'chat-sidebar' } }));
  }
  function toggleRight() {
    openSide = openSide === 'right' ? null : 'right';
    window.dispatchEvent(new CustomEvent('hermes:pane-toggle-reveal', { detail: { id: 'file-browser' } }));
  }
  var PTR_T = 140, PTR_R = 1.8;
  var ptrY = 0, ptrOn = false, ptrI = null, ptrB = null, ptrHit = false;
  var swipeAxis = null;
  function mkP() {
    if (ptrI) return;
    ptrB = document.createElement('div');
    ptrB.style.cssText = 'position:fixed;top:0;left:0;right:0;height:0;background:linear-gradient(180deg,rgba(255,255,255,0.04),transparent);z-index:9998;transition:height .2s cubic-bezier(.22,1,.36,1);pointer-events:none;';
    document.body.appendChild(ptrB);
    ptrI = document.createElement('div');
    ptrI.style.cssText = 'position:fixed;top:-60px;left:50%;transform:translateX(-50%) scale(0.5);width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.08);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1.5px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;z-index:9999;transition:transform .3s cubic-bezier(.22,1,.36,1),top .3s cubic-bezier(.22,1,.36,1),opacity .25s;pointer-events:none;opacity:0;box-shadow:0 4px 16px rgba(0,0,0,.3);';
    ptrI.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:rgba(255,255,255,0.7);transition:transform .3s cubic-bezier(.22,1,.36,1)"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0"/><path d="M12 8v4"/><path d="m10.5 10.5L12 12l1.5-1.5"/></svg>';
    document.body.appendChild(ptrI);
  }
  function rstP() {
    ptrOn = false; ptrHit = false;
    if (ptrI) { ptrI.style.top = '-60px'; ptrI.style.opacity = '0'; ptrI.style.transform = 'translateX(-50%) scale(0.5)'; var a = ptrI.querySelector('svg'); if (a) a.style.transform = 'rotate(0deg)'; }
    if (ptrB) ptrB.style.height = '0';
  }
  var sx = 0, sy = 0, st = 0, startedOnEdge = false;
  document.addEventListener('touchstart', function(e) {
    var t = e.touches[0];
    sx = t.clientX; sy = t.clientY; st = Date.now();
    swipeAxis = null;
    startedOnEdge = (sx < 24) || (sx > window.innerWidth - 24);
    if (window.scrollY <= 3 && !startedOnEdge) {
      ptrY = t.clientY; ptrOn = true; ptrHit = false;
    } else { ptrOn = false; }
  }, { passive: true });
  document.addEventListener('touchmove', function(e) {
    var t = e.touches[0];
    var dx = t.clientX - sx;
    var dy = t.clientY - sy;
    var adx = Math.abs(dx), ady = Math.abs(dy);
    if (!swipeAxis && (adx > 12 || ady > 12)) { swipeAxis = adx > ady ? 'h' : 'v'; }
    if (ptrOn && swipeAxis === 'v' && ady > adx) {
      if (window.scrollY > 3) { rstP(); return; }
      var pull = Math.max(0, dy) / PTR_R;
      if (pull <= 0) return;
      var p = Math.min(pull / PTR_T, 1);
      mkP();
      ptrI.style.top = Math.min(pull * 0.5, 45) + 'px';
      ptrI.style.opacity = Math.min(p * 1.3, 1);
      ptrI.style.transform = 'translateX(-50%) scale(' + (0.5 + p * 0.5) + ')';
      var a = ptrI.querySelector('svg');
      if (a) a.style.transform = 'rotate(' + (p * 180) + 'deg)';
      ptrB.style.height = (pull * 0.2) + 'px';
      if (p >= 1 && !ptrHit) { ptrHit = true; if (navigator.vibrate) navigator.vibrate(8); }
      else if (p < 1) { ptrHit = false; }
    } else if (ptrOn && swipeAxis === 'h') { rstP(); }
  }, { passive: true });
  document.addEventListener('touchend', function(e) {
    var now = Date.now();
    var t = e.changedTouches[0];
    var dx = t.clientX - sx;
    var dy = t.clientY - sy;
    var adx = Math.abs(dx), ady = Math.abs(dy);
    var dt = now - st;
    if (ptrOn) {
      var pull = Math.max(0, dy) / PTR_R;
      if (ptrHit && pull >= PTR_T && ady < 60 && dt < 1500) {
        if (ptrI) { ptrI.style.top = '32px'; ptrI.style.opacity = '1'; ptrI.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:rgba(255,255,255,0.9);animation:ptr-spin 0.9s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>'; }
        if (navigator.vibrate) navigator.vibrate(15);
        setTimeout(function() { window.location.reload(); }, 450);
      } else { rstP(); }
      ptrOn = false; return;
    }
    if (now - lastAction < 350) return;
    if (adx < 60) return;
    if (adx <= ady * 1.3) return;
    lastAction = now;
    if (dx > 0) {
      if (openSide === 'left') toggleLeft();
      else if (openSide === 'right') toggleRight();
      else toggleLeft();
    } else {
      if (openSide === 'right') toggleRight();
      else if (openSide === 'left') toggleLeft();
      else toggleRight();
    }
  }, { passive: true });
  document.addEventListener('click', function(e) {
    var t = e.target;
    if (t.closest('[data-slot="sheet-trigger"]')) return;
    if (t.closest('[data-slot="sheet-content"]')) return;
    if (t.closest('[data-pane]') || t.closest('[data-file-browser]') || t.closest('[data-panel]')) return;
    if (openSide === 'left') toggleLeft();
    else if (openSide === 'right') toggleRight();
  }, true);
  var s = document.createElement('style');
  s.textContent = '@keyframes ptr-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}';
  document.head.appendChild(s);

  // iOS-style swipe-back: edge swipe from left = history.back()
  var sbX = 0, sbActive = false;
  document.addEventListener('touchstart', function(e) {
    var t = e.touches[0];
    if (t.clientX < 30 && window.history.length > 1) {
      sbX = t.clientX; sbActive = true;
    } else { sbActive = false; }
  }, { passive: true });
  document.addEventListener('touchmove', function(e) {
    if (!sbActive) return;
    var dx = e.touches[0].clientX - sbX;
    if (dx > 80) { sbActive = false; window.history.back(); }
  }, { passive: true });
  document.addEventListener('touchend', function(e) {
    if (!sbActive) return;
    var dx = e.changedTouches[0].clientX - sbX;
    if (dx > 60 && window.history.length > 1) { window.history.back(); }
    sbActive = false;
  }, { passive: true });
})()`

const HOME_SCREEN_BANNER = `(function() {
  if (!('ontouchstart' in window)) return;
  if (window.navigator.standalone) return;
  // Skip inside the native Capacitor wrapper (com.pravdev.hermesmobile) — the
  // banner is only for Safari web users; the native app IS the installed app.
  // Guard is required: this script is injected into <head>, where
  // document.body is null — an unguarded appendChild throws on every launch
  // and breaks native UI probes. (fix 2026-08-04, finch:work)
  if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) return;
  try { if (localStorage.getItem('hermes-hs-banner-dismissed')) return; } catch(e) { return; }
  function showBanner() {
    if (!document.body) return;
    var banner = document.createElement('div');
    banner.id = 'hermes-hs-banner';
    banner.innerHTML = '<div style="display:flex;align-items:center;gap:10px;flex:1"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><path d="M5 20V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><path d="M12 4v8"/><path d="m9 9 3 3 3-3"/></svg><div style="flex:1;font-size:13px;line-height:1.3"><div style="font-weight:600;margin-bottom:2px">Install Hermes</div><div style="opacity:0.7;font-size:12px">Share \\u2192 Add to Home Screen for full-screen app</div></div><button id="hermes-hs-close" style="background:none;border:none;color:inherit;padding:4px;cursor:pointer;opacity:0.5;font-size:18px;line-height:1">\\u2715</button></div>';
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:rgba(20,20,22,0.92);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);color:#fff;padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom,0px));font-family:-apple-system,BlinkMacSystemFont,sans-serif;transform:translateY(100%);transition:transform 0.4s cubic-bezier(.22,1,.36,1);border-top:1px solid rgba(255,255,255,0.08);';
    document.body.appendChild(banner);
    requestAnimationFrame(function() { banner.style.transform = 'translateY(0)'; });
    document.getElementById('hermes-hs-close').addEventListener('click', function() {
      banner.style.transform = 'translateY(100%)';
      try { localStorage.setItem('hermes-hs-banner-dismissed', '1'); } catch(e) {}
      setTimeout(function() { banner.remove(); }, 400);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showBanner);
  } else {
    showBanner();
  }
})()`

const KEYBOARD_HANDLER = `(function() {
  if (!('ontouchstart' in window) || !window.visualViewport) return;
  var lastHeight = window.visualViewport.height;
  window.visualViewport.addEventListener('resize', function() {
    var newHeight = window.visualViewport.height;
    if (newHeight < lastHeight) {
      // Keyboard opened — scroll active element into view, gently
      var active = document.activeElement;
      if (active && typeof active.scrollIntoView === 'function') {
        setTimeout(function() { active.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 100);
      }
    } else if (newHeight > lastHeight) {
      // Keyboard closed — restore scroll to bottom
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
    lastHeight = newHeight;
  });
})()`

async function fileExists(p) {
  try {
    await access(p, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export function hermesMobilePatches() {
  return {
    name: 'hermes-mobile-patches',
    apply: 'build',
    enforce: 'post',

    transformIndexHtml(html) {
      const viewportReplaced = html.replace(
        /<meta\s+name="viewport"[^>]*>/,
        '<meta name="viewport" content="' + MOBILE_VIEWPORT + '" />'
      )
      const swName = 'sw-v' + PATCH_VERSION + '.js'
      const injectBlock = [
        '<script>' + GESTURE_SCRIPT + '</script>',
        '<script>' + HOME_SCREEN_BANNER + '</script>',
        '<script>' + KEYBOARD_HANDLER + '</script>',
        '<script>if("serviceWorker" in navigator) { navigator.serviceWorker.register("/' + swName + '") }</script>'
      ].join('\n')
      return viewportReplaced.replace('</head>', injectBlock + '\n</head>')
    },

    async closeBundle() {
      const distDir = resolve(__dirname, 'dist')
      const swSrc = resolve(distDir, 'sw.js')
      const swDest = resolve(distDir, 'sw-v' + PATCH_VERSION + '.js')
      if (!(await fileExists(swSrc))) return
      const original = await readFile(swSrc, 'utf-8')
      const noSkip = original.replace(/self\.skipWaiting\(\)\s*,?\s*/g, '')
      const marker = '/* hermes-mobile-patches v' + PATCH_VERSION + ' */\n'
      await writeFile(swDest, marker + noSkip, 'utf-8')
    }
  }
}