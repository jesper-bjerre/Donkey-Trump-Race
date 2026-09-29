import { useEffect, useRef } from 'react';

export interface StructuredErrorAction {
  label: string;
  onSelect: () => void;
  primary?: boolean;
}

interface Props {
  title: string;
  message: string;
  actions: StructuredErrorAction[];
  /** Moves keyboard focus to the heading when shown (full-screen errors). */
  autoFocus?: boolean;
  headingLevel?: 1 | 2;
}

/**
 * Safe, recoverable error presentation: catalog message text only (never stacks or raw
 * server details), announced as an alert, with explicit keyboard-reachable recovery actions.
 */
export function StructuredError({
  title,
  message,
  actions,
  autoFocus = false,
  headingLevel = 2,
}: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (autoFocus) headingRef.current?.focus();
  }, [autoFocus]);
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <section
      className="card structured-error"
      role="alert"
      aria-labelledby="structured-error-title"
    >
      <Heading id="structured-error-title" ref={headingRef} tabIndex={-1}>
        {title}
      </Heading>
      <p>{message}</p>
      {actions.length > 0 && (
        <div className="actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={action.primary ? 'primary' : 'secondary'}
              onClick={action.onSelect}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
