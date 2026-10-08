document.addEventListener('DOMContentLoaded', async () => {
  const inputUrl = document.getElementById('input-url');
  const selectHibernate = document.getElementById('select-hibernate');
  const btnCleanRamNow = document.getElementById('btn-clean-ram-now');
  const inputOpacity = document.getElementById('input-opacity');
  const opacityPreview = document.getElementById('opacity-preview');
  const inputAlwaysOnTop = document.getElementById('input-always-on-top');
  const inputClickThrough = document.getElementById('input-click-through');
  const btnSave = document.getElementById('btn-save');
  const btnCancel = document.getElementById('btn-cancel');
  const btnClose = document.getElementById('btn-close-settings');
  const btnShortcutCT = document.getElementById('btn-shortcut-ct');
  const btnShortcutVis = document.getElementById('btn-shortcut-vis');

  // Carregar configurações atuais
  const settings = await window.api.getSettings();
  inputUrl.value = settings.defaultUrl || settings.url || 'https://google.com';
  
  if (selectHibernate && settings.hibernateTimeoutMinutes !== undefined) {
    selectHibernate.value = String(settings.hibernateTimeoutMinutes);
  }

  inputOpacity.value = Math.round(settings.opacity * 100);
  opacityPreview.textContent = Math.round(settings.opacity * 100) + '%';
  inputAlwaysOnTop.checked = settings.alwaysOnTop;
  inputClickThrough.checked = settings.clickThrough;
  btnShortcutCT.textContent = (settings.shortcutClickThrough || 'CommandOrControl+Shift+O').replace(/CommandOrControl/g, 'Ctrl');
  btnShortcutVis.textContent = (settings.shortcutVisibility || 'CommandOrControl+Shift+H').replace(/CommandOrControl/g, 'Ctrl');

  // Botão Limpar RAM Agora
  if (btnCleanRamNow) {
    btnCleanRamNow.addEventListener('click', async () => {
      btnCleanRamNow.disabled = true;
      btnCleanRamNow.textContent = 'Limpando...';
      try {
        await window.api.optimizeRam();
        btnCleanRamNow.textContent = 'RAM Otimizada!';
      } catch (err) {
        btnCleanRamNow.textContent = 'Erro ao limpar';
      }
      setTimeout(() => {
        btnCleanRamNow.disabled = false;
        btnCleanRamNow.textContent = 'Limpar RAM Agora';
      }, 2000);
    });
  }

  // Shortcut Recorder Logic
  function setupShortcutListener(button) {
    let currentShortcut = button.textContent;
    button.addEventListener('click', () => {
      button.classList.add('listening');
      button.textContent = 'Aguardando tecla...';
      
      const keydownHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const modifiers = [];
        if (e.ctrlKey || e.metaKey) modifiers.push('CommandOrControl');
        if (e.altKey) modifiers.push('Alt');
        if (e.shiftKey) modifiers.push('Shift');

        const key = e.key.toUpperCase();
        const validKey = key.length === 1 || key.startsWith('F') || key === 'SPACE' || key === 'ENTER';
        
        if (validKey && !['CONTROL', 'ALT', 'SHIFT', 'META'].includes(key)) {
          modifiers.push(key === ' ' ? 'Space' : key);
          const newShortcut = modifiers.join('+');
          button.textContent = newShortcut.replace(/CommandOrControl/g, 'Ctrl');
          button.dataset.shortcut = newShortcut;
          cleanup();
        } else if (e.key === 'Escape') {
          button.textContent = currentShortcut;
          cleanup();
        }
      };

      const cleanup = () => {
        button.classList.remove('listening');
        document.removeEventListener('keydown', keydownHandler);
      };

      document.addEventListener('keydown', keydownHandler);
    });
  }

  setupShortcutListener(btnShortcutCT);
  setupShortcutListener(btnShortcutVis);

  // Opacity slider preview
  inputOpacity.addEventListener('input', (e) => {
    opacityPreview.textContent = e.target.value + '%';
  });

  // URL validation
  inputUrl.addEventListener('input', () => {
    const group = inputUrl.closest('.input-group');
    if (inputUrl.value && !inputUrl.value.match(/^https?:\/\//) && !inputUrl.value.includes('.')) {
      group.classList.add('invalid');
    } else {
      group.classList.remove('invalid');
    }
  });

  // Salvar
  btnSave.addEventListener('click', async () => {
    let url = inputUrl.value.trim();
    if (url && !url.match(/^https?:\/\//)) {
      url = 'https://' + url;
    }

    const hibernateMinutes = selectHibernate ? parseInt(selectHibernate.value, 10) : 30;

    await window.api.saveSettings({
      url: url || 'https://google.com',
      defaultUrl: url || 'https://google.com',
      hibernateTimeoutMinutes: isNaN(hibernateMinutes) ? 30 : hibernateMinutes,
      opacity: parseInt(inputOpacity.value, 10) / 100,
      alwaysOnTop: inputAlwaysOnTop.checked,
      clickThrough: inputClickThrough.checked,
      shortcutClickThrough: btnShortcutCT.dataset.shortcut || btnShortcutCT.textContent.replace(/Ctrl/g, 'CommandOrControl'),
      shortcutVisibility: btnShortcutVis.dataset.shortcut || btnShortcutVis.textContent.replace(/Ctrl/g, 'CommandOrControl')
    });
    // O processo principal fechará a janela
  });

  // Cancelar / Fechar
  btnCancel.addEventListener('click', () => window.close());
  btnClose.addEventListener('click', () => window.close());
});
