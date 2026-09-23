import { NextResponse } from 'next/server';
import { createSession } from '../../../../lib/session';

export async function POST(request: Request) {
  const body = await request.json() as { username?: string; password?: string; securityToken?: string };
  const username = body.username?.trim();
  const password = body.password;

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
  }

  const loginUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';
  const credentials = new URLSearchParams({
    grant_type: 'password',
    client_id: process.env.SALESFORCE_CLIENT_ID || '',
    client_secret: process.env.SALESFORCE_CLIENT_SECRET || '',
    username,
    password: `${password}${body.securityToken || ''}`
  });
  const tokenResponse = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: credentials,
    cache: 'no-store'
  });

  if (!tokenResponse.ok) {
    return NextResponse.json({ error: 'Salesforce rejected the login. Check your credentials and security token.' }, { status: 401 });
  }

  const tokens = await tokenResponse.json() as { access_token: string; instance_url: string };
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set('sf_session', await createSession({ accessToken: tokens.access_token, instanceUrl: tokens.instance_url }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 3600,
    path: '/'
  });
  return response;
}
