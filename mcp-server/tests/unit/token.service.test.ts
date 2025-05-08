import tokenService from '@/services/token.service';
import jwt from 'jsonwebtoken';
import config from '@/config';
import { AuthPayload } from '@/middleware/auth.middleware';

// Mock config and jwt
jest.mock('@/config', () => ({
  security: {
    jwtSecret: 'test-secret',
    jwtExpiresIn: '1h',
    blacklistPruneInterval: 300000,
  }
}));

jest.mock('@/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('TokenService', () => {
  // Sample payloads and tokens for tests
  const testPayload = {
    sub: 'user-123',
    username: 'testuser',
    scopes: ['read:resources', 'write:resources']
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Stop the interval that would continue after tests complete
    tokenService.stopCleanup();
  });

  describe('generateToken', () => {
    it('should generate a JWT with the correct payload', () => {
      const token = tokenService.generateToken(testPayload);
      expect(token).toBeTruthy();
      
      // Verify token structure
      const decoded = jwt.verify(token, config.security.jwtSecret) as AuthPayload;
      expect(decoded.sub).toBe(testPayload.sub);
      expect(decoded.username).toBe(testPayload.username);
      expect(decoded.scopes).toEqual(testPayload.scopes);
      expect(decoded.jti).toBeTruthy(); // Should have a JWT ID
      expect(decoded.iat).toBeTruthy(); // Should have an issued at timestamp
      expect(decoded.exp).toBeTruthy(); // Should have an expiration timestamp
    });

    it('should respect custom expiration time', () => {
      const customExpiry = '5m'; // 5 minutes
      const token = tokenService.generateToken(testPayload, customExpiry);
      
      const standardToken = tokenService.generateToken(testPayload); // Default 1h
      
      const decodedCustom = jwt.verify(token, config.security.jwtSecret) as AuthPayload;
      const decodedStandard = jwt.verify(standardToken, config.security.jwtSecret) as AuthPayload;
      
      // Custom token should expire before standard token
      expect(decodedCustom.exp).toBeLessThan(decodedStandard.exp!);
    });
  });

  describe('verifyToken', () => {
    it('should return payload for valid token', () => {
      const token = tokenService.generateToken(testPayload);
      const decoded = tokenService.verifyToken(token);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.sub).toBe(testPayload.sub);
      expect(decoded?.username).toBe(testPayload.username);
    });

    it('should return null for invalid token', () => {
      const invalidToken = 'invalid.token.string';
      const result = tokenService.verifyToken(invalidToken);
      expect(result).toBeNull();
    });

    it('should return null for expired token', () => {
      // Create an expired token by manipulating the payload directly
      const expiredToken = jwt.sign(
        { ...testPayload, jti: 'test-jti', iat: Math.floor(Date.now() / 1000) - 3600, exp: Math.floor(Date.now() / 1000) - 1800 },
        config.security.jwtSecret
      );
      
      const result = tokenService.verifyToken(expiredToken);
      expect(result).toBeNull();
    });
  });

  describe('blacklistToken', () => {
    it('should blacklist a token', async () => {
      const token = tokenService.generateToken(testPayload);
      const decoded = jwt.verify(token, config.security.jwtSecret) as AuthPayload;
      
      await tokenService.blacklistToken(decoded.jti, decoded.exp);
      
      // Now verify fails due to blacklisting
      const result = tokenService.verifyToken(token);
      expect(result).toBeNull();
    });

    it('should not blacklist a token without expiration', async () => {
      const jti = 'test-jti-no-exp';
      await tokenService.blacklistToken(jti, undefined);
      
      // Create a token with this JTI (mock implementation)
      const token = jwt.sign(
        { ...testPayload, jti },
        config.security.jwtSecret
      );
      
      // Should still verify since blacklisting requires an expiration
      const result = tokenService.verifyToken(token);
      expect(result).not.toBeNull();
    });
  });
}); 