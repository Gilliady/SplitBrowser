document.addEventListener('DOMContentLoaded', async () => {
  const inputUrl = document.getElementById('input-url');
  const inputOpacity = document.getElementById('input-opacity');
  const opacityPreview = document.getElementById('opacity-preview');
  const inputAlwaysOnTop = document.getElementById('input-always-on-top');
  const inputClickThrough = document.getElementById('input-click-through');
  const btnSave = document.getElementById('btn-save');
  const btnCancel = document.getElementById('btn-cancel');
  const btnClose = document.getElementById('btn-close-settings');

  // Load current settings
  const settings = await window.api.getSettings();
  inputUrl.value = settings.url || '';
  inputOpacity.value = Math.round(settings.opacity * 100);
  opacityPreview.textContent = Math.round(settings.opacity * 100) + '%';
  inputAlwaysOnTop.checked = settings.alwaysOnTop;
  inputClickThrough.checked = settings.clickThrough;

  // Opacity slider preview
  inputOpacity.addEventListener('input', (e) => {
    opacityPreview.textContent = e.target.value + '%';
  });

  // URL validation
  inputUrl.addEventListener('input', () => {
    const group = inputUrl.closest('.input-group');
    if (inputUrl.value && !inputUrl.value.match(/^https?:\/\//)) {
      group.classList.add('invalid');
    } else {
      group.classList.remove('invalid');
    }
  });

  // Save
  btnSave.addEventListener('click', async () => {
    let url = inputUrl.value.trim();
    if (url && !url.match(/^https?:\/\//)) {
      url = 'https://' + url;
    }

    await window.api.saveSettings({
      url: url || 'https://google.com',
      opacity: parseInt(inputOpacity.value) / 100,
      alwaysOnTop: inputAlwaysOnTop.checked,
      clickThrough: inputClickThrough.checked,
    });
    // Main process will close the window
  });

  // Cancel / Close
  btnCancel.addEventListener('click', () => window.close());
  btnClose.addEventListener('click', () => window.close());
});
