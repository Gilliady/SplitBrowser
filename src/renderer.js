document.addEventListener('DOMContentLoaded', async () => {
  // DOM References - Top Bar
  const topBar = document.getElementById('top-bar');
  const workspaceTabsContainer = document.getElementById('workspace-tabs');
  const btnAddWorkspace = document.getElementById('btn-add-workspace');
  const btnRamOptimize = document.getElementById('btn-ram-optimize');
  const btnClickThrough = document.getElementById('btn-click-through');
  const opacitySlider = document.getElementById('opacity-slider');
  const opacityValue = document.getElementById('opacity-value');
  const btnSettings = document.getElementById('btn-settings');
  const btnMinimize = document.getElementById('btn-minimize');
  const btnClose = document.getElementById('btn-close');

  // DOM References - Subbar
  const layoutSelector = document.getElementById('layout-selector');
  const btnAddPanel = document.getElementById('btn-add-panel');
  const btnAutoResize = document.getElementById('btn-auto-resize');
  const btnSleepAll = document.getElementById('btn-sleep-all');
  const workspaceStatus = document.getElementById('workspace-status');

  // DOM References - Grid & Toast
  const gridContainer = document.getElementById('grid-container');
  const toast = document.getElementById('toast');

  // State
  let isClickThrough = false;
  let saveTimeout = null;
  let activePanelId = null;

  let state = {
    workspaces: [],
    activeWorkspaceId: 'ws-default',
    defaultUrl: 'https://google.com',
    hibernateTimeoutMinutes: 30
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function showToast(message, duration = 2500) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  }

  function saveStateDebounced() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try {
        await window.api.saveWorkspacesState({
          workspaces: state.workspaces,
          activeWorkspaceId: state.activeWorkspaceId
        });
      } catch (err) {
        console.error('Failed to save workspaces state:', err);
      }
    }, 300);
  }

  function generateId(prefix = 'id') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  }

  function sanitizeUrl(rawUrl) {
    let url = (rawUrl || '').trim();
    if (!url) return 'about:blank';
    if (!/^https?:\/\//i.test(url) && !url.startsWith('about:')) {
      if (url.includes('.') && !url.includes(' ')) {
        url = 'https://' + url;
      } else {
        url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
      }
    }
    return url;
  }

  function getActiveWorkspace() {
    return state.workspaces.find(ws => ws.id === state.activeWorkspaceId) || state.workspaces[0];
  }

  // ---------------------------------------------------------------------------
  // Workspaces Management
  // ---------------------------------------------------------------------------

  function renderWorkspacesBar() {
    workspaceTabsContainer.innerHTML = '';

    state.workspaces.forEach((ws) => {
      const tabEl = document.createElement('div');
      tabEl.className = `workspace-tab ${ws.id === state.activeWorkspaceId ? 'active' : ''}`;
      tabEl.dataset.workspaceId = ws.id;

      const titleSpan = document.createElement('span');
      titleSpan.className = 'workspace-tab-title';
      titleSpan.textContent = ws.title || 'Área';
      titleSpan.title = 'Duplo-clique para renomear';

      const badgeSpan = document.createElement('span');
      badgeSpan.className = 'workspace-tab-badge';
      badgeSpan.textContent = ws.tabs ? ws.tabs.length : 0;

      tabEl.appendChild(titleSpan);
      tabEl.appendChild(badgeSpan);

      // Botão de fechar se houver mais de 1 workspace
      if (state.workspaces.length > 1) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'workspace-tab-close';
        closeBtn.textContent = '×';
        closeBtn.title = 'Fechar Área de Trabalho';
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteWorkspace(ws.id);
        });
        tabEl.appendChild(closeBtn);
      }

      // Troca de Workspace
      tabEl.addEventListener('click', () => {
        if (ws.id !== state.activeWorkspaceId) {
          switchWorkspace(ws.id);
        }
      });

      // Renomear ao dar duplo clique
      tabEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        renameWorkspace(ws.id);
      });

      workspaceTabsContainer.appendChild(tabEl);
    });
  }

  function getOrCreateViewport(ws) {
    let vp = document.getElementById(`viewport-${ws.id}`);
    if (vp) return vp;

    vp = document.createElement('div');
    vp.className = `workspace-viewport layout-${ws.layout || '2x2'}`;
    vp.id = `viewport-${ws.id}`;
    vp.dataset.workspaceId = ws.id;

    if (ws.customGridColumns) {
      vp.style.gridTemplateColumns = ws.customGridColumns;
    }
    if (ws.customGridRows) {
      vp.style.gridTemplateRows = ws.customGridRows;
    }

    if (!ws.tabs || ws.tabs.length === 0) {
      ws.tabs = [
        { id: generateId('tab'), url: state.defaultUrl || 'https://google.com', title: 'Início', isSuspended: false }
      ];
    }

    ws.tabs.forEach(tab => {
      const panelEl = createPanelElement(tab, ws, vp);
      vp.appendChild(panelEl);
    });

    gridContainer.appendChild(vp);
    updatePanelOrderUI(vp, ws);
    return vp;
  }

  function createWorkspace() {
    const newWs = {
      id: generateId('ws'),
      title: `Área ${state.workspaces.length + 1}`,
      layout: '2x2',
      tabs: [
        { id: generateId('tab'), url: state.defaultUrl || 'https://google.com', title: 'Nova Janela', isSuspended: false },
        { id: generateId('tab'), url: 'https://github.com', title: 'GitHub', isSuspended: false }
      ]
    };

    state.workspaces.push(newWs);
    getOrCreateViewport(newWs);
    switchWorkspace(newWs.id);
    showToast(`Área de Trabalho "${newWs.title}" criada!`);
  }

  function renameWorkspace(wsId) {
    const ws = state.workspaces.find(w => w.id === wsId);
    if (!ws) return;

    const newTitle = window.prompt('Nome da Área de Trabalho:', ws.title);
    if (newTitle && newTitle.trim()) {
      ws.title = newTitle.trim();
      renderWorkspacesBar();
      saveStateDebounced();
    }
  }

  function deleteWorkspace(wsId) {
    if (state.workspaces.length <= 1) {
      showToast('Não é possível fechar a única Área de Trabalho.');
      return;
    }

    const ws = state.workspaces.find(w => w.id === wsId);
    const confirmed = window.confirm(`Deseja fechar a Área "${ws ? ws.title : ''}"?`);
    if (!confirmed) return;

    // Remove o viewport do DOM
    const vp = document.getElementById(`viewport-${wsId}`);
    if (vp) vp.remove();

    if (state.activeWorkspaceId === wsId) {
      const remaining = state.workspaces.filter(w => w.id !== wsId);
      state.activeWorkspaceId = remaining[0].id;
    }

    state.workspaces = state.workspaces.filter(w => w.id !== wsId);
    switchWorkspace(state.activeWorkspaceId);
    saveStateDebounced();
  }

  function switchWorkspace(wsId) {
    state.activeWorkspaceId = wsId;
    const currentWs = getActiveWorkspace();
    const vp = getOrCreateViewport(currentWs);

    // Alternar visibilidade sem matar nenhum processo de webview
    document.querySelectorAll('.workspace-viewport').forEach(v => {
      v.classList.toggle('active', v.id === `viewport-${wsId}`);
    });

    if (currentWs.customGridColumns) {
      vp.style.gridTemplateColumns = currentWs.customGridColumns;
    } else {
      vp.style.gridTemplateColumns = '';
    }

    if (currentWs.customGridRows) {
      vp.style.gridTemplateRows = currentWs.customGridRows;
    } else {
      vp.style.gridTemplateRows = '';
    }

    updateViewportResizers(vp);
    updatePanelOrderUI(vp, currentWs);
    updateLayoutButtons(currentWs.layout || '2x2');
    renderWorkspacesBar();
    updateWorkspaceStatus();
    saveStateDebounced();

    if (window.api && window.api.optimizeRam) {
      window.api.optimizeRam().catch(() => {});
    }
  }

  // ---------------------------------------------------------------------------
  // Grid & Layout Rendering
  // ---------------------------------------------------------------------------

  function updateLayoutButtons(layout) {
    layoutSelector.querySelectorAll('.layout-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layout === layout);
    });
  }

  function setLayout(layoutName) {
    const currentWs = getActiveWorkspace();
    if (!currentWs) return;

    currentWs.layout = layoutName;
    delete currentWs.customGridColumns;
    delete currentWs.customGridRows;

    const vp = getOrCreateViewport(currentWs);
    vp.style.gridTemplateColumns = '';
    vp.style.gridTemplateRows = '';

    const layoutClasses = ['layout-1x1', 'layout-1x2', 'layout-2x1', 'layout-2x2', 'layout-1x3', 'layout-3x1', 'layout-3x3', 'layout-auto'];
    vp.classList.remove(...layoutClasses);
    vp.classList.add(`layout-${layoutName}`);

    updateViewportResizers(vp);
    updateLayoutButtons(layoutName);
    saveStateDebounced();
  }

  function updateWorkspaceStatus() {
    const currentWs = getActiveWorkspace();
    if (!currentWs) return;

    const count = currentWs.tabs ? currentWs.tabs.length : 0;
    const activeCount = currentWs.tabs ? currentWs.tabs.filter(t => !t.isSuspended).length : 0;
    workspaceStatus.textContent = `${count} ${count === 1 ? 'janela' : 'janelas'} (${activeCount} ativas)`;

    renderWorkspacesBar();
  }

  // ---------------------------------------------------------------------------
  // Grid Resizing & Redistribution Logic
  // ---------------------------------------------------------------------------

  function setupPanelResizers(panel, currentWs, resizerRight, resizerBottom, resizerCorner) {
    function startResize(e, direction) {
      e.preventDefault();
      e.stopPropagation();

      const vp = panel.closest('.workspace-viewport') || document.getElementById(`viewport-${currentWs.id}`);
      if (!vp) return;

      if (panel.classList.contains('is-maximized')) return;

      const computedStyle = window.getComputedStyle(vp);
      const computedCols = computedStyle.gridTemplateColumns.trim().split(/\s+/).map(parseFloat).filter(n => !isNaN(n) && n > 0);
      const computedRows = computedStyle.gridTemplateRows.trim().split(/\s+/).map(parseFloat).filter(n => !isNaN(n) && n > 0);

      const vpRect = vp.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const panelCenterX = panelRect.left + panelRect.width / 2;
      const panelCenterY = panelRect.top + panelRect.height / 2;

      const gap = 4;

      let colIndex = 0;
      let accX = vpRect.left;
      for (let i = 0; i < computedCols.length; i++) {
        accX += computedCols[i] + gap;
        if (panelCenterX < accX) {
          colIndex = i;
          break;
        }
      }

      let rowIndex = 0;
      let accY = vpRect.top;
      for (let j = 0; j < computedRows.length; j++) {
        accY += computedRows[j] + gap;
        if (panelCenterY < accY) {
          rowIndex = j;
          break;
        }
      }

      const canCol = computedCols.length >= 2 && colIndex < computedCols.length - 1;
      const canRow = computedRows.length >= 2 && rowIndex < computedRows.length - 1;

      if (direction === 'horizontal' && !canCol) return;
      if (direction === 'vertical' && !canRow) return;
      if (direction === 'both' && !canCol && !canRow) return;

      const startX = e.clientX;
      const startY = e.clientY;

      const initialCols = [...computedCols];
      const initialRows = [...computedRows];

      const targetCol = colIndex;
      const targetRow = rowIndex;

      const pairColTotal = canCol ? (initialCols[targetCol] + initialCols[targetCol + 1]) : 0;
      const pairRowTotal = canRow ? (initialRows[targetRow] + initialRows[targetRow + 1]) : 0;

      const MIN_COL_WIDTH = 80;
      const MIN_ROW_HEIGHT = 60;

      document.body.classList.add('is-resizing');
      if (direction === 'horizontal') resizerRight.classList.add('dragging');
      else if (direction === 'vertical') resizerBottom.classList.add('dragging');
      else resizerCorner.classList.add('dragging');

      function onMouseMove(moveEvent) {
        if ((direction === 'horizontal' || direction === 'both') && canCol) {
          const deltaX = moveEvent.clientX - startX;
          let newA = initialCols[targetCol] + deltaX;
          let newB = pairColTotal - newA;

          if (newA < MIN_COL_WIDTH) {
            newA = MIN_COL_WIDTH;
            newB = pairColTotal - MIN_COL_WIDTH;
          } else if (newB < MIN_COL_WIDTH) {
            newB = MIN_COL_WIDTH;
            newA = pairColTotal - MIN_COL_WIDTH;
          }

          const totalColsWidth = initialCols.reduce((sum, w) => sum + w, 0);
          const finalCols = initialCols.map((w, idx) => {
            if (idx === targetCol) return newA;
            if (idx === targetCol + 1) return newB;
            return w;
          });

          const frCols = finalCols.map(w => ((w / totalColsWidth) * computedCols.length).toFixed(3) + 'fr');
          vp.style.gridTemplateColumns = frCols.join(' ');
        }

        if ((direction === 'vertical' || direction === 'both') && canRow) {
          const deltaY = moveEvent.clientY - startY;
          let newA = initialRows[targetRow] + deltaY;
          let newB = pairRowTotal - newA;

          if (newA < MIN_ROW_HEIGHT) {
            newA = MIN_ROW_HEIGHT;
            newB = pairRowTotal - MIN_ROW_HEIGHT;
          } else if (newB < MIN_ROW_HEIGHT) {
            newB = MIN_ROW_HEIGHT;
            newA = pairRowTotal - MIN_ROW_HEIGHT;
          }

          const totalRowsHeight = initialRows.reduce((sum, h) => sum + h, 0);
          const finalRows = initialRows.map((h, idx) => {
            if (idx === targetRow) return newA;
            if (idx === targetRow + 1) return newB;
            return h;
          });

          const frRows = finalRows.map(h => ((h / totalRowsHeight) * computedRows.length).toFixed(3) + 'fr');
          vp.style.gridTemplateRows = frRows.join(' ');
        }
      }

      function onMouseUp() {
        document.body.classList.remove('is-resizing');
        resizerRight.classList.remove('dragging');
        resizerBottom.classList.remove('dragging');
        resizerCorner.classList.remove('dragging');

        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        if (vp.style.gridTemplateColumns) {
          currentWs.customGridColumns = vp.style.gridTemplateColumns;
        }
        if (vp.style.gridTemplateRows) {
          currentWs.customGridRows = vp.style.gridTemplateRows;
        }

        updateViewportResizers(vp);
        saveStateDebounced();
      }

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }

    resizerRight.addEventListener('mousedown', (e) => startResize(e, 'horizontal'));
    resizerBottom.addEventListener('mousedown', (e) => startResize(e, 'vertical'));
    resizerCorner.addEventListener('mousedown', (e) => startResize(e, 'both'));
  }

  function updateViewportResizers(vp) {
    if (!vp || !vp.classList.contains('active')) return;

    requestAnimationFrame(() => {
      const computedStyle = window.getComputedStyle(vp);
      const computedCols = computedStyle.gridTemplateColumns.trim().split(/\s+/).map(parseFloat).filter(n => !isNaN(n) && n > 0);
      const computedRows = computedStyle.gridTemplateRows.trim().split(/\s+/).map(parseFloat).filter(n => !isNaN(n) && n > 0);

      const vpRect = vp.getBoundingClientRect();
      const gap = 4;
      const panels = Array.from(vp.querySelectorAll('.grid-panel'));

      panels.forEach(panel => {
        const panelRect = panel.getBoundingClientRect();
        const panelCenterX = panelRect.left + panelRect.width / 2;
        const panelCenterY = panelRect.top + panelRect.height / 2;

        let colIndex = 0;
        let accX = vpRect.left;
        for (let i = 0; i < computedCols.length; i++) {
          accX += computedCols[i] + gap;
          if (panelCenterX < accX) {
            colIndex = i;
            break;
          }
        }

        let rowIndex = 0;
        let accY = vpRect.top;
        for (let j = 0; j < computedRows.length; j++) {
          accY += computedRows[j] + gap;
          if (panelCenterY < accY) {
            rowIndex = j;
            break;
          }
        }

        const resizerRight = panel.querySelector('.panel-resizer-right');
        const resizerBottom = panel.querySelector('.panel-resizer-bottom');
        const resizerCorner = panel.querySelector('.panel-resizer-corner');

        const canResizeRight = computedCols.length > 1 && colIndex < computedCols.length - 1;
        const canResizeBottom = computedRows.length > 1 && rowIndex < computedRows.length - 1;

        if (resizerRight) {
          resizerRight.style.display = canResizeRight ? 'block' : 'none';
        }
        if (resizerBottom) {
          resizerBottom.style.display = canResizeBottom ? 'block' : 'none';
        }
        if (resizerCorner) {
          resizerCorner.style.display = (canResizeRight && canResizeBottom) ? 'block' : 'none';
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Grid Repositioning & Ordering Logic
  // ---------------------------------------------------------------------------

  function updatePanelOrderUI(vp, currentWs) {
    if (!vp || !currentWs || !currentWs.tabs) return;

    currentWs.tabs.forEach((tab, index) => {
      const panel = vp.querySelector(`#panel-${tab.id}`);
      if (panel) {
        panel.style.order = index;

        const btnPrev = panel.querySelector('.btn-move-prev');
        const btnNext = panel.querySelector('.btn-move-next');
        if (btnPrev) btnPrev.disabled = (index === 0);
        if (btnNext) btnNext.disabled = (index === currentWs.tabs.length - 1);
      }
    });

    updateViewportResizers(vp);
    saveStateDebounced();
  }

  function setupPanelDragAndDrop(panel, dragHandle, tab, currentWs) {
    dragHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const vp = panel.closest('.workspace-viewport') || document.getElementById(`viewport-${currentWs.id}`);
      if (!vp) return;

      document.body.classList.add('is-reordering');
      panel.classList.add('is-dragging-panel');

      let currentTargetPanel = null;

      function onMouseMove(moveEvent) {
        const elem = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        const hoveredPanel = elem ? elem.closest('.grid-panel') : null;

        if (hoveredPanel && hoveredPanel !== panel && hoveredPanel.closest('.workspace-viewport') === vp) {
          if (currentTargetPanel !== hoveredPanel) {
            if (currentTargetPanel) currentTargetPanel.classList.remove('drop-target-active');
            currentTargetPanel = hoveredPanel;
            currentTargetPanel.classList.add('drop-target-active');
          }
        } else {
          if (currentTargetPanel) {
            currentTargetPanel.classList.remove('drop-target-active');
            currentTargetPanel = null;
          }
        }
      }

      function onMouseUp() {
        document.body.classList.remove('is-reordering');
        panel.classList.remove('is-dragging-panel');

        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        if (currentTargetPanel && currentTargetPanel !== panel) {
          currentTargetPanel.classList.remove('drop-target-active');

          const targetTabId = currentTargetPanel.dataset.tabId;
          const sourceIdx = currentWs.tabs.findIndex(t => t.id === tab.id);
          const targetIdx = currentWs.tabs.findIndex(t => t.id === targetTabId);

          if (sourceIdx !== -1 && targetIdx !== -1 && sourceIdx !== targetIdx) {
            const [movedTab] = currentWs.tabs.splice(sourceIdx, 1);
            currentWs.tabs.splice(targetIdx, 0, movedTab);

            updatePanelOrderUI(vp, currentWs);
            showToast('🔁 Bloco reposicionado com sucesso!');
          }
        }
      }

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  // ---------------------------------------------------------------------------
  // Panel (Janela Individual) Component
  // ---------------------------------------------------------------------------

  function createPanelElement(tab, currentWs, vp) {
    const panel = document.createElement('article');
    panel.className = 'grid-panel';
    panel.id = `panel-${tab.id}`;
    panel.dataset.tabId = tab.id;

    // 1. Panel Header (Barra de navegação individual)
    const header = document.createElement('header');
    header.className = 'panel-header';

    // Barra de progresso de carregamento
    const loadingBar = document.createElement('div');
    loadingBar.className = 'panel-loading-bar';
    header.appendChild(loadingBar);

    // Drag Handle para reordenar bloco
    const dragHandle = document.createElement('div');
    dragHandle.className = 'panel-drag-handle';
    dragHandle.title = 'Arraste para reposicionar este bloco no grid';
    dragHandle.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="4" r="1.3"/><circle cx="11" cy="4" r="1.3"/><circle cx="5" cy="8" r="1.3"/><circle cx="11" cy="8" r="1.3"/><circle cx="5" cy="12" r="1.3"/><circle cx="11" cy="12" r="1.3"/></svg>`;
    header.appendChild(dragHandle);

    setupPanelDragAndDrop(panel, dragHandle, tab, currentWs);

    // Controles de navegação: Voltar, Avançar, Recarregar
    const navGroup = document.createElement('div');
    navGroup.className = 'panel-nav-group';

    const btnBack = document.createElement('button');
    btnBack.className = 'btn-panel btn-back';
    btnBack.title = 'Voltar';
    btnBack.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 3L5 8l5 5"/></svg>`;

    const btnForward = document.createElement('button');
    btnForward.className = 'btn-panel btn-forward';
    btnForward.title = 'Avançar';
    btnForward.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3l5 5-5 5"/></svg>`;

    const btnReload = document.createElement('button');
    btnReload.className = 'btn-panel btn-reload';
    btnReload.title = 'Recarregar';
    btnReload.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13.5 8A5.5 5.5 0 119.5 2.8M14 2v4h-4"/></svg>`;

    navGroup.appendChild(btnBack);
    navGroup.appendChild(btnForward);
    navGroup.appendChild(btnReload);
    header.appendChild(navGroup);

    // Barra de URL
    const urlForm = document.createElement('form');
    urlForm.className = 'panel-url-form';
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.className = 'panel-url-input';
    urlInput.value = tab.url || '';
    urlInput.placeholder = 'Digite uma URL ou busque no Google...';
    urlInput.spellcheck = false;
    urlForm.appendChild(urlInput);
    header.appendChild(urlForm);

    // Ações do painel: Reordenar, Suspender, Maximizar, Fechar
    const actionsGroup = document.createElement('div');
    actionsGroup.className = 'panel-actions-group';

    const btnMovePrev = document.createElement('button');
    btnMovePrev.className = 'btn-panel btn-move-prev';
    btnMovePrev.title = 'Mover bloco para trás (posição anterior)';
    btnMovePrev.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 3L5 8l5 5"/></svg>`;

    const btnMoveNext = document.createElement('button');
    btnMoveNext.className = 'btn-panel btn-move-next';
    btnMoveNext.title = 'Mover bloco para frente (próxima posição)';
    btnMoveNext.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3l5 5-5 5"/></svg>`;

    btnMovePrev.addEventListener('click', () => {
      const idx = currentWs.tabs.findIndex(t => t.id === tab.id);
      if (idx > 0) {
        const temp = currentWs.tabs[idx];
        currentWs.tabs[idx] = currentWs.tabs[idx - 1];
        currentWs.tabs[idx - 1] = temp;
        const activeVp = panel.closest('.workspace-viewport') || document.getElementById(`viewport-${currentWs.id}`);
        updatePanelOrderUI(activeVp, currentWs);
        showToast('🔁 Bloco movido para a posição anterior!');
      }
    });

    btnMoveNext.addEventListener('click', () => {
      const idx = currentWs.tabs.findIndex(t => t.id === tab.id);
      if (idx < currentWs.tabs.length - 1) {
        const temp = currentWs.tabs[idx];
        currentWs.tabs[idx] = currentWs.tabs[idx + 1];
        currentWs.tabs[idx + 1] = temp;
        const activeVp = panel.closest('.workspace-viewport') || document.getElementById(`viewport-${currentWs.id}`);
        updatePanelOrderUI(activeVp, currentWs);
        showToast('🔁 Bloco movido para a próxima posição!');
      }
    });

    const btnSleep = document.createElement('button');
    btnSleep.className = 'btn-panel btn-sleep';
    btnSleep.title = tab.isSuspended ? 'Ativar Janela' : 'Suspender para liberar RAM';
    btnSleep.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 4h6l-5 6h5M10 9h3l-2.5 3h2.5"/></svg>`;

    const btnExpand = document.createElement('button');
    btnExpand.className = 'btn-panel btn-expand';
    btnExpand.title = 'Expandir / Foco (Tela Cheia no Grid)';
    btnExpand.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"/></svg>`;

    const btnClosePanel = document.createElement('button');
    btnClosePanel.className = 'btn-panel btn-close';
    btnClosePanel.title = 'Fechar Janela';
    btnClosePanel.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg>`;

    actionsGroup.appendChild(btnMovePrev);
    actionsGroup.appendChild(btnMoveNext);
    actionsGroup.appendChild(btnSleep);
    actionsGroup.appendChild(btnExpand);
    actionsGroup.appendChild(btnClosePanel);
    header.appendChild(actionsGroup);

    panel.appendChild(header);

    // 2. Panel Body (Webview ou Sleep Card)
    const body = document.createElement('div');
    body.className = 'panel-body';
    panel.appendChild(body);

    let webview = null;

    function mountWebview() {
      body.innerHTML = '';
      tab.isSuspended = false;
      btnSleep.title = 'Suspender para liberar RAM';

      webview = document.createElement('webview');
      webview.className = 'panel-webview';
      webview.src = tab.url || 'about:blank';
      webview.setAttribute('allowpopups', 'true');
      webview.setAttribute('partition', 'persist:shared');
      webview.setAttribute('webpreferences', 'backgroundThrottling=true');

      // Webview Events
      webview.addEventListener('did-start-loading', () => {
        loadingBar.classList.add('loading');
        const errCard = body.querySelector('.panel-error-card');
        if (errCard) errCard.remove();
      });

      webview.addEventListener('did-stop-loading', () => {
        loadingBar.classList.remove('loading');
        btnBack.disabled = !webview.canGoBack();
        btnForward.disabled = !webview.canGoForward();
      });

      webview.addEventListener('did-navigate', (e) => {
        tab.url = e.url;
        urlInput.value = e.url;
        const errCard = body.querySelector('.panel-error-card');
        if (errCard) errCard.remove();
        saveStateDebounced();
      });

      webview.addEventListener('did-navigate-in-page', (e) => {
        tab.url = e.url;
        urlInput.value = e.url;
        saveStateDebounced();
      });

      webview.addEventListener('did-fail-load', (e) => {
        loadingBar.classList.remove('loading');
        if (e.errorCode === -3) return; // Ignora cancelamento de navegação normal

        // Se foi erro SSL e é https, tenta http automaticamente uma vez
        if ((e.errorCode === -107 || e.errorDescription === 'ERR_SSL_PROTOCOL_ERROR') && tab.url.startsWith('https://')) {
          const fallbackUrl = tab.url.replace(/^https:\/\//i, 'http://');
          tab.url = fallbackUrl;
          urlInput.value = fallbackUrl;
          webview.src = fallbackUrl;
          saveStateDebounced();
          return;
        }

        // Exibir card de erro explicativo em vez de tela branca
        mountErrorCard(e.errorDescription, e.errorCode);
      });

      body.appendChild(webview);
    }

    function mountErrorCard(errorDesc, errorCode) {
      const existing = body.querySelector('.panel-error-card');
      if (existing) existing.remove();

      const errorCard = document.createElement('div');
      errorCard.className = 'panel-error-card';

      let hint = '';
      if (tab.url.includes('idleworld.online')) {
        hint = '<br><span style="color: #fbbf24; font-size: 11px;">⚠️ Nota: Este endereço é bloqueado pelo Malwarebytes Web Protection nesta máquina. Para acessar, pause a Proteção Web do Malwarebytes ou acione uma exceção.</span>';
      }

      errorCard.innerHTML = `
        <div class="error-icon">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="8" cy="8" r="6"/>
            <path d="M8 5v3.5M8 11.5v.5"/>
          </svg>
        </div>
        <div class="error-title">Falha ao Carregar Página</div>
        <div class="error-desc">Não foi possível estabelecer conexão com o endereço solicitado.${hint}</div>
        <div class="error-code">${errorDesc || 'Erro de Rede'} (${errorCode})</div>
        <div class="error-actions">
          <button class="btn-error-action primary btn-retry">Tentar Novamente</button>
          ${tab.url.startsWith('https://') ? '<button class="btn-error-action btn-try-http">Abrir via HTTP</button>' : ''}
          ${tab.url.startsWith('http://') ? '<button class="btn-error-action btn-try-https">Abrir via HTTPS</button>' : ''}
          <button class="btn-error-action btn-search-google">Buscar no Google</button>
        </div>
      `;

      errorCard.querySelector('.btn-retry').addEventListener('click', () => {
        errorCard.remove();
        if (webview) webview.reload();
      });

      const btnHttp = errorCard.querySelector('.btn-try-http');
      if (btnHttp) {
        btnHttp.addEventListener('click', () => {
          errorCard.remove();
          const newUrl = tab.url.replace(/^https:/i, 'http:');
          tab.url = newUrl;
          urlInput.value = newUrl;
          if (webview) webview.src = newUrl;
          saveStateDebounced();
        });
      }

      const btnHttps = errorCard.querySelector('.btn-try-https');
      if (btnHttps) {
        btnHttps.addEventListener('click', () => {
          errorCard.remove();
          const newUrl = tab.url.replace(/^http:/i, 'https:');
          tab.url = newUrl;
          urlInput.value = newUrl;
          if (webview) webview.src = newUrl;
          saveStateDebounced();
        });
      }

      errorCard.querySelector('.btn-search-google').addEventListener('click', () => {
        errorCard.remove();
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(tab.url.replace(/^https?:\/\//, ''))}`;
        tab.url = searchUrl;
        urlInput.value = searchUrl;
        if (webview) webview.src = searchUrl;
        saveStateDebounced();
      });

      body.appendChild(errorCard);
    }

    function mountSleepCard() {
      body.innerHTML = '';
      tab.isSuspended = true;
      btnSleep.title = 'Ativar Janela';

      const sleepCard = document.createElement('div');
      sleepCard.className = 'panel-sleep-card';

      sleepCard.innerHTML = `
        <div class="sleep-icon">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M3 4h6l-5 6h5M10 9h3l-2.5 3h2.5"/>
          </svg>
        </div>
        <div class="sleep-title">${tab.title || 'Aba em Repouso'}</div>
        <div class="sleep-desc">Esta janela foi suspensa para economizar memória RAM e processamento.</div>
        <button class="btn-wake">Ativar Janela</button>
      `;

      sleepCard.querySelector('.btn-wake').addEventListener('click', () => {
        mountWebview();
        updateWorkspaceStatus();
        saveStateDebounced();
      });

      body.appendChild(sleepCard);
      if (window.api && window.api.optimizeRam) {
        window.api.optimizeRam().catch(() => {});
      }
    }

    // Inicializar no estado correto
    if (tab.isSuspended) {
      mountSleepCard();
    } else {
      mountWebview();
    }

    // Navegação via input de URL
    urlForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const targetUrl = sanitizeUrl(urlInput.value);
      tab.url = targetUrl;
      urlInput.value = targetUrl;

      if (tab.isSuspended) {
        mountWebview();
      } else if (webview) {
        webview.src = targetUrl;
      }
      saveStateDebounced();
    });

    // Botões de navegação
    btnBack.addEventListener('click', () => {
      if (webview && webview.canGoBack()) webview.goBack();
    });

    btnForward.addEventListener('click', () => {
      if (webview && webview.canGoForward()) webview.goForward();
    });

    btnReload.addEventListener('click', () => {
      if (tab.isSuspended) {
        mountWebview();
      } else if (webview) {
        webview.reload();
      }
    });

    // Alternar Suspensão / Ativação
    btnSleep.addEventListener('click', () => {
      if (tab.isSuspended) {
        mountWebview();
        showToast('Janela reativada!');
      } else {
        mountSleepCard();
        showToast('Janela suspensa (RAM liberada)!');
      }
      updateWorkspaceStatus();
      saveStateDebounced();
    });

    // Resize Handles
    const resizerRight = document.createElement('div');
    resizerRight.className = 'panel-resizer-right';
    resizerRight.title = 'Arrastar para redimensionar coluna';

    const resizerBottom = document.createElement('div');
    resizerBottom.className = 'panel-resizer-bottom';
    resizerBottom.title = 'Arrastar para redimensionar linha';

    const resizerCorner = document.createElement('div');
    resizerCorner.className = 'panel-resizer-corner';
    resizerCorner.title = 'Arrastar para redimensionar grade';

    panel.appendChild(resizerRight);
    panel.appendChild(resizerBottom);
    panel.appendChild(resizerCorner);

    setupPanelResizers(panel, currentWs, resizerRight, resizerBottom, resizerCorner);

    // Maximizar / Restaurar no Grid
    btnExpand.addEventListener('click', () => {
      const isMax = panel.classList.toggle('is-maximized');
      btnExpand.title = isMax ? 'Restaurar Grid' : 'Expandir / Foco';
      btnExpand.innerHTML = isMax
        ? `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 2v4H0M12 2v4h4M4 14v-4H0M12 14v-4h4"/></svg>`
        : `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"/></svg>`;
      const activeVp = panel.closest('.workspace-viewport') || document.getElementById(`viewport-${currentWs.id}`);
      updateViewportResizers(activeVp);
    });

    // Fechar Janela
    btnClosePanel.addEventListener('click', () => {
      currentWs.tabs = currentWs.tabs.filter(t => t.id !== tab.id);
      panel.remove();

      const activeVp = panel.closest('.workspace-viewport') || document.getElementById(`viewport-${currentWs.id}`);

      // Se todas as abas forem fechadas, cria uma padrão
      if (currentWs.tabs.length === 0) {
        const defaultTab = {
          id: generateId('tab'),
          url: state.defaultUrl || 'https://google.com',
          title: 'Nova Janela',
          isSuspended: false
        };
        currentWs.tabs.push(defaultTab);
        if (activeVp) {
          activeVp.appendChild(createPanelElement(defaultTab, currentWs, activeVp));
        }
      }

      updateViewportResizers(activeVp);
      updatePanelOrderUI(activeVp, currentWs);
      updateWorkspaceStatus();
      saveStateDebounced();
    });

    // Foco do painel
    panel.addEventListener('click', () => {
      document.querySelectorAll('.grid-panel').forEach(p => p.classList.remove('active-panel'));
      panel.classList.add('active-panel');
      activePanelId = tab.id;
    });

    return panel;
  }

  function addPanelToCurrentWorkspace() {
    const currentWs = getActiveWorkspace();
    if (!currentWs) return;

    const newTab = {
      id: generateId('tab'),
      url: state.defaultUrl || 'https://google.com',
      title: 'Nova Janela',
      isSuspended: false
    };

    if (!currentWs.tabs) currentWs.tabs = [];
    currentWs.tabs.push(newTab);

    const vp = getOrCreateViewport(currentWs);
    const panelEl = createPanelElement(newTab, currentWs, vp);
    vp.appendChild(panelEl);

    updateViewportResizers(vp);
    updatePanelOrderUI(vp, currentWs);
    updateWorkspaceStatus();
    saveStateDebounced();
    showToast('Nova janela adicionada ao grid!');
  }

  function hibernateInactivePanels() {
    const currentWs = getActiveWorkspace();
    if (!currentWs || !currentWs.tabs) return;

    let hibernatedCount = 0;
    const vp = getOrCreateViewport(currentWs);

    currentWs.tabs.forEach(tab => {
      if (tab.id !== activePanelId && !tab.isSuspended) {
        const panelEl = vp.querySelector(`#panel-${tab.id}`);
        if (panelEl) {
          const btnSleep = panelEl.querySelector('.btn-sleep');
          if (btnSleep) {
            btnSleep.click();
            hibernatedCount++;
          }
        }
      }
    });

    updateWorkspaceStatus();
    saveStateDebounced();
    if (window.api && window.api.optimizeRam) {
      window.api.optimizeRam().catch(() => {});
    }
    showToast(`💤 ${hibernatedCount} ${hibernatedCount === 1 ? 'janela suspensa' : 'janelas suspensas'} para liberar RAM!`);
  }

  // ---------------------------------------------------------------------------
  // Topbar Controls & Listeners
  // ---------------------------------------------------------------------------

  // Layout Selector Buttons
  layoutSelector.querySelectorAll('.layout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const layout = btn.dataset.layout;
      if (layout) setLayout(layout);
    });
  });

  // Adicionar Janela
  btnAddPanel.addEventListener('click', addPanelToCurrentWorkspace);

  // Suspender Inativas
  btnSleepAll.addEventListener('click', hibernateInactivePanels);

  // Auto-Resize / Redistribuir Grade Igualmente
  if (btnAutoResize) {
    btnAutoResize.addEventListener('click', () => {
      const currentWs = getActiveWorkspace();
      if (!currentWs) return;

      delete currentWs.customGridColumns;
      delete currentWs.customGridRows;

      const vp = getOrCreateViewport(currentWs);
      vp.style.gridTemplateColumns = '';
      vp.style.gridTemplateRows = '';

      updateViewportResizers(vp);
      saveStateDebounced();
      showToast('✨ Grade redistribuída igualmente!');
    });
  }

  // Listener para redimensionamento da janela do aplicativo
  window.addEventListener('resize', () => {
    const currentWs = getActiveWorkspace();
    if (currentWs) {
      const vp = document.getElementById(`viewport-${currentWs.id}`);
      if (vp) updateViewportResizers(vp);
    }
  });

  // Adicionar Workspace
  btnAddWorkspace.addEventListener('click', createWorkspace);

  // Otimizar RAM
  btnRamOptimize.addEventListener('click', async () => {
    try {
      btnRamOptimize.style.transform = 'rotate(180deg)';
      await window.api.optimizeRam();
      setTimeout(() => {
        btnRamOptimize.style.transform = 'none';
      }, 400);
      showToast('✨ Memória RAM e cache otimizados com sucesso!');
    } catch (err) {
      console.error('Falha ao otimizar RAM:', err);
    }
  });

  // Click-Through Toggle
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

    topBar.addEventListener('mouseenter', onBarEnter);
    topBar.addEventListener('mouseleave', onBarLeave);
  }

  function deactivateClickThrough() {
    isClickThrough = false;
    btnClickThrough.classList.remove('active');
    document.body.classList.remove('click-through-active');
    window.api.setClickThrough(false);

    topBar.removeEventListener('mouseenter', onBarEnter);
    topBar.removeEventListener('mouseleave', onBarLeave);
  }

  function onBarEnter() {
    window.api.setClickThrough(false);
  }

  function onBarLeave() {
    if (isClickThrough) {
      window.api.setClickThrough(true, { forward: true });
    }
  }

  // Opacidade
  opacitySlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    opacityValue.textContent = value + '%';
    window.api.setOpacity(value / 100);
  });

  // Janela Controles
  btnSettings.addEventListener('click', () => window.api.openSettings());
  btnMinimize.addEventListener('click', () => window.api.minimizeApp());
  btnClose.addEventListener('click', () => window.api.closeApp());

  // Listeners de eventos IPC do Main
  window.api.onSettingsUpdated((newSettings) => {
    if (newSettings.defaultUrl) {
      state.defaultUrl = newSettings.defaultUrl;
    }
    if (newSettings.hibernateTimeoutMinutes) {
      state.hibernateTimeoutMinutes = newSettings.hibernateTimeoutMinutes;
    }
    if (newSettings.opacity !== undefined) {
      const pct = Math.round(newSettings.opacity * 100);
      opacitySlider.value = pct;
      opacityValue.textContent = pct + '%';
    }
  });

  window.api.onClickThroughToggled((active) => {
    if (active && !isClickThrough) {
      activateClickThrough();
    } else if (!active && isClickThrough) {
      deactivateClickThrough();
    }
  });

  // ---------------------------------------------------------------------------
  // Inicialização
  // ---------------------------------------------------------------------------

  async function init() {
    try {
      // 1. Carregar Configurações Globais
      const settings = await window.api.getSettings();
      opacitySlider.value = Math.round((settings.opacity || 0.85) * 100);
      opacityValue.textContent = Math.round((settings.opacity || 0.85) * 100) + '%';
      if (settings.clickThrough) {
        activateClickThrough();
      }

      // 2. Carregar Estado de Workspaces e Abas
      const wsData = await window.api.getWorkspacesState();
      state.workspaces = wsData.workspaces || [];
      state.activeWorkspaceId = wsData.activeWorkspaceId || 'ws-default';
      state.defaultUrl = wsData.defaultUrl || settings.defaultUrl || 'https://google.com';
      state.hibernateTimeoutMinutes = wsData.hibernateTimeoutMinutes || 30;

      // Se nenhum workspace existir, criar o inicial padrão
      if (!state.workspaces || state.workspaces.length === 0) {
        state.workspaces = [
          {
            id: 'ws-default',
            title: 'Principal',
            layout: '2x2',
            tabs: [
              { id: generateId('tab'), url: state.defaultUrl, title: 'Início', isSuspended: false },
              { id: generateId('tab'), url: 'https://github.com', title: 'GitHub', isSuspended: false },
              { id: generateId('tab'), url: 'https://bing.com', title: 'Bing', isSuspended: false },
              { id: generateId('tab'), url: 'https://wikipedia.org', title: 'Wikipedia', isSuspended: false }
            ]
          }
        ];
        state.activeWorkspaceId = 'ws-default';
      }

      // 3. Renderizar Super Abas e Viewports persistentes
      renderWorkspacesBar();
      state.workspaces.forEach(ws => {
        getOrCreateViewport(ws);
      });
      switchWorkspace(state.activeWorkspaceId);

    } catch (err) {
      console.error('Falha ao inicializar aplicativo:', err);
    }
  }

  await init();
});
