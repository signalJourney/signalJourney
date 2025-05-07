import tokenService from '@/services/token.service';
import jwt from 'jsonwebtoken';
import config from '@/config'; // Added config import
import { AuthPayload } from '@/middleware/auth.middleware';

// Mock the dependencies
jest.mock('jsonwebtoken');
jest.mock('@/config', () => ({
  security: {
    jwtSecret: 'test-secret',
    jwtExpiresIn: '15m',
  },
}));

// Mock the logger to prevent console output during tests
// jest.mock('@/utils/logger', () => ({
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
//   debug: jest.fn(),
// }));

// Helper to advance Jest timers
const advanceTimersByTime = (timeToAdvance: number) => {
  jest.advanceTimersByTime(timeToAdvance);
};

describe('TokenService', () => {
  let mockUserPayload: Omit<AuthPayload, 'jti' | 'iat' | 'exp'>;

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    jest.clearAllMocks();
    tokenService_clearBlacklist(); // Custom function to clear internal blacklist for fresh test state
    jest.useFakeTimers(); // Use fake timers for testing expirations
    mockUserPayload = {
      sub: 'user-123',
      username: 'testuser',
      scopes: ['read'],
    };
    // Clear blacklist manually if needed for tests, or add a dedicated test helper method to the service
    (tokenService as any).blacklist.clear(); // Example: Accessing private map for testing
  });

  afterEach(() => {
    jest.useRealTimers(); // Restore real timers
    jest.restoreAllMocks();
  });
  
  // Access the internal blacklist for clearing (this is a bit of a hack for testing)
  // In a real scenario, you might expose a test-only method or re-instantiate the service.
  const tokenService_clearBlacklist = () => {
    (tokenService as any).blacklistedJtis.clear();
  };

  describe('generateToken', () => {
    it('should generate a token with the correct payload and sign options', () => {
      const mockToken = 'mockGeneratedToken';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const token = tokenService.generateToken(mockUserPayload);

      expect(jwt.sign).toHaveBeenCalledTimes(1);
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserPayload.sub,
          username: mockUserPayload.username,
          scopes: mockUserPayload.scopes,
          jti: expect.any(String),
        }),
        'test-secret',
        { expiresIn: '15m' }
      );
      expect(token).toBe(mockToken);
    });

    it('should use custom expiresIn when provided', () => {
      tokenService.generateToken(mockUserPayload, '30m');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.anything(), // Payload already checked
        'test-secret',
        { expiresIn: '30m' }
      );
    });

    it('should generate a valid JWT token', () => {
      const token = tokenService.generateToken(mockUserPayload);
      expect(token).toBeDefined();
      const decoded = jwt.verify(token, config.security.jwtSecret) as AuthPayload;
      expect(decoded.sub).toBe(mockUserPayload.sub);
      expect(decoded.username).toBe(mockUserPayload.username);
      expect(decoded.scopes).toEqual(mockUserPayload.scopes);
      expect(decoded.jti).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });
  });

  describe('verifyToken', () => {
    const mockDecodedPayload: AuthPayload = {
      ...mockUserPayload,
      jti: 'some-jti',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900, // Expires in 15 mins
    };

    it('should return the decoded payload for a valid token', () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockDecodedPayload);
      const payload = tokenService.verifyToken('valid-token');
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect(payload).toEqual(mockDecodedPayload);
    });

    it('should return null if token verification fails (e.g., invalid signature)', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid signature');
      });
      const payload = tokenService.verifyToken('invalid-signature-token');
      expect(payload).toBeNull();
    });

    it('should return null if token has no JTI', () => {
      const payloadWithoutJti = { ...mockDecodedPayload, jti: undefined as any };
      (jwt.verify as jest.Mock).mockReturnValue(payloadWithoutJti);
      const payload = tokenService.verifyToken('token-no-jti');
      expect(payload).toBeNull();
    });

    it('should return null if JTI is blacklisted', () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockDecodedPayload);
      tokenService.blacklistToken(mockDecodedPayload.jti, mockDecodedPayload.exp! );
      const payload = tokenService.verifyToken('blacklisted-token');
      expect(payload).toBeNull();
    });

    it('should verify a valid token and return its payload', () => {
      const token = tokenService.generateToken(mockUserPayload);
      const payload = tokenService.verifyToken(token);
      expect(payload).toBeDefined();
      expect(payload?.sub).toBe(mockUserPayload.sub);
      expect(payload?.jti).toBeDefined();
    });
  });

  describe('blacklistToken and JTI handling', () => {
    const jti = 'test-jti-for-blacklist';
    const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

    it('should add a JTI to the blacklist with its expiration time', () => {
      tokenService.blacklistToken(jti, futureExp);
      expect((tokenService as any).blacklistedJtis.get(jti)).toBe(futureExp);
    });

    it('should not blacklist an already expired token', () => {
      tokenService.blacklistToken(jti, pastExp);
      expect((tokenService as any).blacklistedJtis.has(jti)).toBe(false);
    });

    it('should not blacklist a token if no expiration (exp) is provided', () => {
      tokenService.blacklistToken(jti, undefined);
      expect((tokenService as any).blacklistedJtis.has(jti)).toBe(false);
    });
    
    it('isJtiBlacklisted should return true for a non-expired blacklisted JTI', () => {
      tokenService.blacklistToken(jti, futureExp);
      // Directly call the private method for testing (requires type assertion)
      const isBlacklisted = (tokenService as any).isJtiBlacklisted(jti);
      expect(isBlacklisted).toBe(true);
    });

    it('isJtiBlacklisted should return false for a non-blacklisted JTI', () => {
      const isBlacklisted = (tokenService as any).isJtiBlacklisted('non-existent-jti');
      expect(isBlacklisted).toBe(false);
    });

    it('isJtiBlacklisted should return false and remove an expired JTI from blacklist', () => {
      // Blacklist with an expiration time that is in the past relative to when isJtiBlacklisted is called
      const justPastExp = Math.floor(Date.now() / 1000) + 1; // Expires in 1 second
      tokenService.blacklistToken(jti, justPastExp);
      expect((tokenService as any).blacklistedJtis.has(jti)).toBe(true);
      
      advanceTimersByTime(2000); // Advance time by 2 seconds, so token is expired

      const isBlacklisted = (tokenService as any).isJtiBlacklisted(jti);
      expect(isBlacklisted).toBe(false);
      expect((tokenService as any).blacklistedJtis.has(jti)).toBe(false); // Should be removed
    });
    
    it('cleanupExpiredBlacklistedJtis should remove expired JTIs', () => {
      const jti1 = 'jti1';
      const jti2 = 'jti2';
      const futureExpShort = Math.floor(Date.now() / 1000) + 5;
      const futureExpLong = Math.floor(Date.now() / 1000) + 3600;
      
      tokenService.blacklistToken(jti1, futureExpShort); 
      tokenService.blacklistToken(jti2, futureExpLong); 
      
      expect((tokenService as any).blacklistedJtis.size).toBe(2);
      
      advanceTimersByTime(10000); // Advance time by 10 seconds, jti1 should be expired
      
      (tokenService as any).cleanupExpiredBlacklistedJtis();
      
      expect((tokenService as any).blacklistedJtis.has(jti1)).toBe(false);
      expect((tokenService as any).blacklistedJtis.has(jti2)).toBe(true);
      expect((tokenService as any).blacklistedJtis.size).toBe(1);
    });
  });
  
  describe('stopCleanup', () => {
    it('should clear the cleanup interval', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      tokenService.stopCleanup();
      expect(clearIntervalSpy).toHaveBeenCalledWith((tokenService as any).cleanupInterval);
      clearIntervalSpy.mockRestore();
    });
  });
}); 