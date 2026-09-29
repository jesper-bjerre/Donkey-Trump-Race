import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, submitPrivacyRequest, type PrivacyRequestBody } from '../net/api.js';
import { TELEMETRY_CATEGORIES } from '../privacy/telemetryCategories.js';

interface Props {
  onBack: () => void;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; requestId: string }
  | { kind: 'error'; message: string };

export function PrivacyPage({ onBack }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [form, setForm] = useState<PrivacyRequestBody>({
    requestType: 'export',
    subjectReference: '',
    contactEmail: '',
  });
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  useEffect(() => headingRef.current?.focus(), []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus({ kind: 'sending' });
    try {
      const receipt = await submitPrivacyRequest(form);
      setStatus({ kind: 'sent', requestId: receipt.requestId });
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof ApiError
            ? error.envelope.error.message
            : 'The request could not be sent. Please try again.',
      });
    }
  };

  return (
    <main className="screen privacy" aria-labelledby="privacy-title">
      <h1 id="privacy-title" ref={headingRef} tabIndex={-1}>
        Privacy notice
      </h1>

      <section className="card" aria-labelledby="collect-title">
        <h2 id="collect-title">What we collect</h2>
        <p>
          Donkey Trump Race is guest-only: you choose a nickname and share a room code. There are no
          accounts, passwords, profiles or advertising cookies. Your room token lives in memory in
          this tab only.
        </p>
        <p>During the closed beta we record anonymous telemetry to check that the game works:</p>
        <ul>
          {TELEMETRY_CATEGORIES.map((category) => (
            <li key={category}>{category}</li>
          ))}
        </ul>
        <p>
          Telemetry never contains your nickname, room code, IP address or token. Rooms and players
          are identified only by salted one-way hashes.
        </p>
      </section>

      <section className="card" aria-labelledby="retention-title">
        <h2 id="retention-title">How long we keep it</h2>
        <ul>
          <li>Rooms and nicknames: deleted when the room expires (15 minutes idle).</li>
          <li>Telemetry and match summaries: 90 days.</li>
          <li>Security audit records: 1 year.</li>
          <li>Privacy requests: until resolved, plus the legal retention period.</li>
        </ul>
      </section>

      <section className="card" aria-labelledby="request-title">
        <h2 id="request-title">Request your data or its deletion</h2>
        <p className="muted">
          Because there are no accounts, tell us how to find your sessions (nickname, date, room
          code if you remember it). We answer by email within 30 days.
        </p>
        {status.kind === 'sent' ? (
          <p className="notice" role="status">
            Request received. Your reference is <strong>{status.requestId}</strong>.
          </p>
        ) : (
          <form onSubmit={(e) => void submit(e)}>
            <fieldset className="field">
              <legend>Request type</legend>
              <label>
                <input
                  type="radio"
                  name="requestType"
                  value="export"
                  checked={form.requestType === 'export'}
                  onChange={() => setForm({ ...form, requestType: 'export' })}
                />{' '}
                Send me a copy of my data
              </label>
              <label>
                <input
                  type="radio"
                  name="requestType"
                  value="deletion"
                  checked={form.requestType === 'deletion'}
                  onChange={() => setForm({ ...form, requestType: 'deletion' })}
                />{' '}
                Delete my data
              </label>
            </fieldset>
            <div className="field">
              <label htmlFor="subject-reference">How can we find your sessions?</label>
              <input
                id="subject-reference"
                required
                minLength={2}
                maxLength={200}
                value={form.subjectReference}
                onChange={(e) => setForm({ ...form, subjectReference: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="contact-email">Email for our reply</label>
              <input
                id="contact-email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              />
            </div>
            {status.kind === 'error' && (
              <p className="error" role="alert">
                {status.message}
              </p>
            )}
            <button type="submit" className="primary" disabled={status.kind === 'sending'}>
              {status.kind === 'sending' ? 'Sending…' : 'Send request'}
            </button>
          </form>
        )}
      </section>

      <div className="actions">
        <button type="button" className="secondary" onClick={onBack}>
          Back to the game
        </button>
      </div>
    </main>
  );
}
