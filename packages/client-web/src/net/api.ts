import {
  createErrorEnvelope,
  isErrorEnvelope,
  type ErrorEnvelope,
  type RoomSession,
  type StartMatchResponse,
} from '@dtr/shared-protocol';

export class ApiError extends Error {
  constructor(readonly envelope: ErrorEnvelope) {
    super(envelope.error.message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError(createErrorEnvelope('INTERNAL_ERROR'));
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(isErrorEnvelope(body) ? body : createErrorEnvelope('INTERNAL_ERROR'));
  }
  return body as T;
}

export function createRoom(nickname: string): Promise<RoomSession> {
  return request('/api/v1/rooms', { method: 'POST', body: JSON.stringify({ nickname }) });
}

export function joinRoom(roomCode: string, nickname: string): Promise<RoomSession> {
  return request(`/api/v1/rooms/${encodeURIComponent(roomCode.trim().toUpperCase())}/join`, {
    method: 'POST',
    body: JSON.stringify({ nickname }),
  });
}

export function startMatch(roomCode: string, roomToken: string): Promise<StartMatchResponse> {
  return request(`/api/v1/rooms/${encodeURIComponent(roomCode)}/start`, {
    method: 'POST',
    headers: { authorization: `Bearer ${roomToken}` },
    body: '{}',
  });
}

/** Host-only rematch from the results screen. */
export function replayMatch(roomCode: string, roomToken: string): Promise<StartMatchResponse> {
  return request(`/api/v1/rooms/${encodeURIComponent(roomCode)}/replay`, {
    method: 'POST',
    headers: { authorization: `Bearer ${roomToken}` },
    body: '{}',
  });
}

export interface PrivacyRequestBody {
  requestType: 'export' | 'deletion';
  subjectReference: string;
  contactEmail: string;
}

export interface PrivacyRequestReceipt {
  requestId: string;
  requestStatus: 'received';
  receivedAt: string;
}

export function submitPrivacyRequest(body: PrivacyRequestBody): Promise<PrivacyRequestReceipt> {
  return request('/api/v1/privacy/requests', { method: 'POST', body: JSON.stringify(body) });
}
