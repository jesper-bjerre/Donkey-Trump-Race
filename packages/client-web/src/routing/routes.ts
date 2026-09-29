import { isValidRoomCode, normalizeRoomCode } from '@dtr/shared-protocol';

/**
 * Tiny history-based routing (no router dependency):
 *   /                      landing
 *   /rooms/ABCDE           invite link: landing with the room code filled in, or the lobby
 *   /rooms/ABCDE/results   results of the last match
 *   /privacy               privacy notice and data-request form
 */
export type Route =
  | { name: 'home' }
  | { name: 'room'; roomCode: string }
  | { name: 'results'; roomCode: string }
  | { name: 'privacy' };

export function parseRoute(pathname: string, search = ''): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/privacy') return { name: 'privacy' };
  const room = /^\/rooms\/([^/]+)(\/results)?$/.exec(path);
  if (room && isValidRoomCode(room[1]!)) {
    const roomCode = normalizeRoomCode(room[1]!);
    return room[2] ? { name: 'results', roomCode } : { name: 'room', roomCode };
  }
  // Legacy invite links: /?room=ABCDE
  const legacy = new URLSearchParams(search).get('room');
  if (legacy && isValidRoomCode(legacy))
    return { name: 'room', roomCode: normalizeRoomCode(legacy) };
  return { name: 'home' };
}

export function routePath(route: Route): string {
  switch (route.name) {
    case 'home':
      return '/';
    case 'privacy':
      return '/privacy';
    case 'room':
      return `/rooms/${route.roomCode}`;
    case 'results':
      return `/rooms/${route.roomCode}/results`;
  }
}

export function inviteUrl(origin: string, roomCode: string): string {
  return `${origin}${routePath({ name: 'room', roomCode })}`;
}

/** Updates the address bar without reloading; replace avoids polluting history on sync. */
export function navigate(route: Route, mode: 'push' | 'replace' = 'push'): void {
  const path = routePath(route);
  if (window.location.pathname === path && !window.location.search) return;
  if (mode === 'push') window.history.pushState(null, '', path);
  else window.history.replaceState(null, '', path);
}
