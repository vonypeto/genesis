// Uncomment this line to use CSS modules
// import styles from './app.module.css';
import NxWelcome from './nx-welcome';

import { Route, Routes, Link } from 'react-router-dom';

export function App() {
import React, { useState } from 'react';
import styles from './app.module.css';
export type StartRunDto = {
  prompts: string[];
  brands: string[];
  models: string[];
  notes?: string;
};

export const RunForm: React.FC<{ onSubmit: (data: StartRunDto) => void }> = ({ onSubmit }) => {
  const [prompts, setPrompts] = useState<string[]>(['']);
  const [brands, setBrands] = useState<string[]>(['']);
  const [models, setModels] = useState<string[]>(['openai:gpt-4o']);
  const [notes, setNotes] = useState('');

  const handleArrayChange = (setter: (arr: string[]) => void, arr: string[], idx: number, value: string) => {
    const copy = [...arr];
    copy[idx] = value;
    setter(copy);
  };

  const addField = (setter: (arr: string[]) => void, arr: string[]) => setter([...arr, '']);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ prompts, brands, models, notes });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2>Start LLM Run</h2>
      <div>
        <label>Prompts:</label>
        {prompts.map((p, i) => (
          <input key={i} value={p} onChange={e => handleArrayChange(setPrompts, prompts, i, e.target.value)} placeholder={`Prompt ${i + 1}`} />
        ))}
        <button type="button" onClick={() => addField(setPrompts, prompts)}>Add Prompt</button>
      </div>
      <div>
        <label>Brands:</label>
        {brands.map((b, i) => (
          <input key={i} value={b} onChange={e => handleArrayChange(setBrands, brands, i, e.target.value)} placeholder={`Brand ${i + 1}`} />
        ))}
        <button type="button" onClick={() => addField(setBrands, brands)}>Add Brand</button>
      </div>
      <div>
        <label>Models:</label>
        {models.map((m, i) => (
          <input key={i} value={m} onChange={e => handleArrayChange(setModels, models, i, e.target.value)} placeholder={`Model ${i + 1}`} />
        ))}
        <button type="button" onClick={() => addField(setModels, models)}>Add Model</button>
      </div>
      <div>
        <label>Notes:</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" />
      </div>
      <button type="submit">Start Run</button>
    </form>
  );
};

export const RunStatus: React.FC<{ runId: string }> = ({ runId }) => {
  const [status, setStatus] = useState<string>('');

  React.useEffect(() => {
    if (!runId) return;
    fetch(`/api/${runId}/status`)
      .then(res => res.json())
      .then(data => setStatus(data.status));
  }, [runId]);

  return (
    <div className={styles.status}>
      <strong>Run Status:</strong> {status}
    </div>
  );
};

export const RunSummary: React.FC<{ runId: string }> = ({ runId }) => {
  const [summary, setSummary] = useState<any>(null);

  React.useEffect(() => {
    if (!runId) return;
    fetch(`/api/${runId}/summary`)
      .then(res => res.json())
      .then(data => setSummary(data));
  }, [runId]);

  if (!summary) return null;

  return (
    <div className={styles.summary}>
      <h3>Run Summary</h3>
      {summary.prompts?.map((p: any, i: number) => (
        <div key={i} className={styles.promptSummary}>
          <div><strong>Prompt:</strong> {p.prompt}</div>
          <div><strong>Model:</strong> {p.model}</div>
          <div><strong>Answer:</strong> {p.answer}</div>
          <div><strong>Brand Metrics:</strong> <pre>{JSON.stringify(p.brandMetrics, null, 2)}</pre></div>
        </div>
      ))}
    </div>
  );
};

const App: React.FC = () => {
  const [runId, setRunId] = useState<string>('');

  const handleStartRun = async (data: StartRunDto) => {
    const res = await fetch('/api/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    setRunId(result.runId);
  };

  return (
    <div className={styles.container}>
      <RunForm onSubmit={handleStartRun} />
      {runId && <RunStatus runId={runId} />}
      {runId && <RunSummary runId={runId} />}
    </div>
  );
};

export default App;

      {/* START: routes */}
      {/* These routes and navigation have been generated for you */}
      {/* Feel free to move and update them to fit your needs */}
      <br />
      <hr />
      <br />
      <div role="navigation">
        <ul>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/page-2">Page 2</Link>
          </li>
        </ul>
      </div>
      <Routes>
        <Route
          path="/"
          element={
            <div>
              This is the generated root route.{' '}
              <Link to="/page-2">Click here for page 2.</Link>
            </div>
          }
        />
        <Route
          path="/page-2"
          element={
            <div>
              <Link to="/">Click here to go back to root page.</Link>
            </div>
          }
        />
      </Routes>
      {/* END: routes */}
    </div>
  );
}

export default App;
