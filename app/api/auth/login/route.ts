import { NextResponse } from 'next/server';
import { createSession } from '../../../../lib/session';

export async function POST(request: Request) {
  const body = await request.json() as { username?: string; password?: string; securityToken?: string; loginUrl?: string };
  const username = body.username?.trim();
  const password = body.password;
  const securityToken = body.securityToken || '';

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
  }

  const loginUrl = (body.loginUrl || 'https://login.salesforce.com').replace(/\/$/, '');
  if (!['https://login.salesforce.com', 'https://test.salesforce.com'].includes(loginUrl)) {
    return NextResponse.json({ error: 'Choose a valid Salesforce production or sandbox login URL.' }, { status: 400 });
  }

  const soapEscape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:partner.soap.sforce.com">
  <soapenv:Body>
    <urn:login>
      <urn:username>${soapEscape(username)}</urn:username>
      <urn:password>${soapEscape(password + securityToken)}</urn:password>
    </urn:login>
  </soapenv:Body>
</soapenv:Envelope>`;
  const tokenResponse = await fetch(`${loginUrl}/services/Soap/u/61.0`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml', SOAPAction: 'login' },
    body: soapBody,
    cache: 'no-store'
  });

  if (!tokenResponse.ok) {
    const responseText = await tokenResponse.text();
    const detail = responseText.match(/<faultstring>(.*?)<\/faultstring>/)?.[1] || 'Salesforce rejected the login. Check your username, password plus security token, and login environment.';
    return NextResponse.json({ error: detail }, { status: 401 });
  }

  const responseText = await tokenResponse.text();
  const accessToken = responseText.match(/<sessionId>(.*?)<\/sessionId>/)?.[1];
  const serverUrl = responseText.match(/<serverUrl>(.*?)<\/serverUrl>/)?.[1];
  const instanceUrl = serverUrl?.match(/https:\/\/[^/]+/)?.[0];
  if (!accessToken || !instanceUrl) {
    return NextResponse.json({ error: 'Salesforce returned an incomplete login response.' }, { status: 502 });
  }

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set('sf_session', await createSession({ accessToken, instanceUrl }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 3600,
    path: '/'
  });
  return response;
}
