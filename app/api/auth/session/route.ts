import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';

export async function GET() {
  const token = (await cookies()).get('sf_session')?.value;
  const session = await readSession(token);
  return NextResponse.json({ authenticated: Boolean(session), username: session?.username || null });
}
