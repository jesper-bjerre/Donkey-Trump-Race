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
  message: string;
  focusTarget: FocusTarget;
  action: EntryAction;
  actionLabel: string;
}

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
    case 'ROOM_NOT_FOUND':
      return {
        code,
        message,
        focusTarget: 'roomCode',
        action: 'retry-room-code',
        actionLabel: 'Check the code',
      };
    case 'ROOM_EXPIRED':
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
      };
    case 'ROOM_IN_PROGRESS':
      return {
        code,
        message,
        focusTarget: 'roomCode',
        action: 'return-to-entry',
        actionLabel: 'Pick another room',
      };
    case 'RATE_LIMITED':
      return { code, message, focusTarget: null, action: 'retry-later', actionLabel: 'Try again' };
    default:
      return { code, message, focusTarget: null, action: 'retry', actionLabel: 'Try again' };
  }
}
