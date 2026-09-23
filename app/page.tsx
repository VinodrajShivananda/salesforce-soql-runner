'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

type RecordValue = Record<string, unknown>;
type QueryResult = { totalSize: number; records: RecordValue[] };
type SchemaData = { fields?: string[]; fieldTypes?: Record<string, string>; relationships?: Record<string, string[]> };

export default function Home() {
  const [query, setQuery] = useState('SELECT Id, Name FROM Account LIMIT 10');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [loggedInUsername, setLoggedInUsername] = useState('');
  const [instanceUrl, setInstanceUrl] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [loginUrl, setLoginUrl] = useState('https://login.salesforce.com');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [fieldTypes, setFieldTypes] = useState<Record<string, string>>({});
  const [availableObjects, setAvailableObjects] = useState<string[]>([]);
  const [relationships, setRelationships] = useState<Record<string, string[]>>({});
  const [parentFields, setParentFields] = useState<string[]>([]);
  const [parentFieldTypes, setParentFieldTypes] = useState<Record<string, string>>({});
  const [cursorPosition, setCursorPosition] = useState(0);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const queryEditorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/auth/session').then(response => response.json()).then(data => {
      setAuthenticated(data.authenticated);
      setLoggedInUsername(data.username || '');
      setInstanceUrl(data.instanceUrl || '');
    });
  }, []);

  const objectName = query.match(/\bFROM\s+([A-Za-z][A-Za-z0-9_]*)/i)?.[1] || '';
  const textBeforeCursor = query.slice(0, cursorPosition);
  const isSelectingFields = /^\s*SELECT\b[\s\S]*$/i.test(textBeforeCursor) && !/\bFROM\b/i.test(textBeforeCursor);
  const isFilteringFields = /\bWHERE\b[\s\S]*$/i.test(textBeforeCursor) && !/\b(?:ORDER\s+BY|GROUP\s+BY|LIMIT)\b/i.test(textBeforeCursor);
  const isFieldContext = isSelectingFields || isFilteringFields;
  const fieldDelimiter = '(?:^|,|\\bSELECT\\b|\\bWHERE\\b|\\bAND\\b|\\bOR\\b)';
  const relationshipMatch = isFieldContext ? textBeforeCursor.match(new RegExp(`${fieldDelimiter}\\s*((?:[A-Za-z_]\\w*\\s*\\.\\s*)+)([A-Za-z_]\\w*)?\\s*$`, 'i')) : null;
  const relationshipPath = relationshipMatch?.[1].split('.').map(segment => segment.trim()).filter(Boolean) || [];
  const relationshipPrefix = relationshipPath.join('.');
  const directFieldMatch = !relationshipMatch && isFieldContext ? textBeforeCursor.match(new RegExp(`${fieldDelimiter}\\s*([A-Za-z_]\\w*)?\\s*$`, 'i')) : null;
  const objectMatch = !isSelectingFields ? textBeforeCursor.match(/\bFROM\s+([A-Za-z_]\w*)?$/i) : null;
  const objectPartial = objectMatch?.[1] || '';
  const partialField = relationshipMatch?.[2] || directFieldMatch?.[1] || '';
  const fieldsToSuggest = relationshipPath.length ? parentFields : availableFields;
  const fieldSuggestions = (relationshipMatch || directFieldMatch)
    ? fieldsToSuggest.filter(field => field.toLowerCase().startsWith(partialField.toLowerCase())).slice(0, 12)
    : [];
  const objectSuggestions = objectMatch
    ? availableObjects.filter(object => object.toLowerCase().startsWith(objectPartial.toLowerCase())).slice(0, 12)
    : [];
  const suggestions = objectMatch ? objectSuggestions : fieldSuggestions;
  const dateFieldMatch = isFilteringFields
    ? textBeforeCursor.match(/(?:\bWHERE\b|\bAND\b|\bOR\b)\s+([A-Za-z_]\w*(?:\s*\.\s*[A-Za-z_]\w*)*)\s*(?:!=|<=|>=|=|<|>|LIKE)\s*([A-Za-z_]\w*)?$/i)
    : null;
  const dateFieldPath = dateFieldMatch?.[1].split('.').map(segment => segment.trim()) || [];
  const dateFieldName = dateFieldPath.at(-1) || '';
  const dateFieldType = dateFieldMatch
    ? (dateFieldPath.length > 1 ? parentFieldTypes[dateFieldName] : fieldTypes[dateFieldName])?.toLowerCase()
    : '';
  const dateLiterals = ['TODAY', 'YESTERDAY', 'TOMORROW', 'THIS_WEEK', 'LAST_WEEK', 'NEXT_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'NEXT_MONTH', 'THIS_QUARTER', 'LAST_QUARTER', 'NEXT_QUARTER', 'THIS_YEAR', 'LAST_YEAR', 'NEXT_YEAR', 'LAST_N_DAYS:7', 'NEXT_N_DAYS:7', 'LAST_N_MONTHS:1', 'NEXT_N_MONTHS:1'];
  const dateSuggestions = dateFieldMatch && (dateFieldType === 'date' || dateFieldType === 'datetime')
    ? dateLiterals.filter(literal => literal.toLowerCase().startsWith((dateFieldMatch[2] || '').toLowerCase()))
    : [];
  const editorSuggestions = dateSuggestions.length ? dateSuggestions : suggestions;

  useEffect(() => {
    if (!authenticated) {
      setAvailableObjects([]);
      return;
    }
    fetch('/api/objects')
      .then(response => response.ok ? response.json() : null)
      .then(data => setAvailableObjects(data?.objects || []))
      .catch(() => setAvailableObjects([]));
  }, [authenticated]);

  useEffect(() => {
    setActiveSuggestion(0);
  }, [partialField, objectPartial]);

  useEffect(() => {
    if (!authenticated || !objectName) {
      setAvailableFields([]);
      setFieldTypes({});
      setRelationships({});
      setParentFields([]);
      setParentFieldTypes({});
      return;
    }
    fetch(`/api/schema?object=${encodeURIComponent(objectName)}`)
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        setAvailableFields(data?.fields || []);
        setFieldTypes(data?.fieldTypes || {});
        setRelationships(data?.relationships || {});
      })
      .catch(() => {
        setAvailableFields([]);
        setFieldTypes({});
        setRelationships({});
      });
  }, [authenticated, objectName]);

  useEffect(() => {
    setParentFields([]);
    setParentFieldTypes({});
    if (!authenticated || !objectName || !relationshipPath.length) {
      return;
    }

    async function loadRelatedFields() {
      let currentRelationships = relationships;

      for (const relationship of relationshipPath) {
        const nextObject = currentRelationships[relationship]?.[0];
        if (!nextObject) return;
        const response = await fetch(`/api/schema?object=${encodeURIComponent(nextObject)}`);
        if (!response.ok) return;
        const data = await response.json() as SchemaData;
        currentRelationships = data.relationships || {};
        if (relationship === relationshipPath[relationshipPath.length - 1]) {
          setParentFields(data.fields || []);
          setParentFieldTypes(data.fieldTypes || {});
        }
      }
    }

    void loadRelatedFields().catch(() => setParentFields([]));
  }, [authenticated, objectName, relationshipPrefix, relationships]);

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
    if (!editorSuggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestion(index => (index + 1) % editorSuggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestion(index => (index - 1 + editorSuggestions.length) % editorSuggestions.length);
    } else if (event.key === 'Tab' || event.key === 'Enter') {
      event.preventDefault();
      insertSuggestion(editorSuggestions[activeSuggestion]);
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
        body: JSON.stringify({ username, password, loginUrl })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed.');
      setAuthenticated(true);
      setLoggedInUsername(data.username || username);
      const sessionData = await fetch('/api/auth/session').then(response => response.json());
      setInstanceUrl(sessionData.instanceUrl || '');
      setShowLogin(false);
      setPassword('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  const fields = result ? [...new Set(result.records.flatMap(record => Object.keys(record)).filter(field => field !== 'attributes'))] : [];

  return (
    <main className="shell">
      <header className="topbar"><div className="brand"><span className="logo">⚡</span><h1>SOQL Runner</h1></div><div className="connection-area">{authenticated && <span className="user-name">{loggedInUsername}</span>}<button className="connection" onClick={() => setShowLogin(true)}>{authenticated ? 'Connected' : 'Connect Salesforce'} <span>↗</span></button></div></header>
      <section className="workspace">
        <div className="intro"><p className="eyebrow">QUERY CONSOLE</p><h2>Ask your org<br /><em>anything.</em></h2><p className="lede">Run precise SOQL against your connected Salesforce org and inspect the records without leaving your browser.</p></div>
        <div className="editor-panel"><div className="panel-head"><span>SOQL EDITOR</span><span className="status-dot">{authenticated ? 'ORG CONNECTED' : 'AUTH REQUIRED'}</span></div><div className="editor-body"><textarea ref={queryEditorRef} value={query} onChange={event => { setQuery(event.target.value); setCursorPosition(event.target.selectionStart); }} onClick={updateCursor} onKeyUp={updateCursor} onKeyDown={handleEditorKeyDown} spellCheck={false} aria-label="SOQL query" />{editorSuggestions.length > 0 && <div className="field-suggestions" role="listbox">{editorSuggestions.map((suggestion, index) => <button type="button" key={suggestion} className={index === activeSuggestion ? 'active' : ''} onMouseDown={event => event.preventDefault()} onClick={() => insertSuggestion(suggestion)}>{dateSuggestions.length ? suggestion : objectMatch ? suggestion : relationshipPrefix ? `${relationshipPrefix}.${suggestion}` : suggestion}</button>)}</div>}</div><div className="editor-foot"><span>REST API · v61.0</span><button onClick={runQuery} disabled={loading || !query.trim()}>{loading ? 'Running...' : 'Run query'} <span>⌘ ↵</span></button></div></div>
        {error && <div className="error">{error}</div>}
        {result && <section className="results"><div className="results-head"><div><p className="eyebrow">RESULTS</p><h3>{result.totalSize} record{result.totalSize === 1 ? '' : 's'}</h3></div><span className="result-mark">LIVE</span></div><div className="table-wrap"><table><thead><tr>{fields.map(field => <th key={field}>{field}</th>)}</tr></thead><tbody>{result.records.map((record, index) => <tr key={index}>{fields.map(field => <td key={field}>{field === 'Id' && typeof record[field] === 'string' && instanceUrl ? <a href={`${instanceUrl}/lightning/r/${objectName}/${record[field]}/view`} target="_blank" rel="noreferrer">{record[field]}</a> : formatValue(record[field])}</td>)}</tr>)}</tbody></table></div></section>}
      </section>
      {showLogin && <div className="modal-backdrop"><form className="login-panel" onSubmit={login}><button type="button" className="close" onClick={() => setShowLogin(false)} aria-label="Close login">×</button><div className="login-icon">⚡</div><h1>SOQL Runner</h1><p className="subtitle">Connect to any Salesforce org to run SOQL queries</p><p className="login-note">Credentials are sent directly to Salesforce and are not saved by this app.</p><label>Environment<select value={loginUrl} onChange={event => setLoginUrl(event.target.value)}><option value="https://login.salesforce.com">Production / Developer</option><option value="https://test.salesforce.com">Sandbox</option></select></label><label>Username<input type="email" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" required /></label><label>Password + Security Token<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /></label><p className="login-note login-hint">Append your security token to your password (for example: MyPass123TOKEN456).</p><button className="login-submit" type="submit" disabled={loading}>{loading ? 'Connecting...' : 'Connect to Salesforce'}</button></form></div>}
      <footer><span>SOQL RUNNER / VERCEL EDITION</span><span>Credentials stay server-side</span></footer>
    </main>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
