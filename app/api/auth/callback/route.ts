import { NextResponse } from 'next/server';
import { createSession } from '../../../../lib/session';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/?error=Salesforce+authentication+was+cancelled', url.origin));

  const loginUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';
  const callbackUrl = `${url.origin}/api/auth/callback`;
  const tokenResponse = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: process.env.SALESFORCE_CLIENT_ID || '', client_secret: process.env.SALESFORCE_CLIENT_SECRET || '', redirect_uri: callbackUrl })
  });

  if (!tokenResponse.ok) return NextResponse.redirect(new URL('/?error=Salesforce+authentication+failed', url.origin));
  const tokens = await tokenResponse.json() as { access_token: string; instance_url: string };
  const response = NextResponse.redirect(new URL('/', url.origin));
  response.cookies.set('sf_session', await createSession({ accessToken: tokens.access_token, instanceUrl: tokens.instance_url }), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 3600, path: '/' });
  return response;
}
