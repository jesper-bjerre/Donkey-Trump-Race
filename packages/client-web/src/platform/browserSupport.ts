export interface BrowserSupport {
  webgl: boolean;
  websocket: boolean;
  supported: boolean;
}

/** Feature-detects what the game needs; used to show guidance before a player joins. */
export function detectBrowserSupport(win: Window & typeof globalThis = window): BrowserSupport {
  const websocket = typeof win.WebSocket === 'function';
  let webgl: boolean;
  try {
    const canvas = win.document.createElement('canvas');
    webgl = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    webgl = false;
  }
  return { webgl, websocket, supported: webgl && websocket };
}

export const SUPPORTED_BROWSERS_TEXT =
  'Donkey Trump Race needs WebGL and WebSockets. Use a current version of Chrome, Edge, Firefox or Safari with hardware acceleration turned on.';
