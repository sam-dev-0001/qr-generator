/**
 * QRSmith — QR Code Generator
 * Vanilla ES6+ module-style script (no build step, no framework).
 * Organized into small, single-purpose sections:
 *   1. State & constants
 *   2. DOM references
 *   3. Utilities (debounce, toast, tooltip helpers)
 *   4. Content builders (per QR type -> encoded string)
 *   5. Validation
 *   6. QR engine (qr-code-styling wrapper)
 *   7. Event wiring
 *   8. Init
 */
(() => {
  'use strict';

  /* ============================================================
     1. STATE & CONSTANTS
     ============================================================ */

  /** @type {{type: string, logoDataUrl: string|null}} */
  const state = {
    activeType: 'text',
    logoDataUrl: null, // Rounded image used in QR
    originalLogo: null // Original uploaded image
  };

  const DEBOUNCE_MS = 350;
  const MAX_TEXT_LENGTH = 1500;
  const THEME_STORAGE_KEY = 'qrsmith-theme'; // kept in-memory only, see note in initTheme()

  /* ============================================================
     2. DOM REFERENCES
     ============================================================ */

  const dom = {
    form: document.getElementById('qr-form'),
    tabs: Array.from(document.querySelectorAll('.type-tab')),
    panels: Array.from(document.querySelectorAll('.type-fields')),
    errorMessage: document.getElementById('input-error'),

    // content inputs
    text: document.getElementById('input-text'),
    countText: document.getElementById('count-text'),
    url: document.getElementById('input-url'),
    emailAddress: document.getElementById('input-email-address'),
    emailSubject: document.getElementById('input-email-subject'),
    emailBody: document.getElementById('input-email-body'),
    phone: document.getElementById('input-phone'),
    smsPhone: document.getElementById('input-sms-phone'),
    smsMessage: document.getElementById('input-sms-message'),
    wifiSsid: document.getElementById('input-wifi-ssid'),
    wifiPassword: document.getElementById('input-wifi-password'),
    wifiEncryption: document.getElementById('input-wifi-encryption'),
    wifiHidden: document.getElementById('input-wifi-hidden'),

    // style controls
    size: document.getElementById('opt-size'),
    sizeValue: document.getElementById('opt-size-value'),
    margin: document.getElementById('opt-margin'),
    marginValue: document.getElementById('opt-margin-value'),
    fgColor: document.getElementById('opt-fg-color'),
    fgColorText: document.getElementById('opt-fg-color-text'),
    bgColor: document.getElementById('opt-bg-color'),
    bgColorText: document.getElementById('opt-bg-color-text'),
    errorCorrection: document.getElementById('opt-error-correction'),
    dotsType: document.getElementById('opt-dots-type'),
    cornerSquareType: document.getElementById('opt-corner-square-type'),
    cornerDotType: document.getElementById('opt-corner-dot-type'),

    // logo
    logoInput: document.getElementById('opt-logo-input'),
    logoRemoveBtn: document.getElementById('logo-remove-btn'),
    logoFilename: document.getElementById('logo-filename'),
    logoSizeField: document.getElementById('logo-size-field'),
    logoSize: document.getElementById('opt-logo-size'),
    logoSizeValue: document.getElementById('opt-logo-size-value'),
    logoRound: document.getElementById('opt-logo-round'),
    logoRoundValue: document.getElementById('opt-logo-round-value'),

    // download
    filename: document.getElementById('opt-filename'),
    downloadPng: document.getElementById('download-png'),
    downloadJpeg: document.getElementById('download-jpeg'),
    downloadSvg: document.getElementById('download-svg'),

    // preview
    viewfinder: document.getElementById('viewfinder'),
    scanline: document.getElementById('scanline'),
    qrCanvas: document.getElementById('qr-canvas'),
    emptyState: document.getElementById('empty-state'),
    previewCaption: document.getElementById('preview-caption'),

    // misc
    clearBtn: document.getElementById('clear-btn'),
    resetBtn: document.getElementById('reset-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    toastRegion: document.getElementById('toast-region'),
    footerYear: document.getElementById('footer-year'),
  };

  /* ============================================================
     3. UTILITIES
     ============================================================ */

  /**
   * Returns a debounced version of fn that waits `wait` ms after the
   * last call before executing. Prevents QR regeneration on every
   * keystroke.
   * @param {Function} fn
   * @param {number} wait
   * @returns {Function}
   */
  function debounce(fn, wait) {
    let timerId = null;
    return (...args) => {
      clearTimeout(timerId);
      timerId = setTimeout(() => fn(...args), wait);
    };
  }

  /**
   * Displays a transient toast notification.
   * @param {string} message
   * @param {'success'|'error'|'info'} [variant]
   */
  function showToast(message, variant = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${variant}`;
    toast.textContent = message;
    dom.toastRegion.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('is-leaving');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 3200);
  }

  /**
   * Shows a validation error under the active content panel.
   * @param {string} message
   */
  function showFieldError(message) {
    dom.errorMessage.textContent = message;
    dom.errorMessage.hidden = false;
  }

  function clearFieldError() {
    dom.errorMessage.hidden = true;
    dom.errorMessage.textContent = '';
  }

  /**
   * Escapes characters with special meaning inside WiFi/vCard style
   * QR payload strings (":", ";", ",", "\\").
   * @param {string} value
   * @returns {string}
   */
  function escapeSpecialChars(value) {
    return String(value).replace(/([\\;,:"])/g, '\\$1');
  }

  /* ============================================================
     4. CONTENT BUILDERS
     Each builder returns { ok: boolean, data?: string, error?: string }
     ============================================================ */

  const builders = {
    text() {
      const value = dom.text.value.trim();
      if (!value) return { ok: false, error: 'Enter some text to generate a code.' };
      if (value.length > MAX_TEXT_LENGTH) {
        return { ok: false, error: `Text is too long (max ${MAX_TEXT_LENGTH} characters).` };
      }
      return { ok: true, data: value };
    },

    url() {
      const raw = dom.url.value.trim();
      if (!raw) return { ok: false, error: 'Enter a website URL.' };
      const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      try {
        // Throws if the URL is malformed
        new URL(withProtocol);
      } catch {
        return { ok: false, error: 'That URL doesn\u2019t look valid. Check for typos.' };
      }
      return { ok: true, data: withProtocol };
    },

    email() {
      const address = dom.emailAddress.value.trim();
      if (!address) return { ok: false, error: 'Enter an email address.' };
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(address)) {
        return { ok: false, error: 'Enter a valid email address.' };
      }
      const params = new URLSearchParams();
      if (dom.emailSubject.value.trim()) params.set('subject', dom.emailSubject.value.trim());
      if (dom.emailBody.value.trim()) params.set('body', dom.emailBody.value.trim());
      const query = params.toString();
      return { ok: true, data: `mailto:${address}${query ? `?${query}` : ''}` };
    },

    phone() {
      const raw = dom.phone.value.trim();
      if (!raw) return { ok: false, error: 'Enter a phone number.' };
      const phonePattern = /^[+]?[\d\s().-]{6,20}$/;
      if (!phonePattern.test(raw)) {
        return { ok: false, error: 'Enter a valid phone number.' };
      }
      return { ok: true, data: `tel:${raw.replace(/[\s().-]/g, '')}` };
    },

    sms() {
      const raw = dom.smsPhone.value.trim();
      if (!raw) return { ok: false, error: 'Enter a phone number.' };
      const phonePattern = /^[+]?[\d\s().-]{6,20}$/;
      if (!phonePattern.test(raw)) {
        return { ok: false, error: 'Enter a valid phone number.' };
      }
      const cleanNumber = raw.replace(/[\s().-]/g, '');
      const message = dom.smsMessage.value.trim();
      return { ok: true, data: `sms:${cleanNumber}${message ? `?body=${encodeURIComponent(message)}` : ''}` };
    },

    wifi() {
      const ssid = dom.wifiSsid.value.trim();
      if (!ssid) return { ok: false, error: 'Enter the network name (SSID).' };
      const encryption = dom.wifiEncryption.value;
      const password = dom.wifiPassword.value;
      if (encryption !== 'nopass' && !password) {
        return { ok: false, error: 'Enter the network password, or set security to None.' };
      }
      const hidden = dom.wifiHidden.checked ? 'true' : 'false';
      const data = `WIFI:T:${encryption};S:${escapeSpecialChars(ssid)};` +
        `${encryption !== 'nopass' ? `P:${escapeSpecialChars(password)};` : ''}H:${hidden};;`;
      return { ok: true, data };
    },
  };

  /* ============================================================
     5. VALIDATION + PAYLOAD RESOLUTION
     ============================================================ */

  /**
   * Runs the builder for the currently active tab.
   * @returns {{ok: boolean, data?: string, error?: string}}
   */
  function resolvePayload() {
    const builder = builders[state.activeType];
    if (!builder) return { ok: false, error: 'Unknown content type.' };
    return builder();
  }

  /* ============================================================
     6. QR ENGINE
     ============================================================ */

  /** @type {QRCodeStyling|null} */
  let qrInstance = null;
  let hasRenderedOnce = false;

  async function makeRoundedLogo(imageSrc, radiusPercent) {
    const img = new Image();
    img.src = imageSrc;

    await new Promise(reslove => {
      img.onload = reslove;
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = img.width;
    canvas.height = img.height;

    const radius = Math.min(canvas.width, canvas.height) * (radiusPercent / 100);

    ctx.beginPath();

    ctx.roundRect(
      0,
      0,
      canvas.width,
      canvas.height,
      radius
    );

    ctx.closePath();

    ctx.clip();

    ctx.drawImage(
      img,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return canvas.toDataURL();
  }

  /**
   * Reads all style controls and returns a qr-code-styling options object.
   * @param {string} data - the payload to encode
   * @returns {object}
   */
  function buildQrOptions(data) {
    const size = Number(dom.size.value);
    const margin = Number(dom.margin.value);

    const options = {
      width: size,
      height: size,
      type: 'canvas',
      data,
      margin,
      qrOptions: { errorCorrectionLevel: dom.errorCorrection.value },
      dotsOptions: { color: dom.fgColor.value, type: dom.dotsType.value },
      backgroundOptions: { color: dom.bgColor.value },
      cornersSquareOptions: { color: dom.fgColor.value, type: dom.cornerSquareType.value },
      cornersDotOptions: { color: dom.fgColor.value, type: dom.cornerDotType.value },
    };

    if (state.logoDataUrl) {
      options.image = state.logoDataUrl;
      options.imageOptions = {
        crossOrigin: 'anonymous',
        margin: 4,
        imageSize: Number(dom.logoSize.value) / 100,
      };
    }

    return options;
  }

  /**
   * Generates (or updates) the QR code preview based on current form
   * state. Shows the loading sweep briefly, then reveals the result.
   */
  function generateQrCode() {
    const result = resolvePayload();

    if (!result.ok) {
      clearPreview();
      // Only surface an error if the user has actually typed something
      // in *some* field for the active panel; avoid nagging on first load.
      if (hasAnyInputForActiveType()) {
        showFieldError(result.error);
      } else {
        clearFieldError();
      }
      return;
    }

    clearFieldError();
    dom.viewfinder.classList.add('is-loading');
    dom.scanline.hidden = false;

    const options = buildQrOptions(result.data);

    // A short timeout lets the loading sweep read as intentional feedback
    // rather than a flicker, and keeps generation off the input's own
    // event tick.
    window.setTimeout(() => {
      try {
        if (!qrInstance) {
          qrInstance = new QRCodeStyling(options);
          dom.qrCanvas.innerHTML = '';
          qrInstance.append(dom.qrCanvas);
        } else {
          qrInstance.update(options);
        }
        dom.emptyState.hidden = true;
        dom.viewfinder.classList.remove('is-loading');
        dom.viewfinder.classList.add('is-ready');
        dom.scanline.hidden = true;
        dom.previewCaption.textContent = 'Looking good — download when ready';
        setDownloadButtonsEnabled(true);
        hasRenderedOnce = true;
      } catch (err) {
        console.error('QR generation failed:', err);
        showToast('Could not generate that QR code. Try shortening the content.', 'error');
        clearPreview();
      }
    }, 220);
  }

  /** Resets the preview area to its empty state. */
  function clearPreview() {
    dom.viewfinder.classList.remove('is-ready', 'is-loading');
    dom.scanline.hidden = true;
    dom.qrCanvas.innerHTML = '';
    dom.emptyState.hidden = false;
    dom.previewCaption.textContent = 'Enter content on the left to generate a code';
    setDownloadButtonsEnabled(false);
    qrInstance = null;
    hasRenderedOnce = false;
  }

  function setDownloadButtonsEnabled(enabled) {
    [dom.downloadPng, dom.downloadJpeg, dom.downloadSvg].forEach((btn) => {
      btn.disabled = !enabled;
    });
  }

  /**
   * Checks whether the user has typed anything into the fields that
   * belong to the currently active content-type panel. Used to decide
   * whether an empty-payload state should show a validation error.
   * @returns {boolean}
   */
  function hasAnyInputForActiveType() {
    const panel = document.getElementById(`fields-${state.activeType}`);
    if (!panel) return false;
    const fields = panel.querySelectorAll('input, textarea, select');
    return Array.from(fields).some((field) => {
      if (field.type === 'checkbox') return field.checked;
      return field.value.trim().length > 0;
    });
  }

  const debouncedGenerate = debounce(generateQrCode, DEBOUNCE_MS);

  /* ============================================================
     7. EVENT WIRING
     ============================================================ */

  /** Wires up the content-type tab switcher. */
  function initTabs() {
    dom.tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const { type } = tab.dataset;
        if (type === state.activeType) return;

        dom.tabs.forEach((t) => {
          t.classList.toggle('is-active', t === tab);
          t.setAttribute('aria-selected', String(t === tab));
        });
        dom.panels.forEach((panel) => {
          const isActive = panel.id === `fields-${type}`;
          panel.classList.toggle('is-active', isActive);
          panel.hidden = !isActive;
        });

        state.activeType = type;
        clearFieldError();
        debouncedGenerate();
      });
    });
  }

  /** Wires up live-preview generation for all content inputs. */
  function initContentInputs() {
    const allContentFields = [
      dom.text, dom.url, dom.emailAddress, dom.emailSubject, dom.emailBody,
      dom.phone, dom.smsPhone, dom.smsMessage,
      dom.wifiSsid, dom.wifiPassword, dom.wifiEncryption, dom.wifiHidden,
    ];

    allContentFields.forEach((field) => {
      if (!field) return;
      const eventName = field.tagName === 'SELECT' || field.type === 'checkbox' ? 'change' : 'input';
      field.addEventListener(eventName, debouncedGenerate);
    });

    dom.text.addEventListener('input', () => {
      dom.countText.textContent = String(dom.text.value.length);
    });
  }

  /** Wires up all style controls (size, colors, dot/corner styles…). */
  function initStyleControls() {
    dom.size.addEventListener('input', () => {
      dom.sizeValue.textContent = dom.size.value;
      debouncedGenerate();
    });
    dom.margin.addEventListener('input', () => {
      dom.marginValue.textContent = dom.margin.value;
      debouncedGenerate();
    });

    // Keep color picker and hex text input in sync
    dom.fgColor.addEventListener('input', () => {
      dom.fgColorText.value = dom.fgColor.value.toUpperCase();
      debouncedGenerate();
    });
    dom.bgColor.addEventListener('input', () => {
      dom.bgColorText.value = dom.bgColor.value.toUpperCase();
      debouncedGenerate();
    });
    dom.fgColorText.addEventListener('change', () => {
      if (/^#([0-9A-F]{3}){1,2}$/i.test(dom.fgColorText.value)) {
        dom.fgColor.value = dom.fgColorText.value;
        debouncedGenerate();
      } else {
        showToast('Enter a valid hex color, like #14213D.', 'error');
      }
    });
    dom.bgColorText.addEventListener('change', () => {
      if (/^#([0-9A-F]{3}){1,2}$/i.test(dom.bgColorText.value)) {
        dom.bgColor.value = dom.bgColorText.value;
        debouncedGenerate();
      } else {
        showToast('Enter a valid hex color, like #FAF8F3.', 'error');
      }
    });

    [dom.errorCorrection, dom.dotsType, dom.cornerSquareType, dom.cornerDotType].forEach((select) => {
      select.addEventListener('change', debouncedGenerate);
    });
  }

  /** Wires up logo upload, preview and removal. */
  function initLogoControls() {
    dom.logoInput.addEventListener('change', () => {
      const file = dom.logoInput.files && dom.logoInput.files[0];
      if (!file) return;

      const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB
      if (file.size > MAX_LOGO_BYTES) {
        showToast('Logo file is too large (max 2MB).', 'error');
        dom.logoInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        state.originalLogo = reader.result;
        state.logoDataUrl = await makeRoundedLogo(state.originalLogo, Number(dom.logoRound.value));
        dom.logoFilename.textContent = file.name;
        dom.logoRemoveBtn.hidden = false;
        dom.logoSizeField.hidden = false;
        showToast('Logo added.', 'success');
        debouncedGenerate();
      };
      reader.onerror = () => {
        showToast('Could not read that image file.', 'error');
      };
      reader.readAsDataURL(file);
    });

    dom.logoRemoveBtn.addEventListener('click', () => {
      state.logoDataUrl = null;
      state.originalLogo = null;
      dom.logoInput.value = '';
      dom.logoFilename.textContent = '';
      dom.logoRemoveBtn.hidden = true;
      dom.logoSizeField.hidden = true;
      debouncedGenerate();
    });

    dom.logoSize.addEventListener('input', () => {
      dom.logoSizeValue.textContent = dom.logoSize.value;
      debouncedGenerate();
    });

    dom.logoRound.addEventListener('input', async () => {
      dom.logoRoundValue.textContent = dom.logoRound.value;

      if (!state.originalLogo) return;

      state.logoDataUrl = await makeRoundedLogo(state.originalLogo, Number(dom.logoRound.value));

      debouncedGenerate();
    });
  }

  /** Wires up PNG / JPEG / SVG downloads. */
  function initDownloadControls() {
    const download = (extension) => {
      if (!qrInstance || !hasRenderedOnce) {
        showToast('Generate a QR code before downloading.', 'error');
        return;
      }
      const name = (dom.filename.value.trim() || 'qr-code').replace(/[^\w\-]+/g, '-');
      qrInstance.download({ name, extension })
        .then(() => showToast(`Downloaded ${name}.${extension}`, 'success'))
        .catch(() => showToast('Download failed. Try a different format.', 'error'));
    };

    dom.downloadPng.addEventListener('click', () => download('png'));
    dom.downloadJpeg.addEventListener('click', () => download('jpeg'));
    dom.downloadSvg.addEventListener('click', () => download('svg'));
  }

  /** Wires up the "Clear QR" and "Reset form" actions. */
  function initFormActions() {
    dom.clearBtn.addEventListener('click', () => {
      clearPreview();
      showToast('Preview cleared.', 'info');
    });

    dom.form.addEventListener('reset', () => {
      window.setTimeout(() => {
        state.logoDataUrl = null;
        dom.logoFilename.textContent = '';
        dom.logoRemoveBtn.hidden = true;
        dom.logoSizeField.hidden = true;
        dom.countText.textContent = '0';
        dom.sizeValue.textContent = dom.size.value;
        dom.marginValue.textContent = dom.margin.value;
        dom.fgColorText.value = dom.fgColor.value.toUpperCase();
        dom.bgColorText.value = dom.bgColor.value.toUpperCase();
        clearFieldError();
        clearPreview();
        showToast('Form reset.', 'info');
      }, 0);
    });
  }

  /** Wires up dark mode, respecting saved preference and system default. */
  function initTheme() {
    // Note: localStorage is intentionally not used so this file behaves
    // identically when embedded in sandboxed preview contexts. Theme
    // choice persists only for the current session via in-memory state
    // plus the prefers-color-scheme system default on load.
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    let isDark = prefersDark;
    applyTheme(isDark);

    dom.themeToggle.addEventListener('click', () => {
      isDark = !isDark;
      applyTheme(isDark);
    });

    document.addEventListener('keydown', (e) => {
      if (e.shiftKey && e.key.toLowerCase() === 'd' && !isTypingContext(e.target)) {
        isDark = !isDark;
        applyTheme(isDark);
      }
    });

    function applyTheme(dark) {
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      dom.themeToggle.setAttribute('aria-pressed', String(dark));
    }
  }

  /**
   * Returns true if the given element is a text-entry control, used to
   * avoid triggering keyboard shortcuts while a user is typing.
   * @param {EventTarget} target
   */
  function isTypingContext(target) {
    const tag = (target && target.tagName) || '';
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  /** Wires up global keyboard shortcuts. */
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();

      // Ctrl/Cmd + Enter -> download PNG
      if ((e.ctrlKey || e.metaKey) && key === 'enter') {
        e.preventDefault();
        dom.downloadPng.click();
      }

      // Esc -> clear preview (only outside inputs)
      if (key === 'escape' && !isTypingContext(e.target)) {
        dom.clearBtn.click();
      }
    });
  }

  /* ============================================================
     8. INIT
     ============================================================ */

  function init() {

    dom.form.reset();

    dom.footerYear.textContent = String(new Date().getFullYear());
    setDownloadButtonsEnabled(false);

    initTabs();
    initContentInputs();
    initStyleControls();
    initLogoControls();
    initDownloadControls();
    initFormActions();
    initTheme();
    initKeyboardShortcuts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
