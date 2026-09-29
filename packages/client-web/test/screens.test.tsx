import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StructuredError } from '../src/components/common/StructuredError.js';
import { HelpPrivacyModal } from '../src/components/help/HelpPrivacyModal.js';
import { itemTargetLabel } from '../src/components/PowerUpHUD.js';
import { RaceHUD, type HudState } from '../src/components/RaceHUD.js';
import type { GameSocket } from '../src/net/GameSocket.js';
import { LandingRoomEntry } from '../src/screens/LandingRoomEntry.js';
import { MatchResults } from '../src/screens/MatchResults.js';
import { MultiplayerLobby } from '../src/screens/MultiplayerLobby.js';
import { PrivacyPage } from '../src/screens/PrivacyPage.js';
import { RESULT_STATES } from './fixtures/accessibilityStates.js';
import { fakeSocket, lobbyPlayer, lobbyView, roomSession } from './fixtures/lobbyFixtures.js';
import hudState from './fixtures/raceHudState.basic.json' with { type: 'json' };
import {
  envelopeResponse,
  LEAKY_SERVER_ERROR,
  ROOM_ENTRY_ERROR_CASES,
} from './fixtures/roomEntryErrorFixtures.js';

const supported = { webgl: true, websocket: true, supported: true };

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderEntry(props: Partial<Parameters<typeof LandingRoomEntry>[0]> = {}) {
  const onJoined = vi.fn();
  render(
    <LandingRoomEntry
      onJoined={onJoined}
      onOpenHelp={() => undefined}
      notice={null}
      browserSupport={supported}
      {...props}
    />,
  );
  return { onJoined };
}

