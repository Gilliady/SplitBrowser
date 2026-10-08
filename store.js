const defaultWorkspaces = [
  {
    id: 'ws-default',
    title: 'Principal',
    layout: '2x2',
    tabs: [
      { id: 'tab-1', url: 'https://google.com', title: 'Google', isSuspended: false },
      { id: 'tab-2', url: 'https://github.com', title: 'GitHub', isSuspended: false },
      { id: 'tab-3', url: 'https://bing.com', title: 'Bing', isSuspended: false },
      { id: 'tab-4', url: 'https://wikipedia.org', title: 'Wikipedia', isSuspended: false }
    ]
  }
];

const schema = {
  url: { type: 'string', default: 'https://google.com' },
  defaultUrl: { type: 'string', default: 'https://google.com' },
  opacity: { type: 'number', default: 0.85, minimum: 0.1, maximum: 1.0 },
  clickThrough: { type: 'boolean', default: false },
  shortcutClickThrough: { type: 'string', default: 'CommandOrControl+Shift+O' },
  shortcutVisibility: { type: 'string', default: 'CommandOrControl+Shift+H' },
  alwaysOnTop: { type: 'boolean', default: true },
  hibernateTimeoutMinutes: { type: 'number', default: 30 },
  workspaces: {
    type: 'array',
    default: defaultWorkspaces
  },
  activeWorkspaceId: {
    type: 'string',
    default: 'ws-default'
  },
  windowBounds: {
    type: 'object',
    properties: {
      x: { type: 'number' },
      y: { type: 'number' },
      width: { type: 'number', default: 1200 },
      height: { type: 'number', default: 780 }
    },
    default: { width: 1200, height: 780 }
  }
};

let storeInstance = null;

async function getStore() {
  if (!storeInstance) {
    const { default: Store } = await import('electron-store');
    storeInstance = new Store({ name: 'fixed-tool', projectName: 'fixed-tool', schema });

    // Se workspaces estiver vazio ou for migração da versão 1.0
    const existingWorkspaces = storeInstance.get('workspaces');
    if (!existingWorkspaces || !Array.isArray(existingWorkspaces) || existingWorkspaces.length === 0) {
      const oldUrl = storeInstance.get('url') || 'https://google.com';
      storeInstance.set('workspaces', [
        {
          id: 'ws-default',
          title: 'Principal',
          layout: '2x2',
          tabs: [
            { id: 'tab-1', url: oldUrl, title: 'Início', isSuspended: false },
            { id: 'tab-2', url: 'https://github.com', title: 'GitHub', isSuspended: false },
            { id: 'tab-3', url: 'https://bing.com', title: 'Bing', isSuspended: false },
            { id: 'tab-4', url: 'https://wikipedia.org', title: 'Wikipedia', isSuspended: false }
          ]
        }
      ]);
      storeInstance.set('activeWorkspaceId', 'ws-default');
    }
  }
  return storeInstance;
}

module.exports = { getStore };
