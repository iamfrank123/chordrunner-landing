/* ============================================================
   MIDI Chord Runner — Mobile PWA Manager (pwa.js)
   Handles:
     1. Mobile device detection → loads mobile.css
     2. Service worker registration
     3. Rotate-to-landscape prompt
     4. Android: BeforeInstallPrompt → Install button
     5. iOS: manual Add-to-Home-Screen instructions toast
   ============================================================ */

(function () {
  'use strict';

  /* ── 1. Device detection ─────────────────────────────────── */
  var isMobile = window.matchMedia('(pointer: coarse)').matches
    || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  if (!isMobile) return; // desktop: do nothing

  // Mark <html> so mobile.css rules activate
  document.documentElement.classList.add('mobile-device');

  /* ── 2. Inject mobile.css ────────────────────────────────── */
  (function injectCSS() {
    // Resolve path relative to where pwa.js lives (mobile/ folder)
    var scriptSrc = (document.currentScript && document.currentScript.src) || '';
    var base = scriptSrc.replace(/pwa\.js.*$/, '');
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = base + 'mobile.css';
    document.head.appendChild(link);
  })();

  /* ── 3. Register service worker ──────────────────────────── */
  (function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    // SW must be served from the scope root, not the mobile/ subfolder
    var swPath = window.CR_SW_PATH || '/mobile/sw.js';
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(swPath, { scope: '/' })
        .then(function (reg) {
          console.log('[PWA] SW registered, scope:', reg.scope);
        })
        .catch(function (err) {
          console.warn('[PWA] SW registration failed:', err);
        });
    });
  })();

  /* ── 4. Rotate-to-landscape prompt ──────────────────────── */
  /* Only shown inside the actual game page (game.html), NOT on the landing */
  (function setupRotatePrompt() {
    // Only activate on the game screen, not the demo landing page
    var isGamePage = /game\.html/i.test(window.location.pathname) ||
                     /\/game\/?$/i.test(window.location.pathname);
    if (!isGamePage) return;

    var prompt = null;

    function isPortrait() {
      return window.innerHeight > window.innerWidth;
    }

    function createPrompt() {
      if (prompt) return;
      prompt = document.createElement('div');
      prompt.id = 'cr-rotate-prompt';
      prompt.innerHTML =
        '<div class="cr-rotate-icon">📱</div>' +
        '<div class="cr-rotate-title">Rotate your device</div>' +
        '<div class="cr-rotate-sub">This game is designed for landscape mode. Please rotate your device horizontally.</div>';
      document.body.appendChild(prompt);
    }

    function removePrompt() {
      if (prompt && prompt.parentNode) {
        prompt.parentNode.removeChild(prompt);
        prompt = null;
      }
    }

    function check() {
      if (isPortrait()) {
        createPrompt();
      } else {
        removePrompt();
      }
    }

    // Run on load and on resize/orientation change
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', check);
    } else {
      check();
    }

    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', function () {
      // Small delay to let browser update dimensions after rotation
      setTimeout(check, 150);
    });
  })();

  /* ── 5. Android: Install button (BeforeInstallPrompt) ────── */
  (function setupAndroidInstall() {
    // Skip if already running in standalone / already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (window.navigator.standalone) return; // iOS standalone

    var deferredPrompt = null;
    var installBtn = null;

    function createInstallBtn() {
      if (installBtn) return;
      installBtn = document.createElement('button');
      installBtn.id = 'cr-install-btn';
      installBtn.setAttribute('aria-label', 'Install app');
      installBtn.innerHTML = '<span class="cr-install-icon">📲</span> Install App';
      installBtn.addEventListener('click', function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (result) {
          if (result.outcome === 'accepted') {
            hideInstallBtn();
          }
          deferredPrompt = null;
        });
      });
      document.body.appendChild(installBtn);
    }

    function hideInstallBtn() {
      if (installBtn) {
        installBtn.classList.add('cr-hidden');
      }
    }

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;

      // Only show on mobile
      if (isMobile) {
        createInstallBtn();
      }
    });

    // Hide after install
    window.addEventListener('appinstalled', function () {
      hideInstallBtn();
      deferredPrompt = null;
    });
  })();

  /* ── 6. iOS: Add-to-Home-Screen instructions toast ─────────── */
  (function setupiOSToast() {
    var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    // Safari-specific: no Chrome on iOS (which uses WKWebView)
    var isSafari = /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS/i.test(navigator.userAgent);
    var isStandalone = window.navigator.standalone === true;

    if (!isIOS || !isSafari || isStandalone) return;

    // Don't show if user already dismissed this session
    if (sessionStorage.getItem('cr-ios-toast-dismissed')) return;

    // Delay slightly so the game UI has time to render
    setTimeout(function () {
      var toast = document.createElement('div');
      toast.id = 'cr-ios-toast';
      toast.innerHTML =
        '<div class="cr-toast-header">' +
          '<span class="cr-toast-title">📲 Install Chord Runner</span>' +
          '<button class="cr-toast-close" id="cr-ios-close" aria-label="Close">✕</button>' +
        '</div>' +
        '<div class="cr-toast-steps">' +
          '<div class="cr-toast-step">' +
            '<span class="cr-step-icon">⎋</span>' +
            '<span>Tap the <strong>Share</strong> button at the bottom of Safari</span>' +
          '</div>' +
          '<div class="cr-toast-step">' +
            '<span class="cr-step-icon">➕</span>' +
            '<span>Tap <strong>Add to Home Screen</strong></span>' +
          '</div>' +
          '<div class="cr-toast-step">' +
            '<span class="cr-step-icon">🎮</span>' +
            '<span>Launch the app from your home screen for the best experience</span>' +
          '</div>' +
        '</div>' +
        '<div class="cr-toast-arrow"></div>';

      document.body.appendChild(toast);

      document.getElementById('cr-ios-close').addEventListener('click', function () {
        toast.classList.add('cr-hidden');
        sessionStorage.setItem('cr-ios-toast-dismissed', '1');
      });

      // Auto-dismiss after 12 seconds
      setTimeout(function () {
        if (toast.parentNode) {
          toast.classList.add('cr-hidden');
        }
      }, 12000);
    }, 2500);
  })();

})();
