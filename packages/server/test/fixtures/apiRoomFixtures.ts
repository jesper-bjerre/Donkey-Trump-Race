/** REST request bodies and expectations shared by the room API tests. */
export const TOKEN_SECRET_PLACEHOLDER = 'test-secret-placeholder-0123456789';

export const createRoomBodies = {
  valid: { nickname: 'LarsFan' },
  danish: { nickname: 'Jumpman Løkke' },
  invalidSymbols: { nickname: '<script>' },
  tooShort: { nickname: 'a' },
  missing: {},
};

export const joinErrorExpectations = [
  { name: 'malformed room code', code: 'nope', status: 400, errorCode: 'INVALID_ROOM_CODE' },
  { name: 'ambiguous characters', code: 'AOK2Q', status: 400, errorCode: 'INVALID_ROOM_CODE' },
  { name: 'unknown room', code: 'ZZZZZ', status: 404, errorCode: 'ROOM_NOT_FOUND' },
] as const;

export const privacyRequestBodies = {
  deletion: {
    requestType: 'deletion',
    subjectReference: 'LarsFan, room A7K2Q, 10 December evening',
    contactEmail: 'tester@example.com',
  },
  export: {
    requestType: 'export',
    subjectReference: 'Mette in room B3C4D',
    contactEmail: 'mette@example.com',
  },
  unknownType: {
    requestType: 'rectification',
    subjectReference: 'LarsFan',
    contactEmail: 'tester@example.com',
  },
  malformed: { requestType: 'export' },
};
