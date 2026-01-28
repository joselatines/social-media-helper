import { prisma } from './lib/prisma';


/**
 * Save a new token
 */
async function saveToken(
  token: string,
  email: string,
  allowedRequests: number,
  expiresAt: string
): Promise<void> {
  try {
    await prisma.token.create({
      data: {
        token,
        allowed_requests: allowedRequests,
        expires_at: new Date(expiresAt),
        user: {
          connectOrCreate: {
            where: { email },
            create: { email }
          }
        }
      },
    });
  } catch (error) {
    console.error("[DB] Error saving token:", error);
    throw error;
  }
}

/**
 * Get token information
 */
async function getToken(token: string) {
  try {
    const tokenData = await prisma.token.findUnique({
      where: { token },
      include: {
        user: true,
      },
    });

    if (!tokenData) return null;

    // Basic expiration check
    if (tokenData.expires_at < new Date()) {
      return null;
    }

    return {
      ...tokenData,
      email: tokenData.user.email,
    };
  } catch (error) {
    console.error("[DB] Error getting token:", error);
    return null;
  }
}

/**
 * Increment request usage for a token
 */
async function incrementUsage(token: string): Promise<void> {
  try {
    await prisma.token.update({
      where: { token },
      data: {
        allowed_requests: {
          decrement: 1,
        },
      },
    });
  } catch (error) {
    console.error("[DB] Error incrementing usage:", error);
    throw error;
  }
}

/**
 * Cleanup expired tokens
 */
async function cleanupExpired(): Promise<void> {
  try {
    const now = new Date();
    await prisma.token.deleteMany({
      where: {
        expires_at: {
          lt: now,
        },
      },
    });
  } catch (error) {
    console.error("[DB] Error cleaning up expired tokens:", error);
    throw error;
  }
}

/**
 * Get all tokens
 */
async function getAllTokens() {
  try {
    const tokens = await prisma.token.findMany({
      include: {
        user: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return tokens.map(t => ({
      ...t,
      email: t.user.email,
    }));
  } catch (error) {
    console.error("[DB] Error getting all tokens:", error);
    return [];
  }
}

const db = {
  saveToken,
  getToken,
  getAllTokens,
  incrementUsage,
  cleanupExpired,
};

export default db;