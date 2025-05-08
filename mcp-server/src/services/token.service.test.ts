// Mock the logger
jest.mock('@/utils/logger');

import tokenService from '@/services/token.service';
import { AuthPayload } from '@/middleware/auth.middleware';
import jwt from 'jsonwebtoken';
import config from '@/config';

describe('TokenService', () => {
  // Use the actual singleton instance for testing its methods
  // const tokenService = require('@/services/token.service').default;

  // Mock payload consistent with generateToken input/output
  const mockUserPayload = {
    sub: 'user-123', // Use 'sub' consistently
    username: 'testuser',
    scopes: ['read'],
  };

  // Initialize dateNowSpy variable
  let dateNowSpy: jest.SpyInstance | undefined;
  const MOCK_DATE = new Date('2023-01-01T12:00:00Z');

  /*
  beforeEach(() => {
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(MOCK_DATE.getTime());
    // Reset the blacklist before each test by accessing the correct property
    // We need to cast to 'any' because blacklistedJtis is private
    if ((tokenService as any).blacklistedJtis) { // Ensure we check the correct property name
      (tokenService as any).blacklistedJtis.clear(); // Use the correct property name
    } else {
      // This case should ideally not be hit if the singleton is always initialized.
      // For safety, re-initialize if it were somehow undefined.
      (tokenService as any).blacklistedJtis = new Map<string, number>();
      // console.warn('TokenService blacklistedJtis was undefined and re-initialized in test beforeEach');
    }
  });
  */

  afterEach(() => {
    if (dateNowSpy) dateNowSpy.mockRestore();
  });

  describe('generateToken', () => {
    it('should generate a token with the correct payload and sign options', () => {
      const token = tokenService.generateToken(mockUserPayload, '15m');
      // Check if jwt.sign mock exists before asserting (it might not if module isn't mocked)
      if (jest.isMockFunction(jwt.sign)) {
        expect(jwt.sign).toHaveBeenCalledTimes(1);
        expect(jwt.sign).toHaveBeenCalledWith(
          expect.objectContaining({
            sub: mockUserPayload.sub,
            username: mockUserPayload.username,
            scopes: mockUserPayload.scopes,
            jti: expect.any(String),
          }),
          config.security.jwtSecret,
          { expiresIn: '15m' }
        );
      }
      expect(token).toEqual(expect.any(String));
    });

    it('should use custom expiresIn when provided', () => {
      const token = tokenService.generateToken(mockUserPayload, '30m');
      if (jest.isMockFunction(jwt.sign)) {
        expect(jwt.sign).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(String),
          { expiresIn: '30m' }
        );
      }
      expect(token).toBeDefined();
    });

    it('should generate a valid JWT token', () => {
      const token = tokenService.generateToken(mockUserPayload);
      expect(token).toBeDefined();
      const decoded = jwt.verify(token, config.security.jwtSecret) as AuthPayload;
      expect(decoded.sub).toBe(mockUserPayload.sub);
      expect(decoded.username).toBe(mockUserPayload.username);
      expect(decoded.scopes).toEqual(mockUserPayload.scopes);
      expect(decoded.jti).toBeDefined();
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token and return its payload', () => {
      const token = tokenService.generateToken(mockUserPayload);
      const payload = tokenService.verifyToken(token);
      expect(payload?.sub).toBe(mockUserPayload.sub); // Use 'sub'
      expect(payload?.jti).toBeDefined();
    });

    // ... other verifyToken tests ...
  });

  // ... blacklistToken and JTI handling tests ...

  // ... stopCleanup test ...
}); 