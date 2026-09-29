import type { MatchResult } from '../../src/screens/MatchResults.js';

/** Result-screen states covered by the accessibility tests. */
export const RESULT_STATES: Record<string, MatchResult> = {
  completed: {
    matchId: 'm_0123456789ab',
    finishOrder: [
      {
        rank: 1,
        playerId: 'p_1',
        slotIndex: 1,
        nickname: 'Mette',
        color: 'blue',
        finishTick: 5400,
        serverTimeMs: 90_000,
      },
      {
        rank: 2,
        playerId: 'p_0',
        slotIndex: 0,
        nickname: 'LarsFan',
        color: 'red',
        finishTick: 5460,
        serverTimeMs: 91_000,
      },
    ],
    highlights: {
      barrelHits: 4,
      falls: 1,
      shoves: 3,
      itemUses: 2,
      disconnects: 0,
      fastestRescueMs: 87_000,
    },
    outcome: 'completed',
    canReplay: true,
  },
  interrupted: {
    matchId: 'm_ba9876543210',
    finishOrder: [],
    highlights: {
      barrelHits: 0,
      falls: 0,
      shoves: 0,
      itemUses: 0,
      disconnects: 1,
      fastestRescueMs: null,
    },
    outcome: 'interrupted',
    canReplay: false,
  },
};
