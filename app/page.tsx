'use client';

import { useEffect, useState } from 'react';

type RecordValue = Record<string, unknown>;
type QueryResult = { totalSize: number; records: RecordValue[] };

export default function Home() {
  const [query, setQuery] = useState('SELECT Id, Name FROM Account LIMIT 10');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session').then(response => response.json()).then(data => setAuthenticated(data.authenticated));
  }, []);

  async function runQuery() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Query failed.');
      setResult(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Query failed.');
    } finally {
      setLoading(false);
    }
  }

  const fields = result ? [...new Set(result.records.flatMap(record => Object.keys(record)))] : [];

  return (
    <main className="shell">
      <header className="topbar"><div><span className="kicker">SALESFORCE / DATA DESK</span><h1>SOQL Runner</h1></div><a className="connection" href="/api/auth/login">{authenticated ? 'Connected' : 'Connect Salesforce'} <span>↗</span></a></header>
      <section className="workspace">
        <div className="intro"><p className="eyebrow">QUERY CONSOLE</p><h2>Ask your org<br /><em>anything.</em></h2><p className="lede">Run precise SOQL against your connected Salesforce org and inspect the records without leaving your browser.</p></div>
        <div className="editor-panel"><div className="panel-head"><span>SOQL EDITOR</span><span className="status-dot">{authenticated ? 'ORG CONNECTED' : 'AUTH REQUIRED'}</span></div><textarea value={query} onChange={event => setQuery(event.target.value)} spellCheck={false} aria-label="SOQL query" /><div className="editor-foot"><span>REST API · v61.0</span><button onClick={runQuery} disabled={loading || !query.trim()}>{loading ? 'Running...' : 'Run query'} <span>⌘ ↵</span></button></div></div>
        {error && <div className="error">{error}</div>}
        {result && <section className="results"><div className="results-head"><div><p className="eyebrow">RESULTS</p><h3>{result.totalSize} record{result.totalSize === 1 ? '' : 's'}</h3></div><span className="result-mark">LIVE</span></div><div className="table-wrap"><table><thead><tr>{fields.map(field => <th key={field}>{field}</th>)}</tr></thead><tbody>{result.records.map((record, index) => <tr key={index}>{fields.map(field => <td key={field}>{formatValue(record[field])}</td>)}</tr>)}</tbody></table></div></section>}
      </section>
      <footer><span>SOQL RUNNER / VERCEL EDITION</span><span>Credentials stay server-side</span></footer>
    </main>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
