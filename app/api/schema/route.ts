import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readSession } from '../../../lib/session';

export async function GET(request: Request) {
  const session = await readSession((await cookies()).get('sf_session')?.value);
  if (!session) return NextResponse.json({ error: 'Connect Salesforce before loading fields.' }, { status: 401 });

  const objectName = new URL(request.url).searchParams.get('object')?.trim();
  if (!objectName || !/^[A-Za-z][A-Za-z0-9_]*$/.test(objectName)) {
    return NextResponse.json({ error: 'A valid Salesforce object is required.' }, { status: 400 });
  }

  const salesforceResponse = await fetch(`${session.instanceUrl}/services/data/v61.0/sobjects/${encodeURIComponent(objectName)}/describe`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store'
  });
  const data = await salesforceResponse.json();
  if (!salesforceResponse.ok) {
    return NextResponse.json({ error: data[0]?.message || data.message || 'Salesforce rejected the object description.' }, { status: salesforceResponse.status });
  }

  const fields = data.fields as Array<{ name: string; type?: string; relationshipName?: string; referenceTo?: string[] }>;
  const relationships = Object.fromEntries(
    fields
      .filter(field => field.relationshipName && field.referenceTo?.length)
      .map(field => [field.relationshipName, field.referenceTo])
  );

  return NextResponse.json({
    fields: fields.map(field => field.name),
    fieldTypes: Object.fromEntries(fields.map(field => [field.name, field.type || ''])),
    relationships
  });
}