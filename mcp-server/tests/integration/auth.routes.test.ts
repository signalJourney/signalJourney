import request from 'supertest';
import { app } from '@/index'; // Import the conditionally started Express app
import tokenServiceInstance from '@/services/token.service'; // Import the actual instance
// import config from '@/config'; // config seems unused in this file now

// Ensure the server is fully initialized before tests run if it's not already.
// This is a bit of a hack; ideally, app would be a promise or an async getter.
// For now, we rely on the fact that index.ts runs startServer().
// If using a test runner that doesn't execute index.ts first, you might need to call startServer() here.

// Mock the tokenService blacklist for isolated tests of auth routes
// This is to avoid interference between logout tests and validate tests
const mockBlacklist = new Set<string>();

jest.mock('@/services/token.service', () => {
  const originalTokenService = jest.requireActual('@/services/token.service').default; // Access the singleton instance
  return {
    __esModule: true,
    default: { // Keep the .default structure if that's how the original is exported and used
      ...originalTokenService,
      generateToken: jest.fn(originalTokenService.generateToken),
      verifyToken: jest.fn((token: string) => { 
        const decoded = originalTokenService.verifyToken(token);
        if (decoded && decoded.jti && mockBlacklist.has(decoded.jti)) {
          return null; 
        }
        return decoded;
      }),
      blacklistToken: jest.fn(async (jti: string, exp: number | undefined) => {
        if (jti && exp && exp > Math.floor(Date.now() / 1000)) {
          mockBlacklist.add(jti);
        }
      }),
      isJtiBlacklisted: jest.fn((jti: string) => mockBlacklist.has(jti)), 
    },
  };
});


describe('/auth routes', () => {
  let validUserToken = '';
  let validUserJti = '';

  beforeAll(async () => {
    // Ensure NODE_ENV is test so the app doesn't try to listen on a port
    process.env.NODE_ENV = 'test';
    // Override JWT secret for predictable tokens if necessary for specific test cases, though not strictly needed here
    // config.security.jwtSecret = 'test-integration-secret';
    
    // Log in a user to get a token for authenticated routes
    // Note: This uses the actual login logic, which in turn uses the mocked tokenService.generateToken
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ username: 'testuser', password: 'password123' });
    
    if (loginRes.body.accessToken) {
      validUserToken = loginRes.body.accessToken;
      // Use the imported instance for direct calls if mock doesn't fully cover or if pre-mock logic needed
      const decoded = tokenServiceInstance.verifyToken(validUserToken); 
      if (decoded && decoded.jti) {
        validUserJti = decoded.jti;
      }
    } else {
      console.error('Failed to log in user for auth tests:', loginRes.body);
      throw new Error('Prerequisite login failed for /auth route tests');
    }
  });

  beforeEach(() => {
    mockBlacklist.clear(); // Clear blacklist before each auth test
    // Reset mocks that track calls, if generateToken was also part of the mock above that needs reset for call counts
    (tokenServiceInstance.generateToken as jest.Mock).mockClear();
    (tokenServiceInstance.verifyToken as jest.Mock).mockClear();
    (tokenServiceInstance.blacklistToken as jest.Mock).mockClear();
  });

  describe('POST /auth/login', () => {
    it('should login a valid user and return an accessToken, tokenType, expiresIn, userId, username, and scopes', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'testuser', password: 'password123' });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.tokenType).toBe('Bearer');
      expect(res.body).toHaveProperty('expiresIn');
      expect(res.body.userId).toBe('user-123');
      expect(res.body.username).toBe('testuser');
      expect(res.body.scopes).toEqual(expect.arrayContaining(['read:resource', 'write:resource']));
    });

    it('should return 401 for invalid credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'wronguser', password: 'wrongpassword' });
      
      expect(res.statusCode).toEqual(401);
      expect(res.body.code).toBe('AUTHENTICATION_FAILED');
    });

    it('should return 400 for missing username', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ password: 'password123' });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details[0].path).toEqual(['username']);
    });
  });

  describe('POST /auth/validate-token', () => {
    it('should return valid:true for a valid token', async () => {
      const res = await request(app)
        .post('/auth/validate-token')
        .send({ token: validUserToken });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.payload.userId).toBe('user-123');
    });

    it('should return valid:false for an invalid token', async () => {
      const res = await request(app)
        .post('/auth/validate-token')
        .send({ token: 'invalid-token-string' });
      
      expect(res.statusCode).toEqual(400); // Or 401 depending on how verifyToken error is mapped
      expect(res.body.code).toBe('TOKEN_VALIDATION_FAILED');
      // expect(res.body.valid).toBe(false); // The McpApplicationError won't have `valid` field
    });

    it('should return valid:false for a blacklisted token', async () => {
        mockBlacklist.clear();
        const loginResponse = await request(app).post('/auth/login').send({ username: 'testuser', password: 'password123' });
        const tokenToBlacklist = loginResponse.body.accessToken;
        const decodedToken = tokenServiceInstance.verifyToken(tokenToBlacklist); // Use instance
        
        expect(decodedToken).not.toBeNull();
        if (!decodedToken || !decodedToken.jti || !decodedToken.exp) throw new Error('Test setup error: could not decode token for blacklisting')

        await tokenServiceInstance.blacklistToken(decodedToken.jti, decodedToken.exp); // Use instance
        expect(mockBlacklist.has(decodedToken.jti)).toBe(true); 

        const res = await request(app)
            .post('/auth/validate-token')
            .send({ token: tokenToBlacklist });

        expect(res.statusCode).toEqual(400);
        expect(res.body.code).toBe('TOKEN_VALIDATION_FAILED'); 
    });
  });

  describe('POST /auth/logout', () => {
    it('should successfully log out a user by blacklisting their token and return 200', async () => {
      expect(mockBlacklist.has(validUserJti)).toBe(false); // Ensure not blacklisted before logout
      
      const res = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${validUserToken}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toBe('Successfully logged out.');
      expect(mockBlacklist.has(validUserJti)).toBe(true); // Check our mock blacklist
      // (tokenService.default.blacklistToken as jest.Mock).toHaveBeenCalledWith(validUserJti, expect.any(Number));

      // Try to validate the token again, it should now fail (as it's blacklisted by our mock)
      const validateRes = await request(app)
        .post('/auth/validate-token')
        .send({ token: validUserToken });
      expect(validateRes.statusCode).toEqual(400); // Or 401
      expect(validateRes.body.code).toBe('TOKEN_VALIDATION_FAILED');
    });

    it('should return 401 if no token is provided for logout', async () => {
      const res = await request(app).post('/auth/logout');
      expect(res.statusCode).toEqual(401);
      expect(res.body.code).toBe('AUTHENTICATION_REQUIRED'); // This comes from requireScope or similar if auth is mandatory for logout
                                                       // If jwtAuthMiddleware just calls next(), then it might be a different error if authInfo isn't checked by the route.
                                                       // Our current logout route *does* check req.authInfo.
    });
  });
}); 