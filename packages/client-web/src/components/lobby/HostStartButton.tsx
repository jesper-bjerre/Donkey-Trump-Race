interface Props {
  /** Why the host cannot start yet, or null when everyone is ready. */
  blocker: string | null;
  starting: boolean;
  inLobby: boolean;
  onStart: () => void;
}

/** Host-only start control; the reason it is disabled is always announced next to it. */
export function HostStartButton({ blocker, starting, inLobby, onStart }: Props) {
  const canStartMatch = blocker === null && !starting && inLobby;
  return (
    <>
      <button
        type="button"
        className="primary"
        disabled={!canStartMatch}
        aria-describedby="start-status"
        onClick={onStart}
      >
        {starting ? 'Starting…' : 'Start race'}
      </button>
      <p id="start-status" className="muted" role="status">
        {blocker ?? 'Everyone is ready!'}
      </p>
    </>
  );
}