describe('LandingRoomEntry', () => {
  it('shows the title, labelled fields and both actions', () => {
    renderEntry();
    expect(screen.getByRole('heading', { level: 1, name: 'Donkey Trump Race' })).toBeTruthy();
    expect(screen.getByLabelText('Nickname')).toBe(document.activeElement);
    expect(screen.getByLabelText('Room code')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create room' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Join room' })).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('prefills the room code from an invite link', () => {
    renderEntry({ initialRoomCode: 'b3c4d' });
    expect((screen.getByLabelText('Room code') as HTMLInputElement).value).toBe('B3C4D');
  });

  it('warns when the browser lacks WebGL', () => {
    renderEntry({ browserSupport: { webgl: false, websocket: true, supported: false } });
    expect(screen.getByRole('note').textContent).toMatch(/WebGL/);
  });

  it.each(ROOM_ENTRY_ERROR_CASES)(
    'recovers from $code ($status) with the right focus and actions',
    async ({ code, focus, actions }) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(envelopeResponse(code)));
      const user = userEvent.setup();
      renderEntry();
      await user.type(screen.getByLabelText('Nickname'), 'LarsFan');
      await user.type(screen.getByLabelText('Room code'), 'A7K2Q');
      await user.click(screen.getByRole('button', { name: 'Join room' }));
      const alert = await screen.findByRole('alert');
      expect(alert.dataset.errorCode).toBe(code);
      const buttons = Array.from(alert.querySelectorAll('button')).map((b) => b.textContent);
      expect(buttons).toEqual(actions);
      if (focus === 'nickname')
        expect(document.activeElement).toBe(screen.getByLabelText('Nickname'));
      if (focus === 'roomCode')
        expect(document.activeElement).toBe(screen.getByLabelText('Room code'));
    },
  );

  it('never renders server stack traces', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(LEAKY_SERVER_ERROR), { status: 500 })),
    );
    const user = userEvent.setup();
    renderEntry();
    await user.type(screen.getByLabelText('Nickname'), 'LarsFan');
    await user.click(screen.getByRole('button', { name: 'Create room' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Something went wrong');
    expect(document.body.textContent).not.toMatch(/GameService|at .*\.ts|boom/);
  });

  it('creates a new room from the recovery action of a full room', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(envelopeResponse('ROOM_FULL'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(roomSession()), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const { onJoined } = renderEntry();
    await user.type(screen.getByLabelText('Nickname'), 'LarsFan');
    await user.type(screen.getByLabelText('Room code'), 'A7K2Q');
    await user.click(screen.getByRole('button', { name: 'Join room' }));
    await user.click(await screen.findByRole('button', { name: 'Create a new room' }));
    await waitFor(() => expect(onJoined).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/v1/rooms');
  });
});

describe('MultiplayerLobby', () => {
  const baseProps = {
    session: roomSession(0),
    connection: 'open' as const,
    notice: null,
    onLeave: () => undefined,
    onOpenHelp: () => undefined,
  };

  it('renders every slot with a text label, not colour alone', () => {
    const socket = fakeSocket() as unknown as GameSocket;
    render(<MultiplayerLobby {...baseProps} socket={socket} lobby={lobbyView(3)} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    expect(rows[1]!.getAttribute('aria-label')).toBe('Player 2, Mette, Blue, not ready');
    expect(screen.getByText(/slot is kept for 60 seconds/)).toBeTruthy();
  });

  it('disables start with a reason until guests are ready', () => {
    const socket = fakeSocket() as unknown as GameSocket;
    const { rerender } = render(
      <MultiplayerLobby {...baseProps} socket={socket} lobby={lobbyView(2)} />,
    );
    const start = screen.getByRole('button', { name: 'Start race' }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(screen.getByText('Waiting for Mette to be ready.')).toBeTruthy();
    const ready = lobbyView(2, { players: [lobbyPlayer(0), lobbyPlayer(1, { ready: true })] });
    rerender(<MultiplayerLobby {...baseProps} socket={socket} lobby={ready} />);
    expect((screen.getByRole('button', { name: 'Start race' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('announces joins, readiness and departures politely', () => {
    const socket = fakeSocket() as unknown as GameSocket;
    const { rerender } = render(
      <MultiplayerLobby {...baseProps} socket={socket} lobby={lobbyView(1)} />,
    );
    rerender(<MultiplayerLobby {...baseProps} socket={socket} lobby={lobbyView(2)} />);
    const live = screen.getByTestId('roster-announcement');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent).toBe('Mette joined.');
    rerender(<MultiplayerLobby {...baseProps} socket={socket} lobby={lobbyView(1)} />);
    expect(live.textContent).toBe('Mette left the room.');
  });

  it('lets a guest toggle ready', () => {
    const socket = fakeSocket();
    render(
      <MultiplayerLobby
        {...baseProps}
        session={roomSession(1)}
        socket={socket as unknown as GameSocket}
        lobby={lobbyView(2)}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: "I'm ready" }));
    expect(socket.sent).toEqual([{ type: 'client.ready', ready: true }]);
  });
});

describe('MatchResults', () => {
  it('shows the server finish order unchanged and a host replay action', async () => {
    const onReplay = vi.fn().mockResolvedValue(undefined);
    render(
      <MatchResults
        result={RESULT_STATES.completed!}
        localPlayerId="p_0"
        isHost
        onReplay={onReplay}
        onBackToLobby={() => undefined}
        onLeave={() => undefined}
      />,
    );
    expect(document.activeElement?.textContent).toBe('Mette rescued Motzfeldt!');
    const names = screen
      .getAllByRole('listitem')
      .map((li) => li.querySelector('strong')?.textContent);
    expect(names).toEqual(['Mette', 'LarsFan']);
    expect(screen.getByText('87.0s')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    });
    expect(onReplay).toHaveBeenCalledOnce();
  });

  it('explains when a rematch is unavailable and when the match was interrupted', () => {
    render(
      <MatchResults
        result={RESULT_STATES.interrupted!}
        localPlayerId="p_0"
        isHost
        onReplay={vi.fn()}
        onBackToLobby={() => undefined}
        onLeave={() => undefined}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Play again' })).toBeNull();
    expect(screen.getByText(/Rematch unavailable/)).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/stop early/);
  });

  it('tells guests the host decides on a rematch', () => {
    render(
      <MatchResults
        result={RESULT_STATES.completed!}
        localPlayerId="p_1"
        isHost={false}
        onReplay={vi.fn()}
        onBackToLobby={() => undefined}
        onLeave={() => undefined}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Play again' })).toBeNull();
    expect(screen.getByText(/Waiting for the host/)).toBeTruthy();
  });
});

describe('RaceHUD', () => {
  it('labels standings, progress, penalty and power-up target', () => {
    render(<RaceHUD hud={hudState as HudState} connection="open" onOpenHelp={() => undefined} />);
    expect(screen.getByRole('status', { name: 'Penalty' }).textContent).toMatch(/No penalty/);
    expect(screen.getByRole('progressbar', { name: 'Progress to Motzfeldt' })).toBeTruthy();
    expect(screen.getByText('Mette shoved you!')).toBeTruthy();
    expect(screen.getByText('Affects: the race leader')).toBeTruthy();
    expect(itemTargetLabel('speedBoost')).toBe('Affects: you');
  });

  it('announces the penalty countdown', () => {
    render(
      <RaceHUD
        hud={{ ...(hudState as HudState), penaltyMs: 1500, penaltyKind: 'knockdown' }}
        connection="open"
        onOpenHelp={() => undefined}
      />,
    );
    expect(screen.getByRole('status', { name: 'Penalty' }).textContent).toMatch(
      /Seeing stars … 1\.5s/,
    );
  });
});

describe('HelpPrivacyModal', () => {
  it('traps focus, links the privacy notice and restores focus on Escape', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn();
    const { unmount } = render(<HelpPrivacyModal onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'How to play' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Privacy notice/ }).getAttribute('href')).toBe(
      '/privacy',
    );
    expect(screen.getByText(/Gameplay moments/)).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});

describe('StructuredError', () => {
  it('focuses its heading and exposes actions', () => {
    const onRejoin = vi.fn();
    render(
      <StructuredError
        headingLevel={1}
        autoFocus
        title="Connection lost"
        message="Your slot is no longer available."
        actions={[{ label: 'Rejoin room', primary: true, onSelect: onRejoin }]}
      />,
    );
    expect(document.activeElement?.textContent).toBe('Connection lost');
    fireEvent.click(screen.getByRole('button', { name: 'Rejoin room' }));
    expect(onRejoin).toHaveBeenCalled();
  });
});

describe('PrivacyPage', () => {
  it('submits a deletion request and shows the reference', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          requestId: 'prq_0123456789abcdef',
          requestStatus: 'received',
          receivedAt: '2026-12-10T12:00:00Z',
        }),
        { status: 202, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<PrivacyPage onBack={() => undefined} />);
    await user.click(screen.getByLabelText('Delete my data'));
    await user.type(screen.getByLabelText('How can we find your sessions?'), 'LarsFan 10 Dec');
    await user.type(screen.getByLabelText('Email for our reply'), 'lars@example.com');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('prq_0123456789abcdef')).toBeTruthy();
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      requestType: 'deletion',
      subjectReference: 'LarsFan 10 Dec',
      contactEmail: 'lars@example.com',
    });
  });
});
