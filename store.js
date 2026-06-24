const Store = require('electron-store');

const schema = {
  url: { type: 'string', default: 'https://google.com' },
  opacity: { type: 'number', default: 0.85, minimum: 0.1, maximum: 1.0 },
  clickThrough: { type: 'boolean', default: false },
  alwaysOnTop: { type: 'boolean', default: true },
  windowBounds: {
    type: 'object',
    properties: {
      x: { type: 'number' },
      y: { type: 'number' },
      width: { type: 'number', default: 420 },
      height: { type: 'number', default: 650 }
    },
    default: { width: 420, height: 650 }
  }
};

const store = new Store({ schema });
module.exports = store;
