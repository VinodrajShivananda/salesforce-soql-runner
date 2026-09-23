import { jwtVerify, SignJWT } from 'jose';

const secret = new TextEncoder().encode(process.env.SESSION_SECRET || 'local-development-secret-change-me');

export type Session = { accessToken: string; instanceUrl: string };

export async function createSession(session: Session): Promise<string> {
  return new SignJWT(session).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
}

export async function readSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.accessToken !== 'string' || typeof payload.instanceUrl !== 'string') return null;
    return { accessToken: payload.accessToken, instanceUrl: payload.instanceUrl };
  } catch {
    return null;
  }
}
