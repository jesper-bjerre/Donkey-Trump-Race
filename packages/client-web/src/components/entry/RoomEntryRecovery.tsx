import type { EntryAction, EntryErrorView } from '../../errors/roomEntryErrorMapper.js';

interface Props {
  error: EntryErrorView;
  onAction: (action: EntryAction) => void;
}

/** Join/create failure with its recovery actions; announced as an alert. */
export function RoomEntryRecovery({ error, onAction }: Props) {
  return (
    <div className="error" role="alert" data-error-code={error.code}>
      <p>{error.message}</p>
      <div className="actions">
        <button type="button" className="link-button" onClick={() => onAction(error.action)}>
          {error.actionLabel}
        </button>
        {error.secondaryAction && (
          <button
            type="button"
            className="link-button"
            onClick={() => onAction(error.secondaryAction!)}
          >
            {error.secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
