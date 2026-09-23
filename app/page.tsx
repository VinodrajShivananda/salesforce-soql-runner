'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

type RecordValue = Record<string, unknown>;
type QueryResult = { totalSize: number; records: RecordValue[] };

export default function Home() {
  const [query, setQuery] = useState('SELECT Id, Name FROM Account LIMIT 10');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [securityToken, setSecurityToken] = useState('');
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const queryEditorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/auth/session').then(response => response.json()).then(data => setAuthenticated(data.authenticated));
  }, []);

  const objectName = query.match(/\bFROM\s+([A-Za-z][A-Za-z0-9_]*)/i)?.[1] || '';
  const textBeforeCursor = query.slice(0, cursorPosition);
  const isSelectingFields = /^\s*SELECT\b[\s\S]*$/i.test(textBeforeCursor) && !/\bFROM\b/i.test(textBeforeCursor);
  const partialField = isSelectingFields ? textBeforeCursor.match(/(?:^|,)\s*([A-Za-z_]\w*)$/)?.[1] || '' : '';
  const suggestions = partialField
    ? availableFields.filter(field => field.toLowerCase().startsWith(partialField.toLowerCase())).slice(0, 12)
    : [];

  useEffect(() => {
    setActiveSuggestion(0);
  }, [partialField]);

  useEffect(() => {
    if (!authenticated || !objectName) {
      setAvailableFields([]);
      return;
    }
    fetch(`/api/schema?object=${encodeURIComponent(objectName)}`)
      .then(response => response.ok ? response.json() : null)
      .then(data => setAvailableFields(data?.fields || []))
      .catch(() => setAvailableFields([]));
  }, [authenticated, objectName]);

  function updateCursor() {
    setCursorPosition(queryEditorRef.current?.selectionStart || 0);
  }

  function insertSuggestion(field: string) {
    const editor = queryEditorRef.current;
    if (!editor) return;
    const beforeCursor = query.slice(0, cursorPosition);
    const tokenStart = beforeCursor.search(/[A-Za-z_]\w*$/);
    const start = tokenStart === -1 ? cursorPosition : tokenStart;
    const nextQuery = `${query.slice(0, start)}${field}${query.slice(cursorPosition)}`;
    const nextCursor = start + field.length;
    setQuery(nextQuery);
    setCursorPosition(nextCursor);
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!suggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestion(index => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestion(index => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Tab' || event.key === 'Enter') {
      event.preventDefault();
      insertSuggestion(suggestions[activeSuggestion]);
    }
  }

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

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, securityToken })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed.');
      setAuthenticated(true);
      setShowLogin(false);
      setPassword('');
      setSecurityToken('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  const fields = result ? [...new Set(result.records.flatMap(record => Object.keys(record)))] : [];

  return (
    <main className="shell">
      <header className="topbar"><div><span className="kicker">SALESFORCE / DATA DESK</span><h1>SOQL Runner</h1></div><button className="connection" onClick={() => setShowLogin(true)}>{authenticated ? 'Connected' : 'Connect Salesforce'} <span>↗</span></button></header>
      <section className="workspace">
        <div className="intro"><p className="eyebrow">QUERY CONSOLE</p><h2>Ask your org<br /><em>anything.</em></h2><p className="lede">Run precise SOQL against your connected Salesforce org and inspect the records without leaving your browser.</p></div>
        <div className="editor-panel"><div className="panel-head"><span>SOQL EDITOR</span><span className="status-dot">{authenticated ? 'ORG CONNECTED' : 'AUTH REQUIRED'}</span></div><div className="editor-body"><textarea ref={queryEditorRef} value={query} onChange={event => { setQuery(event.target.value); setCursorPosition(event.target.selectionStart); }} onClick={updateCursor} onKeyUp={updateCursor} onKeyDown={handleEditorKeyDown} spellCheck={false} aria-label="SOQL query" />{suggestions.length > 0 && <div className="field-suggestions" role="listbox">{suggestions.map((field, index) => <button type="button" key={field} className={index === activeSuggestion ? 'active' : ''} onMouseDown={event => event.preventDefault()} onClick={() => insertSuggestion(field)}>{field}</button>)}</div>}</div><div className="editor-foot"><span>REST API · v61.0</span><button onClick={runQuery} disabled={loading || !query.trim()}>{loading ? 'Running...' : 'Run query'} <span>⌘ ↵</span></button></div></div>
        {error && <div className="error">{error}</div>}
        {result && <section className="results"><div className="results-head"><div><p className="eyebrow">RESULTS</p><h3>{result.totalSize} record{result.totalSize === 1 ? '' : 's'}</h3></div><span className="result-mark">LIVE</span></div><div className="table-wrap"><table><thead><tr>{fields.map(field => <th key={field}>{field}</th>)}</tr></thead><tbody>{result.records.map((record, index) => <tr key={index}>{fields.map(field => <td key={field}>{formatValue(record[field])}</td>)}</tr>)}</tbody></table></div></section>}
      </section>
      {showLogin && <div className="modal-backdrop"><form className="login-panel" onSubmit={login}><div className="panel-head"><span>CONNECT SALESFORCE</span><button type="button" className="close" onClick={() => setShowLogin(false)} aria-label="Close login">×</button></div><p className="login-note">Credentials are sent directly to Salesforce and are not saved by this app.</p><label>Username<input type="email" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" required /></label><label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /></label><label>Security token <span>(if required)</span><input type="password" value={securityToken} onChange={event => setSecurityToken(event.target.value)} autoComplete="off" /></label><button className="login-submit" type="submit" disabled={loading}>{loading ? 'Connecting...' : 'Connect securely'}</button></form></div>}
      <footer><span>SOQL RUNNER / VERCEL EDITION</span><span>Credentials stay server-side</span></footer>
    </main>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
