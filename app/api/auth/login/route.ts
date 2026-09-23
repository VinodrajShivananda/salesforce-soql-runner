import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const loginUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';
  const callbackUrl = `${url.origin}/api/auth/callback`;
  const authUrl = new URL('/services/oauth2/authorize', loginUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', process.env.SALESFORCE_CLIENT_ID || '');
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('scope', 'api refresh_token');
  return NextResponse.redirect(authUrl);
}
