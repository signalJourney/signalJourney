import { randomUUID } from 'crypto';

import jwt from 'jsonwebtoken';

import config from '@/config';
import logger from '@/utils/logger';
import { AuthPayload } from '@/middleware/auth.middleware'; // Assuming AuthPayload is now primarily defined here or in mcp-types

// If AuthPayload is intended to be the canonical definition, ensure it includes jti
// For example, in auth.middleware.ts or mcp-types.ts:
// export interface AuthPayload {
//   userId: string;
//   username: string;
//   scopes: string[];
//   jti: string; // JWT ID
//   iat?: number;
//   exp?: number;
// }

class TokenService {
  // Simple in-memory blacklist for revoked JTIs. For production, use Redis or a database.
  private blacklistedJtis: Map<string, number> = new Map(); // jti -> expiration timestamp (unix seconds)
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanupExpiredBlacklistedJtis(), 60 * 60 * 1000); // Clean up every hour
    logger.info('TokenService initialized with blacklist cleanup interval.');
    setInterval(() => this.pruneBlacklist(), config.security.blacklistPruneInterval); 
  }

  public generateToken(payload: Omit<AuthPayload, 'jti' | 'iat' | 'exp'>, expiresIn?: string): string {
    const jti = randomUUID();
    const tokenPayload: AuthPayload = {
      ...payload,
      jti,
    };
    const effectiveExpiresIn = expiresIn || config.security.jwtExpiresIn;
    logger.debug(`Generating token for sub: ${payload.sub} with jti: ${jti}, expires_in: ${effectiveExpiresIn}`);
    const secret: jwt.Secret = config.security.jwtSecret;
    // Cast effectiveExpiresIn to 'any' as a workaround for potential @types/jsonwebtoken issue
    const options: jwt.SignOptions = { expiresIn: effectiveExpiresIn as any };
    const token = jwt.sign(tokenPayload, secret, options);
    return token;
  }

  public verifyToken(token: string): AuthPayload | null {
    try {
      const decoded = jwt.verify(token, config.security.jwtSecret) as AuthPayload;
      if (!decoded.jti) {
        logger.warn('Token verification failed: Missing JTI.');
        return null;
      }
      if (this.isJtiBlacklisted(decoded.jti)) {
        logger.warn(`Token verification failed: JTI ${decoded.jti} is blacklisted.`);
        return null;
      }
      return decoded;
    } catch (error: any) {
      logger.warn(`Token verification error: ${error.message}`);
      return null;
    }
  }

  public async blacklistToken(jti: string, exp: number | undefined): Promise<void> {
    if (!exp) {
      logger.warn(`Cannot blacklist token with jti: ${jti} - no expiration time (exp) provided.`);
      return; // Cannot blacklist indefinitely without an exp for cleanup
    }
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (exp <= nowInSeconds) {
      logger.debug(`Token with jti: ${jti} is already expired. No need to blacklist.`);
      return;
    }
    this.blacklistedJtis.set(jti, exp);
    logger.info(`Token with jti: ${jti} blacklisted until ${new Date(exp * 1000).toISOString()}`);
  }

  private isJtiBlacklisted(jti: string): boolean {
    const expiration = this.blacklistedJtis.get(jti);
    if (expiration) {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      if (expiration <= nowInSeconds) {
        // Token expired, remove from blacklist
        this.blacklistedJtis.delete(jti);
        logger.debug(`Removed expired jti ${jti} from blacklist.`);
        return false;
      }
      return true; // Still blacklisted and not expired
    }
    return false;
  }

  private cleanupExpiredBlacklistedJtis(): void {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    let cleanedCount = 0;
    for (const [jti, exp] of this.blacklistedJtis.entries()) {
      if (exp <= nowInSeconds) {
        this.blacklistedJtis.delete(jti);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired JTIs from blacklist.`);
    }
  }
  
  public stopCleanup(): void {
    clearInterval(this.cleanupInterval);
    logger.info('TokenService blacklist cleanup interval stopped.');
  }

  private pruneBlacklist(): void {
    // Implementation of pruneBlacklist method
  }
}

// Export a singleton instance
const tokenService = new TokenService();
export default tokenService; 