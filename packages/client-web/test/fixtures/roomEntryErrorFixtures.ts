import { createErrorEnvelope, type ErrorCode } from '@dtr/shared-protocol';

/** Server error envelopes for every room-entry failure the UI must recover from. */
export const ROOM_ENTRY_ERROR_CASES: Array<{
  code: ErrorCode;
  status: number;
  focus: 'nickname' | 'roomCode' | null;
  actions: string[];
}> = [
  { code: 'INVALID_NICKNAME', status: 400, focus: 'nickname', actions: ['Edit nickname'] },
  { code: 'INVALID_ROOM_CODE', status: 400, focus: 'roomCode', actions: ['Check the code'] },
  {
    code: 'ROOM_NOT_FOUND',
    status: 404,
    focus: 'roomCode',
    actions: ['Check the code', 'Create a new room'],
  },
  {
    code: 'ROOM_FULL',
    status: 409,
    focus: 'roomCode',
    actions: ['Try again', 'Create a new room'],
  },
  {
    code: 'ROOM_IN_PROGRESS',
    status: 409,
    focus: 'roomCode',
    actions: ['Pick another room', 'Create a new room'],
  },
  { code: 'ROOM_EXPIRED', status: 410, focus: null, actions: ['Create a new room'] },
  { code: 'RATE_LIMITED', status: 429, focus: null, actions: ['Try again'] },
];

/** A hostile 500 body: the UI must show catalog text, never these details. */
export const LEAKY_SERVER_ERROR = {
  ...createErrorEnvelope('INTERNAL_ERROR', 'corr-1'),
  stack: 'Error: boom\n    at GameService.ts:42',
};

export function envelopeResponse(code: ErrorCode): Response {
  const envelope = createErrorEnvelope(code, 'corr-fixture');
  return new Response(JSON.stringify(envelope), {
    status: envelope.statusCode,
    headers: { 'content-type': 'application/json' },
  });
}
