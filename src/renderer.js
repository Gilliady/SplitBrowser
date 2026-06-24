document.addEventListener('DOMContentLoaded', async () => {
  // DOM references
  const toolbar = document.getElementById('toolbar');
  const webview = document.getElementById('site-view');
  const loadingOverlay = document.getElementById('loading-overlay');
  const btnClickThrough = document.getElementById('btn-click-through');
  const opacitySlider = document.getElementById('opacity-slider');
  const opacityValue = document.getElementById('opacity-value');
  const btnSettings = document.getElementById('btn-settings');
  const btnMinimize = document.getElementById('btn-minimize');
  const btnClose = document.getElementById('btn-close');

  let isClickThrough = false;

  // Load initial settings
  const settings = await window.api.getSettings();
  webview.src = settings.url || 'about:blank';
  opacitySlider.value = Math.round(settings.opacity * 100);
  opacityValue.textContent = Math.round(settings.opacity * 100) + '%';
  if (settings.clickThrough) {
    activateClickThrough();
  }

  // Click-through toggle
  btnClickThrough.addEventListener('click', () => {
    if (isClickThrough) {
      deactivateClickThrough();
    } else {
      activateClickThrough();
    }
  });

  function activateClickThrough() {
    isClickThrough = true;
    btnClickThrough.classList.add('active');
    document.body.classList.add('click-through-active');
    window.api.setClickThrough(true, { forward: true });

    // Toolbar hover detection
    toolbar.addEventListener('mouseenter', onToolbarEnter);
    toolbar.addEventListener('mouseleave', onToolbarLeave);
  }

  function deactivateClickThrough() {
    isClickThrough = false;
    btnClickThrough.classList.remove('active');
    document.body.classList.remove('click-through-active');
    window.api.setClickThrough(false);

    toolbar.removeEventListener('mouseenter', onToolbarEnter);
    toolbar.removeEventListener('mouseleave', onToolbarLeave);
  }

  function onToolbarEnter() {
    window.api.setClickThrough(false);
  }

  function onToolbarLeave() {
    if (isClickThrough) {
      window.api.setClickThrough(true, { forward: true });
    }
  }

  // Opacity slider
  opacitySlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    opacityValue.textContent = value + '%';
    window.api.setOpacity(value / 100);
  });

  // Window controls
  btnSettings.addEventListener('click', () => window.api.openSettings());
  btnMinimize.addEventListener('click', () => window.api.minimizeApp());
  btnClose.addEventListener('click', () => window.api.closeApp());

  // Webview loading events
  webview.addEventListener('did-start-loading', () => {
    loadingOverlay.classList.remove('hidden');
  });
  webview.addEventListener('did-stop-loading', () => {
    loadingOverlay.classList.add('hidden');
  });
  webview.addEventListener('did-fail-load', (e) => {
    if (e.errorCode !== -3) { // Ignore aborted loads
      loadingOverlay.querySelector('span').textContent = 'Failed to load';
    }
  });

  // Listen for settings updates from settings window
  window.api.onSettingsUpdated((newSettings) => {
    if (newSettings.url && newSettings.url !== webview.src) {
      webview.src = newSettings.url;
    }
    if (newSettings.opacity !== undefined) {
      const pct = Math.round(newSettings.opacity * 100);
      opacitySlider.value = pct;
      opacityValue.textContent = pct + '%';
    }
  });

  // Listen for click-through toggle from global shortcut
  window.api.onClickThroughToggled((state) => {
    if (state && !isClickThrough) {
      activateClickThrough();
    } else if (!state && isClickThrough) {
      deactivateClickThrough();
    }
  });
});
