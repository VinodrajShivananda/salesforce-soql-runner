import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readSession } from '../../../lib/session';

export async function POST(request: Request) {
  const session = await readSession((await cookies()).get('sf_session')?.value);
  if (!session) return NextResponse.json({ error: 'Connect Salesforce before running a query.' }, { status: 401 });

  const body = await request.json() as { query?: string };
  const query = body.query?.trim();
  if (!query) return NextResponse.json({ error: 'A SOQL query is required.' }, { status: 400 });

  const salesforceResponse = await fetch(`${session.instanceUrl}/services/data/v61.0/query?q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: 'no-store' });
  const data = await salesforceResponse.json();
  if (!salesforceResponse.ok) return NextResponse.json({ error: data[0]?.message || data.message || 'Salesforce rejected the query.' }, { status: salesforceResponse.status });
  return NextResponse.json(data);
}
