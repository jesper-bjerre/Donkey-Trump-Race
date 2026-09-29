import { ERROR_CATALOG, type ErrorCode } from '@dtr/shared-protocol';

export type FocusTarget = 'nickname' | 'roomCode' | null;
export type EntryAction =
  | 'edit-nickname'
  | 'retry-room-code'
  | 'create-new-room'
  | 'retry-later'
  | 'return-to-entry'
  | 'retry';

export interface EntryErrorView {
  code: ErrorCode;
  /** Catalog text only: never server-provided detail, stacks or raw input. */
  message: string;
  focusTarget: FocusTarget;
  action: EntryAction;
  actionLabel: string;
  /** Optional second way out, e.g. "Create a new room" when the room is full. */
  secondaryAction?: EntryAction;
  secondaryActionLabel?: string;
}

const CREATE = {
  secondaryAction: 'create-new-room',
  secondaryActionLabel: 'Create a new room',
} as const;

/** Maps a server error code to a user-facing message plus the field to focus and a recovery action. */
export function mapRoomEntryError(code: ErrorCode): EntryErrorView {
  const message = ERROR_CATALOG[code].userMessage;
  switch (code) {
    case 'INVALID_NICKNAME':
      return {
        code,
        message,
        focusTarget: 'nickname',
        action: 'edit-nickname',
        actionLabel: 'Edit nickname',
      };
    case 'INVALID_ROOM_CODE':
      return {
        code,
        message,
        focusTarget: 'roomCode',
        action: 'retry-room-code',
        actionLabel: 'Check the code',
      };
    case 'ROOM_NOT_FOUND':
      return {
        code,
        message,
        focusTarget: 'roomCode',
        action: 'retry-room-code',
        actionLabel: 'Check the code',
        ...CREATE,
      };
    case 'ROOM_EXPIRED':
    case 'RECONNECT_EXPIRED':
      return {
        code,
        message,
        focusTarget: null,
        action: 'create-new-room',
        actionLabel: 'Create a new room',
      };
    case 'ROOM_FULL':
      return {
        code,
        message,
        focusTarget: 'roomCode',
        action: 'retry-later',
        actionLabel: 'Try again',
        ...CREATE,
      };
    case 'ROOM_IN_PROGRESS':
      return {
        code,
        message,
        focusTarget: 'roomCode',
        action: 'return-to-entry',
        actionLabel: 'Pick another room',
        ...CREATE,
      };
    case 'RATE_LIMITED':
      return { code, message, focusTarget: null, action: 'retry-later', actionLabel: 'Try again' };
    default:
      return { code, message, focusTarget: null, action: 'retry', actionLabel: 'Try again' };
  }
}
