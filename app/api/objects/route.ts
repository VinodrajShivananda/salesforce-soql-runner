import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readSession } from '../../../lib/session';

export async function GET() {
  const session = await readSession((await cookies()).get('sf_session')?.value);
  if (!session) return NextResponse.json({ error: 'Connect Salesforce before loading objects.' }, { status: 401 });

  const salesforceResponse = await fetch(`${session.instanceUrl}/services/data/v61.0/sobjects`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store'
  });
  const data = await salesforceResponse.json();
  if (!salesforceResponse.ok) {
    return NextResponse.json({ error: data[0]?.message || data.message || 'Salesforce rejected the object list request.' }, { status: salesforceResponse.status });
  }

  return NextResponse.json({
    objects: (data.sobjects as Array<{ queryable?: boolean; name: string; label?: string }>)
      .filter(object => object.queryable)
      .map(object => ({
        name: object.name,
        label: object.label || object.name
      }))
  });
}