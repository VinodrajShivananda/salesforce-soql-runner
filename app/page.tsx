'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { clearSavedQueries, loadSavedQueries, removeQueryFromCookie, saveQueryToCookie } from '../lib/savedQueries';

type RecordValue = Record<string, unknown>;
type QueryResult = { totalSize: number; records: RecordValue[] };
type SchemaData = {
  fields?: string[];
  fieldLabels?: Record<string, string>;
  fieldTypes?: Record<string, string>;
  relationships?: Record<string, string[]>;
};
type SObjectInfo = { name: string; label: string };

type SuggestionItem = {
  id: string;
  type: 'object' | 'field' | 'date';
  display: string;
  insertValue: string;
  secondary?: string;
};

export default function Home() {
  const [query, setQuery] = useState('SELECT Id, Name FROM Account LIMIT 10');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [instanceUrl, setInstanceUrl] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [loginUrl, setLoginUrl] = useState('https://login.salesforce.com');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({});
  const [fieldTypes, setFieldTypes] = useState<Record<string, string>>({});
  const [availableObjects, setAvailableObjects] = useState<SObjectInfo[]>([]);
  const [relationships, setRelationships] = useState<Record<string, string[]>>({});
  const [parentFields, setParentFields] = useState<string[]>([]);
  const [parentFieldLabels, setParentFieldLabels] = useState<Record<string, string>>({});
  const [parentFieldTypes, setParentFieldTypes] = useState<Record<string, string>>({});
  const [cursorPosition, setCursorPosition] = useState(0);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [savedQueries, setSavedQueries] = useState<string[]>([]);
  const queryEditorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSavedQueries(loadSavedQueries());
    fetch('/api/auth/session').then(response => response.json()).then(data => {
      setAuthenticated(data.authenticated);
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
  
  // Object context match after FROM keyword
  const objectMatch = !isSelectingFields ? textBeforeCursor.match(/\bFROM\s+([A-Za-z0-9_ ]*)$/i) : null;
  const objectPartial = objectMatch?.[1]?.trim() || '';
  const partialField = relationshipMatch?.[2] || directFieldMatch?.[1] || '';
  
  const fieldsToSuggest = relationshipPath.length ? parentFields : availableFields;
  const currentLabels = relationshipPath.length ? parentFieldLabels : fieldLabels;
  const lowerPartialField = partialField.toLowerCase();

  // Search field suggestions matching any part of field name or label
  const fieldSuggestions: SuggestionItem[] = (relationshipMatch || directFieldMatch)
    ? fieldsToSuggest
        .filter(field => {
          if (!lowerPartialField) return true;
          const nameMatches = field.toLowerCase().includes(lowerPartialField);
          const label = currentLabels[field];
          const labelMatches = label ? label.toLowerCase().includes(lowerPartialField) : false;
          return nameMatches || labelMatches;
        })
        .sort((a, b) => {
          if (!lowerPartialField) return a.localeCompare(b);
          const aStarts = a.toLowerCase().startsWith(lowerPartialField);
          const bStarts = b.toLowerCase().startsWith(lowerPartialField);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          const aIncludes = a.toLowerCase().includes(lowerPartialField);
          const bIncludes = b.toLowerCase().includes(lowerPartialField);
          if (aIncludes && !bIncludes) return -1;
          if (!aIncludes && bIncludes) return 1;
          return a.localeCompare(b);
        })
        .slice(0, 15)
        .map(field => {
          const fullField = relationshipPrefix ? `${relationshipPrefix}.${field}` : field;
          const label = currentLabels[field];
          return {
            id: fullField,
            type: 'field',
            display: fullField,
            secondary: label && label.toLowerCase() !== field.toLowerCase() ? label : undefined,
            insertValue: field
          };
        })
    : [];

  // Search object suggestions based on label (and name)
  const lowerObjectPartial = objectPartial.toLowerCase();
  const objectSuggestions: SuggestionItem[] = objectMatch
    ? availableObjects
        .filter(obj => {
          if (!lowerObjectPartial) return true;
          return obj.label.toLowerCase().includes(lowerObjectPartial) || obj.name.toLowerCase().includes(lowerObjectPartial);
        })
        .sort((a, b) => {
          if (!lowerObjectPartial) return a.label.localeCompare(b.label);
          const aLabelStarts = a.label.toLowerCase().startsWith(lowerObjectPartial);
          const bLabelStarts = b.label.toLowerCase().startsWith(lowerObjectPartial);
          if (aLabelStarts && !bLabelStarts) return -1;
          if (!aLabelStarts && bLabelStarts) return 1;
          const aNameStarts = a.name.toLowerCase().startsWith(lowerObjectPartial);
          const bNameStarts = b.name.toLowerCase().startsWith(lowerObjectPartial);
          if (aNameStarts && !bNameStarts) return -1;
          if (!aNameStarts && bNameStarts) return 1;
          return a.label.localeCompare(b.label);
        })
        .slice(0, 15)
        .map(obj => ({
          id: obj.name,
          type: 'object',
          display: obj.label,
          secondary: obj.name !== obj.label ? obj.name : undefined,
          insertValue: obj.name
        }))
    : [];

  const dateFieldMatch = isFilteringFields
    ? textBeforeCursor.match(/(?:\bWHERE\b|\bAND\b|\bOR\b)\s+([A-Za-z_]\w*(?:\s*\.\s*[A-Za-z_]\w*)*)\s*(?:!=|<=|>=|=|<|>|LIKE)\s*([A-Za-z_]\w*)?$/i)
    : null;
  const dateFieldPath = dateFieldMatch?.[1].split('.').map(segment => segment.trim()) || [];
  const dateFieldName = dateFieldPath.at(-1) || '';
  const dateFieldType = dateFieldMatch
    ? (dateFieldPath.length > 1 ? parentFieldTypes[dateFieldName] : fieldTypes[dateFieldName])?.toLowerCase()
    : '';
  const dateLiterals = ['TODAY', 'YESTERDAY', 'TOMORROW', 'THIS_WEEK', 'LAST_WEEK', 'NEXT_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'NEXT_MONTH', 'THIS_QUARTER', 'LAST_QUARTER', 'NEXT_QUARTER', 'THIS_YEAR', 'LAST_YEAR', 'NEXT_YEAR', 'LAST_N_DAYS:7', 'NEXT_N_DAYS:7', 'LAST_N_MONTHS:1', 'NEXT_N_MONTHS:1'];
  const dateSuggestions: SuggestionItem[] = dateFieldMatch && (dateFieldType === 'date' || dateFieldType === 'datetime')
    ? dateLiterals
        .filter(literal => literal.toLowerCase().startsWith((dateFieldMatch[2] || '').toLowerCase()))
        .map(literal => ({
          id: literal,
          type: 'date',
          display: literal,
          insertValue: literal
        }))
    : [];

  const editorSuggestions: SuggestionItem[] = dateSuggestions.length ? dateSuggestions : (objectMatch ? objectSuggestions : fieldSuggestions);

  useEffect(() => {
    if (!authenticated) {
      setAvailableObjects([]);
      return;
    }
    fetch('/api/objects')
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        const rawObjects = data?.objects || [];
        const formatted: SObjectInfo[] = rawObjects.map((item: string | { name: string; label?: string }) => {
          if (typeof item === 'string') return { name: item, label: item };
          return { name: item.name, label: item.label || item.name };
        });
        setAvailableObjects(formatted);
      })
      .catch(() => setAvailableObjects([]));
  }, [authenticated]);

  useEffect(() => {
    setActiveSuggestion(0);
  }, [partialField, objectPartial]);

  useEffect(() => {
    if (!authenticated || !objectName) {
      setAvailableFields([]);
      setFieldLabels({});
      setFieldTypes({});
      setRelationships({});
      setParentFields([]);
      setParentFieldLabels({});
      setParentFieldTypes({});
      return;
    }
    fetch(`/api/schema?object=${encodeURIComponent(objectName)}`)
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        setAvailableFields(data?.fields || []);
        setFieldLabels(data?.fieldLabels || {});
        setFieldTypes(data?.fieldTypes || {});
        setRelationships(data?.relationships || {});
      })
      .catch(() => {
        setAvailableFields([]);
        setFieldLabels({});
        setFieldTypes({});
        setRelationships({});
      });
  }, [authenticated, objectName]);

  useEffect(() => {
    setParentFields([]);
    setParentFieldLabels({});
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
          setParentFieldLabels(data.fieldLabels || {});
          setParentFieldTypes(data.fieldTypes || {});
        }
      }
    }

    void loadRelatedFields().catch(() => {
      setParentFields([]);
      setParentFieldLabels({});
      setParentFieldTypes({});
    });
  }, [authenticated, objectName, relationshipPrefix, relationships]);

  function updateCursor() {
    setCursorPosition(queryEditorRef.current?.selectionStart || 0);
  }

  function insertSuggestion(suggestion: SuggestionItem) {
    const editor = queryEditorRef.current;
    if (!editor) return;
    const beforeCursor = query.slice(0, cursorPosition);

    if (suggestion.type === 'object') {
      const fromMatch = beforeCursor.match(/^(.*?\bFROM\s+)[A-Za-z0-9_ ]*$/i);
      const start = fromMatch ? fromMatch[1].length : cursorPosition;
      const afterCursor = query.slice(cursorPosition).trimStart();
      const nextQuery = `${query.slice(0, start)}${suggestion.insertValue} ${afterCursor}`;
      const nextCursor = start + suggestion.insertValue.length + 1;
      setQuery(nextQuery);
      setCursorPosition(nextCursor);
      requestAnimationFrame(() => {
        editor.focus();
        editor.setSelectionRange(nextCursor, nextCursor);
      });
      return;
    }

    const tokenStart = beforeCursor.search(/[A-Za-z_0-9:]*$/);
    const start = tokenStart === -1 ? cursorPosition : tokenStart;
    const nextQuery = `${query.slice(0, start)}${suggestion.insertValue}${query.slice(cursorPosition)}`;
    const nextCursor = start + suggestion.insertValue.length;
    setQuery(nextQuery);
    setCursorPosition(nextCursor);
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      if (!loading && query.trim()) {
        void executeQuery(query);
      }
      return;
    }
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

  function handleSaveQuery() {
    if (!query.trim()) return;
    const nextSaved = saveQueryToCookie(query, savedQueries);
    setSavedQueries(nextSaved);
  }

  function handleSelectSavedQuery(selectedQuery: string) {
    setQuery(selectedQuery);
    setCursorPosition(selectedQuery.length);
    requestAnimationFrame(() => {
      queryEditorRef.current?.focus();
    });
  }

  function handleDeleteSavedQuery(event: MouseEvent<HTMLButtonElement>, targetQuery: string) {
    event.stopPropagation();
    const nextSaved = removeQueryFromCookie(targetQuery, savedQueries);
    setSavedQueries(nextSaved);
  }

  function handleClearSavedQueries() {
    const nextSaved = clearSavedQueries();
    setSavedQueries(nextSaved);
  }

  async function executeQuery(queryString: string) {
    const trimmedQuery = queryString.trim();
    if (!trimmedQuery) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmedQuery })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Query failed.');
      setResult(data);
      const nextSaved = saveQueryToCookie(trimmedQuery, savedQueries);
      setSavedQueries(nextSaved);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Query failed.');
    } finally {
      setLoading(false);
    }
  }

  async function runQuery() {
    await executeQuery(query);
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

  async function disconnect() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthenticated(false);
    setInstanceUrl('');
    setResult(null);
  }

  const fields = result ? getSelectedFields(query, result.records) : [];

  return (
    <main className="shell">
      <header className="topbar"><div className="brand"><span className="logo">⚡</span><h1>SOQL Runner</h1></div><div className="connection-area">{authenticated ? <><span className="org-badge">{getOrgHost(instanceUrl)}</span><button className="disconnect" onClick={disconnect}>Disconnect</button></> : <button className="connection" onClick={() => setShowLogin(true)}>Connect Salesforce <span>↗</span></button>}</div></header>
      <section className="workspace">
        <div className="editor-panel">
          <div className="panel-head">
            <span>SOQL EDITOR</span>
            <span className="status-dot">{authenticated ? 'ORG CONNECTED' : 'AUTH REQUIRED'}</span>
          </div>
          <div className="editor-body">
            <textarea
              ref={queryEditorRef}
              value={query}
              onChange={event => {
                setQuery(event.target.value);
                setCursorPosition(event.target.selectionStart);
              }}
              onClick={updateCursor}
              onKeyUp={updateCursor}
              onKeyDown={handleEditorKeyDown}
              spellCheck={false}
              aria-label="SOQL query"
            />
            {editorSuggestions.length > 0 && (
              <div className="field-suggestions" role="listbox" aria-label="Query suggestions">
                {editorSuggestions.map((suggestion, index) => (
                  <button
                    type="button"
                    key={suggestion.id}
                    className={index === activeSuggestion ? 'active' : ''}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => insertSuggestion(suggestion)}
                  >
                    <span className="suggestion-main">{suggestion.display}</span>
                    {suggestion.secondary && <span className="suggestion-sub"> · {suggestion.secondary}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="editor-foot">
            <span>REST API · v61.0</span>
            <div className="editor-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleSaveQuery}
                disabled={!query.trim()}
                title="Save query to browser cookie"
              >
                Save query
              </button>
              <button onClick={runQuery} disabled={loading || !query.trim()}>
                {loading ? 'Running...' : 'Run query'} <span>⌘ ↵</span>
              </button>
            </div>
          </div>
        </div>
        {savedQueries.length > 0 && (
          <div className="saved-queries-panel">
            <div className="saved-queries-head">
              <span>EXECUTED QUERIES HISTORY ({savedQueries.length})</span>
              <div className="saved-queries-actions">
                <button type="button" className="clear-saved-btn" onClick={handleClearSavedQueries}>
                  Clear history
                </button>
              </div>
            </div>
            <div className="saved-queries-list">
              {savedQueries.map(savedQuery => (
                <div key={savedQuery} className="saved-query-item">
                  <button
                    type="button"
                    className="saved-query-btn"
                    onClick={() => handleSelectSavedQuery(savedQuery)}
                    title="Click to load into editor"
                  >
                    {savedQuery}
                  </button>
                  <div className="saved-query-actions">
                    <button
                      type="button"
                      className="saved-query-run-btn"
                      onClick={() => {
                        setQuery(savedQuery);
                        void executeQuery(savedQuery);
                      }}
                      title="Run this query directly"
                    >
                      Run
                    </button>
                    <button
                      type="button"
                      className="saved-query-del-btn"
                      onClick={(event) => handleDeleteSavedQuery(event, savedQuery)}
                      aria-label="Remove query from history"
                      title="Remove from history"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
                    aria-label="Remove saved query"
                    title="Remove query"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {error && <div className="error">{error}</div>}
        {result && <section className="results"><div className="results-head"><div><p className="eyebrow">RESULTS</p><h3>{result.totalSize} record{result.totalSize === 1 ? '' : 's'}</h3></div><span className="result-mark">LIVE</span></div><div className="table-wrap"><table><thead><tr>{fields.map(field => <th key={field}>{field}</th>)}</tr></thead><tbody>{result.records.map((record, index) => <tr key={index}>{fields.map(field => { const value = getNestedValue(record, field); return <td key={field}>{field === 'Id' && typeof value === 'string' && instanceUrl ? <a href={`${instanceUrl}/lightning/r/${objectName}/${value}/view`} target="_blank" rel="noreferrer">{value}</a> : formatValue(value)}</td>; })}</tr>)}</tbody></table></div></section>}
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

function getSelectedFields(query: string, records: RecordValue[]): string[] {
  const selectedFields = query.match(/^\s*SELECT\s+([\s\S]*?)\s+FROM\b/i)?.[1]
    ?.split(',')
    .map(field => field.trim().split(/\s+AS\s+|\s+/i)[0])
    .filter(field => field && field.toLowerCase() !== 'attributes') || [];
  if (selectedFields.length) return [...new Set(selectedFields)];
  return [...new Set(records.flatMap(record => Object.keys(record)).filter(field => field !== 'attributes'))];
}

function getNestedValue(record: RecordValue, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as RecordValue)[segment];
  }, record);
}

function getOrgHost(instanceUrl: string): string {
  try {
    return new URL(instanceUrl).hostname;
  } catch {
    return instanceUrl;
  }
}
