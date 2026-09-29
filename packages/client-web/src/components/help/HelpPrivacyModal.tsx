import { useEffect, useRef } from 'react';
import { ITEM_DEFINITIONS } from '@dtr/shared-items';

interface Props {
  onClose: () => void;
}

export function HelpPrivacyModal({ onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button, a[href]');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="help-title">How to play</h2>
        <p>
          Be the first Jumpman Løkke to climb the tower and rescue Motzfeldt. You can only jump half
          a floor, so use the ladders. The left side is a wall; fall off the right edge and you
          respawn after a delay.
        </p>
        <h3>Keyboard controls</h3>
        <ul>
          <li>
            <kbd>W</kbd> / <kbd>↑</kbd> run forward, climb up ladders
          </li>
          <li>
            <kbd>S</kbd> / <kbd>↓</kbd> run back, climb down
          </li>
          <li>
            <kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd> change lane
          </li>
          <li>
            <kbd>Space</kbd> jump (over barrels!)
          </li>
          <li>
            <kbd>E</kbd> / <kbd>Shift</kbd> use your item · <kbd>?</kbd> opens this help
          </li>
        </ul>
        <h3>Hazards &amp; items</h3>
        <ul>
          <li>Barrels knock you down: you see stars and cannot run for 2 seconds.</li>
          <li>Run into rivals from the side to shove them — maybe right off the edge.</li>
          {Object.values(ITEM_DEFINITIONS).map((item) => (
            <li key={item.type}>
              {item.icon} <strong>{item.displayName}</strong>: {item.description}
            </li>
          ))}
        </ul>
        <h3>Privacy</h3>
        <p>
          Guest play only: we ask for a nickname and room code, nothing else. No accounts, passwords
          or profiles. Your room token is kept in memory only. Rooms and nicknames are deleted when
          the room expires. Basic telemetry (match events, never your nickname) may be collected
          during the beta.
        </p>
        <p className="muted">
          A parody game. Characters are caricatures and not endorsed by the people they depict.
        </p>
        <button type="button" className="primary" ref={closeRef} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
