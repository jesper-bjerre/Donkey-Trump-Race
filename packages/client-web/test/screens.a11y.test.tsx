import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StructuredError } from '../src/components/common/StructuredError.js';
import { HelpPrivacyModal } from '../src/components/help/HelpPrivacyModal.js';
import { RaceHUD, type HudState } from '../src/components/RaceHUD.js';
import type { GameSocket } from '../src/net/GameSocket.js';
import { LandingRoomEntry } from '../src/screens/LandingRoomEntry.js';
import { MatchResults } from '../src/screens/MatchResults.js';
import { MultiplayerLobby } from '../src/screens/MultiplayerLobby.js';
import { PrivacyPage } from '../src/screens/PrivacyPage.js';
import { axeViolations } from './axe.js';
import { RESULT_STATES } from './fixtures/accessibilityStates.js';
import { fakeSocket, lobbyView, roomSession } from './fixtures/lobbyFixtures.js';
import hudState from './fixtures/raceHudState.basic.json' with { type: 'json' };

const noop = () => undefined;

const cases: Array<[string, () => ReactElement]> = [
  [
    'landing',
    () => (
      <LandingRoomEntry
        onJoined={noop}
        onOpenHelp={noop}
        notice="Your slot is no longer available."
        browserSupport={{ webgl: false, websocket: true, supported: false }}
      />
    ),
  ],
  [
    'lobby',
    () => (
      <MultiplayerLobby
        session={roomSession(0)}
        socket={fakeSocket() as unknown as GameSocket}
        lobby={lobbyView(3)}
        connection="reconnecting"
        notice={null}
        onLeave={noop}
        onOpenHelp={noop}
      />
    ),
  ],
  [
    'results',
    () => (
      <MatchResults
        result={RESULT_STATES.completed!}
        localPlayerId="p_0"
        isHost
        onReplay={async () => undefined}
        onBackToLobby={noop}
        onLeave={noop}
      />
    ),
  ],
  [
    'interrupted results',
    () => (
      <MatchResults
        result={RESULT_STATES.interrupted!}
        localPlayerId="p_0"
        isHost={false}
        onReplay={async () => undefined}
        onBackToLobby={noop}
        onLeave={noop}
      />
    ),
  ],
  ['race HUD', () => <RaceHUD hud={hudState as HudState} connection="open" onOpenHelp={noop} />],
  ['help modal', () => <HelpPrivacyModal onClose={noop} />],
  ['privacy page', () => <PrivacyPage onBack={noop} />],
  [
    'connection lost',
    () => (
      <main>
        <StructuredError
          headingLevel={1}
          title="Connection lost"
          message="Your slot is no longer available."
          actions={[{ label: 'Rejoin room', primary: true, onSelect: noop }]}
        />
      </main>
    ),
  ],
];

describe('screen accessibility (axe)', () => {
  it.each(cases)('%s has no axe violations', async (_name, element) => {
    const { container } = render(element());
    expect(await axeViolations(container)).toEqual([]);
  });
});
