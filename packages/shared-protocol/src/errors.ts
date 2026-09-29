export const ERROR_CODES = [
  'INVALID_NICKNAME',
  'INVALID_ROOM_CODE',
  'ROOM_NOT_FOUND',
  'ROOM_EXPIRED',
  'ROOM_FULL',
  'ROOM_IN_PROGRESS',
  'NOT_ENOUGH_PLAYERS',
  'PLAYERS_NOT_READY',
  'TOKEN_MISSING',
  'TOKEN_INVALID',
  'TOKEN_FORBIDDEN',
  'RATE_LIMITED',
  'BAD_REQUEST',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type RecoveryAction =
  | 'edit-nickname'
  | 'retry-room-code'
  | 'create-new-room'
  | 'retry-later'
  | 'return-to-entry'
  | 'wait-for-players'
  | 'rejoin'
  | 'none';

interface CatalogEntry {
  statusCode: number;
  userMessage: string;
  recoveryAction: RecoveryAction;
}

export const ERROR_CATALOG: Record<ErrorCode, CatalogEntry> = {
  INVALID_NICKNAME: {
    statusCode: 400,
    userMessage: 'Use 2–16 letters, numbers, spaces, hyphen, or underscore.',
    recoveryAction: 'edit-nickname',
  },
  INVALID_ROOM_CODE: {
    statusCode: 400,
    userMessage: 'Room codes are 5 characters, like A7K2Q.',
    recoveryAction: 'retry-room-code',
  },
  ROOM_NOT_FOUND: {
    statusCode: 404,
    userMessage: 'No room with that code. Check the code or create a new room.',
    recoveryAction: 'retry-room-code',
  },
  ROOM_EXPIRED: {
    statusCode: 410,
    userMessage: 'That room has expired. Create a new room to play.',
    recoveryAction: 'create-new-room',
  },
  ROOM_FULL: {
    statusCode: 409,
    userMessage: 'That room already has 5 players. Try again later or create a new room.',
    recoveryAction: 'retry-later',
  },
  ROOM_IN_PROGRESS: {
    statusCode: 409,
    userMessage: 'That match has already started. Wait for it to finish or create a new room.',
    recoveryAction: 'return-to-entry',
  },
  NOT_ENOUGH_PLAYERS: {
    statusCode: 409,
    userMessage: 'At least 2 players are needed to start.',
    recoveryAction: 'wait-for-players',
  },
  PLAYERS_NOT_READY: {
    statusCode: 409,
    userMessage: 'Everyone must be ready before the host can start.',
    recoveryAction: 'wait-for-players',
  },
  TOKEN_MISSING: {
    statusCode: 401,
    userMessage: 'Your session is missing. Please rejoin the room.',
    recoveryAction: 'rejoin',
  },
  TOKEN_INVALID: {
    statusCode: 401,
    userMessage: 'Your session has expired. Please rejoin the room.',
    recoveryAction: 'rejoin',
  },
  TOKEN_FORBIDDEN: {
    statusCode: 403,
    userMessage: 'Only the host can do that.',
    recoveryAction: 'none',
  },
  RATE_LIMITED: {
    statusCode: 429,
    userMessage: 'Too many attempts. Please wait a moment and try again.',
    recoveryAction: 'retry-later',
  },
  BAD_REQUEST: {
    statusCode: 400,
    userMessage: 'The request could not be understood.',
    recoveryAction: 'none',
  },
  INTERNAL_ERROR: {
    statusCode: 500,
    userMessage: 'Something went wrong. Please try again.',
    recoveryAction: 'retry-later',
  },
};

export interface ErrorEnvelope {
  statusCode: number;
  error: { code: ErrorCode; message: string; recoveryAction: RecoveryAction };
  requestId?: string;
}

export function getHttpStatusForErrorCode(code: ErrorCode): number {
  return ERROR_CATALOG[code].statusCode;
}

export function createErrorEnvelope(code: ErrorCode, requestId?: string): ErrorEnvelope {
  const entry = ERROR_CATALOG[code];
  const envelope: ErrorEnvelope = {
    statusCode: entry.statusCode,
    error: { code, message: entry.userMessage, recoveryAction: entry.recoveryAction },
  };
  if (requestId !== undefined) envelope.requestId = requestId;
  return envelope;
}

export function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const error = (value as { error?: { code?: unknown } }).error;
  return typeof error?.code === 'string' && (ERROR_CODES as readonly string[]).includes(error.code);
}

/** Error carrying a catalog code; thrown by domain services and mapped to envelopes at the edge. */
export class GameError extends Error {
  constructor(public readonly code: ErrorCode) {
    super(code);
    this.name = 'GameError';
  }
}
