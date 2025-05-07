// Mock the logger
jest.mock('@/utils/logger');

describe('TokenService', () => {
  // Use the actual singleton instance for testing its methods
  // const tokenService = require('@/services/token.service').default;

  // Mock Date.now() for consistent token expiration tests
  let dateNowSpy: jest.SpyInstance;
  const MOCK_DATE = new Date('2023-01-01T12:00:00Z');
  const MOCK_TIMESTAMP_SEC = Math.floor(MOCK_DATE.getTime() / 1000);

  beforeEach(() => {
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(MOCK_DATE.getTime());
    // Reset the blacklist before each test by accessing the correct property
    // We need to cast to 'any' because blacklistedJtis is private
    if ((tokenService as any).blacklistedJtis) {
        (tokenService as any).blacklistedJtis.clear();
    } else {
        // Handle case where the service instance might not be fully initialized in test env?
        console.error('tokenService.blacklistedJtis is undefined in beforeEach');
        // Or initialize it here if appropriate for the test setup
        (tokenService as any).blacklistedJtis = new Map();
    }
  });

  // ... rest of the file ...
}); 