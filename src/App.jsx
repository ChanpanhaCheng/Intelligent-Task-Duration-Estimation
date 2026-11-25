import { useEffect, useMemo, useState } from 'react';
import { calculateCompletionDate, calendarDaysBetween, getSampleEstimate } from './estimator';
import { dataQuality, demoTasks } from './demoData';

const storageKey = 'itde-demo-tasks-v1';
const blankForm = { title: '', type: '', description: '', priority: '', assignee: '', startDate: '' };
const navItems = [['overview', 'Overview'], ['estimate', 'New Estimate'], ['history', 'Task History']];

function loadTasks() {
  try { return JSON.parse(localStorage.getItem(storageKey)) || demoTasks; } catch { return demoTasks; }
}
function shortDate(value) { return value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'; }
function comparisonText(estimate, actual) {
  const difference = actual - estimate;
  if (difference === 0) return 'Finished exactly as estimated.';
  return `Finished ${Math.abs(difference)} day${Math.abs(difference) === 1 ? '' : 's'} ${difference > 0 ? 'later' : 'earlier'} than estimated.`;
}

function Status({ status }) { return <span className={`status ${status === 'Completed' ? 'complete' : 'awaiting'}`}><span aria-hidden="true">{status === 'Completed' ? '✓' : '○'}</span> {status}</span>; }
function Button({ children, className = '', ...props }) { return <button className={`button ${className}`} {...props}>{children}</button>; }

function App() {
  const [page, setPage] = useState('overview');
  const [tasks, setTasks] = useState(loadTasks);
  const [flash, setFlash] = useState('');
  const [completionTask, setCompletionTask] = useState(null);

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { if (!flash) return undefined; const id = setTimeout(() => setFlash(''), 4200); return () => clearTimeout(id); }, [flash]);

  const metrics = useMemo(() => {
    const completed = tasks.filter((task) => task.status === 'Completed');
    const average = completed.length ? completed.reduce((sum, task) => sum + Math.abs(task.actual - task.estimate), 0) / completed.length : null;
    return { estimated: tasks.length, completed: completed.length, average };
  }, [tasks]);
  const recent = [...tasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const addTask = (task) => { setTasks((current) => [task, ...current]); setFlash(`Estimate saved for “${task.title}”. You can record its completion in Task History.`); setPage('history'); };
  const completeTask = (id, startDate, completionDate) => {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, startDate, completionDate, actual: calendarDaysBetween(startDate, completionDate), status: 'Completed' } : task));
    setCompletionTask(null); setFlash('Completion recorded. The comparison and demo metrics are updated.');
  };

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand-mark">IT</div><div className="brand"><span>INTELLIGENT</span><strong>Task Duration</strong></div><nav aria-label="Primary navigation">{navItems.map(([key, label]) => <button key={key} className={page === key ? 'nav-item active' : 'nav-item'} onClick={() => setPage(key)}><span aria-hidden="true">{key === 'overview' ? '⌂' : key === 'estimate' ? '+' : '≡'}</span>{label}</button>)}</nav><p className="side-note">Demo workspace<br />Sample records only</p></aside>
    <main className="main"><header className="topbar"><div><p className="eyebrow">PROJECT OPERATIONS</p><h1>{page === 'overview' ? 'Project overview' : page === 'estimate' ? 'New task estimate' : 'Task history'}</h1><div className="demo-note"><strong>Demo mode</strong><span>Estimates use sample logic. The machine learning model is planned.</span></div></div>{page === 'overview' && <Button onClick={() => setPage('estimate')}>+ New Estimate</Button>}</header>
      {flash && <div className="flash" role="status">✓ {flash}</div>}
      {page === 'overview' && <Overview metrics={metrics} recent={recent} openHistory={() => setPage('history')} />}
      {page === 'estimate' && <EstimateForm onSave={addTask} />}
      {page === 'history' && <History tasks={tasks} onRecord={setCompletionTask} />}
    </main>
    <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.map(([key, label]) => <button key={key} onClick={() => setPage(key)} className={page === key ? 'active' : ''}>{label}</button>)}</nav>
    {completionTask && <CompletionDialog task={completionTask} onClose={() => setCompletionTask(null)} onComplete={completeTask} />}
  </div>;
}

function Overview({ metrics, recent, openHistory }) {
  return <section className="page-content"><div className="metrics" aria-label="Demo metrics"><Metric label="Tasks Estimated" value={metrics.estimated} note="Based on sample records" /><Metric label="Completed Tasks" value={metrics.completed} note="Based on sample records" /><Metric label="Average Error" value={metrics.average === null ? '—' : `${metrics.average.toFixed(1)} days`} note="Demo metric • mean absolute error" /></div>
    <div className="overview-grid"><section className="panel"><div className="section-heading"><div><p className="eyebrow">SAVED ESTIMATES</p><h2>Recent tasks</h2></div><button className="text-button" onClick={openHistory}>View history →</button></div><div className="recent-list">{recent.map((task) => <article className="recent-row" key={task.id}><div><strong>{task.title}</strong><span>{task.type} · {task.priority || 'No priority'}</span></div><div className="row-right"><span>{task.estimate} days</span><Status status={task.status} /></div></article>)}</div></section>
      <section className="panel quality-panel"><p className="eyebrow">DATA PROCESSING</p><h2>Dataset quality snapshot</h2><p>CSV audit for the proposed training data. This display does not claim trained-model performance.</p><dl><div><dt>Raw records</dt><dd>{dataQuality.rawRecords.toLocaleString()}</dd></div><div><dt>Blank labels</dt><dd>{dataQuality.blankLabels}</dd></div><div><dt>Exact duplicates</dt><dd>{dataQuality.duplicates}</dd></div><div><dt>Invalid dates</dt><dd>{dataQuality.invalidDates}</dd></div></dl><div className="quality-callout"><strong>Clean-data option: {dataQuality.cleanRecords.toLocaleString()} records</strong><span>Exclude the 2 rows with blank labels, or retain them with an “Unknown” label.</span></div></section></div>
  </section>;
}
function Metric({ label, value, note }) { return <article className="metric"><p>{label}</p><strong>{value}</strong><span>{note}</span></article>; }

function EstimateForm({ onSave }) {
  const [form, setForm] = useState(blankForm); const [estimate, setEstimate] = useState(null); const [errors, setErrors] = useState({}); const [stale, setStale] = useState(false);
  const update = (event) => { const { name, value } = event.target; setForm((old) => ({ ...old, [name]: value })); if (estimate !== null) setStale(true); if (errors[name]) setErrors((old) => ({ ...old, [name]: '' })); };
  const generate = (event) => { event.preventDefault(); const next = {}; if (!form.title.trim()) next.title = 'Enter a task title to continue.'; if (!form.type) next.type = 'Choose a task type to continue.'; setErrors(next); if (Object.keys(next).length) return; setEstimate(getSampleEstimate(form)); setStale(false); };
  const save = () => { if (estimate === null || stale) return; onSave({ id: `task-${Date.now()}`, ...form, estimate, completionDate: null, actual: null, status: 'Awaiting Completion', createdAt: new Date().toISOString() }); };
  const completionDate = calculateCompletionDate(form.startDate, estimate);
  return <section className="estimate-layout page-content"><form className="panel estimate-form" onSubmit={generate} noValidate><div className="section-heading"><div><p className="eyebrow">TASK DETAILS</p><h2>Describe the work</h2></div><span className="required-key">* Required</span></div><Field label="Task Title" required error={errors.title}><input name="title" value={form.title} onChange={update} aria-invalid={Boolean(errors.title)} /></Field><Field label="Task Type" required error={errors.type}><select name="type" value={form.type} onChange={update} aria-invalid={Boolean(errors.type)}><option value="">Select task type</option><option>Bug Fix</option><option>Feature</option><option>Improvement</option></select></Field><Field label="Description" optional><textarea name="description" value={form.description} onChange={update} rows="4" /></Field><div className="form-grid"><Field label="Priority" optional><select name="priority" value={form.priority} onChange={update}><option value="">No priority selected</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></Field><Field label="Assignee" optional><select name="assignee" value={form.assignee} onChange={update}><option value="">Unassigned — team fallback</option><option>Alex Chen</option><option>Maya Patel</option><option>Jordan Lee</option><option>New team member — team fallback</option></select></Field></div><Field label="Actual Start Date" optional hint="Used to calculate the estimated completion date."><input type="date" name="startDate" value={form.startDate} onChange={update} /></Field><Button type="submit">Get Estimate →</Button></form>
    <aside className="panel result-panel" aria-live="polite">{estimate === null ? <><p className="eyebrow">ESTIMATE RESULT</p><h2>Ready when you are</h2><p>Enter a required title and task type, then select <strong>Get Estimate</strong>.</p></> : <><p className="eyebrow">SAMPLE ESTIMATE</p><span className="result-number">{estimate}</span><h2>calendar days</h2><div className="result-detail"><span>Estimated completion</span><strong>{completionDate || 'Add a start date to see an estimated completion date.'}</strong></div><p className="result-note">Uses deterministic sample logic and fictional assignee history. A new or unassigned task uses the sample team fallback.</p>{stale ? <div className="inline-message" role="status">↻ Inputs changed. Refresh the estimate before saving.</div> : <Button onClick={save}>Save Estimate</Button>}</>}</aside></section>;
}
function Field({ label, optional, required, error, hint, children }) { const id = children.props.name; return <label className="field" htmlFor={id}><span>{label} {required && <b aria-hidden="true">*</b>} {optional && <em>(Optional)</em>}</span>{children}{hint && <small>{hint}</small>}{error && <small className="error" role="alert">{error}</small>}</label>; }

function History({ tasks, onRecord }) {
  const [search, setSearch] = useState(''); const [type, setType] = useState(''); const [status, setStatus] = useState('');
  const visible = tasks.filter((task) => task.title.toLowerCase().includes(search.toLowerCase()) && (!type || task.type === type) && (!status || task.status === status));
  return <section className="page-content"><section className="panel"><div className="section-heading"><div><p className="eyebrow">SAVED RECORDS</p><h2>Compare estimates with outcomes</h2></div><span className="record-count">{visible.length} shown</span></div><div className="filters"><label>Search title<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks" /></label><label>Task type<select value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option>Bug Fix</option><option>Feature</option><option>Improvement</option></select></label><label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option>Awaiting Completion</option><option>Completed</option></select></label></div>
    {visible.length === 0 ? <div className="empty"><strong>No matching task records.</strong><span>Try a different title, type, or status filter.</span></div> : <><div className="task-table-wrap"><table><thead><tr><th>Task</th><th>Type</th><th>Priority</th><th>Estimated</th><th>Actual</th><th>Status</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{visible.map((task) => <TaskRow task={task} onRecord={onRecord} key={task.id} />)}</tbody></table></div><div className="task-cards">{visible.map((task) => <TaskCard task={task} onRecord={onRecord} key={task.id} />)}</div></>}</section></section>;
}
function TaskRow({ task, onRecord }) { return <tr><td><strong>{task.title}</strong><small>{task.assignee || 'Unassigned · team fallback'}</small></td><td>{task.type}</td><td>{task.priority || '—'}</td><td>{task.estimate} days</td><td>{task.actual === null ? '—' : `${task.actual} days`}</td><td><Status status={task.status} />{task.actual !== null && <small>{comparisonText(task.estimate, task.actual)}</small>}</td><td>{task.status === 'Awaiting Completion' ? <Button className="small" onClick={() => onRecord(task)}>Record Completion</Button> : <span className="complete-label">Recorded</span>}</td></tr>; }
function TaskCard({ task, onRecord }) { return <article className="task-card"><div><Status status={task.status} /><h3>{task.title}</h3><p>{task.type} · {task.priority || 'No priority'}</p></div><dl><div><dt>Estimated</dt><dd>{task.estimate} days</dd></div><div><dt>Actual</dt><dd>{task.actual === null ? '—' : `${task.actual} days`}</dd></div></dl>{task.actual !== null && <p className="comparison">{comparisonText(task.estimate, task.actual)}</p>}{task.status === 'Awaiting Completion' && <Button onClick={() => onRecord(task)}>Record Completion</Button>}</article>; }

function CompletionDialog({ task, onClose, onComplete }) {
  const [startDate, setStartDate] = useState(task.startDate || ''); const [completionDate, setCompletionDate] = useState(''); const [errors, setErrors] = useState({});
  const submit = (event) => { event.preventDefault(); const next = {}; if (!startDate) next.startDate = 'Enter the actual start date.'; if (!completionDate) next.completionDate = 'Enter the completion date.'; if (startDate && completionDate && completionDate < startDate) next.completionDate = 'Completion date must be on or after the start date.'; setErrors(next); if (Object.keys(next).length === 0) onComplete(task.id, startDate, completionDate); };
  const preview = startDate && completionDate && completionDate >= startDate ? calendarDaysBetween(startDate, completionDate) : null;
  return <div className="dialog-backdrop" role="presentation"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="completion-title"><button className="close-button" aria-label="Close completion form" onClick={onClose}>×</button><p className="eyebrow">RECORD OUTCOME</p><h2 id="completion-title">Complete: {task.title}</h2><p>Original estimate: <strong>{task.estimate} calendar days</strong></p><form onSubmit={submit} noValidate><Field label="Actual Start Date" required error={errors.startDate}><input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setErrors((old) => ({ ...old, startDate: '' })); }} /></Field><Field label="Completion Date" required error={errors.completionDate}><input type="date" value={completionDate} onChange={(e) => { setCompletionDate(e.target.value); setErrors((old) => ({ ...old, completionDate: '' })); }} /></Field>{preview !== null && <div className="duration-preview"><span>Actual duration</span><strong>{preview} calendar days</strong><small>{comparisonText(task.estimate, preview)}</small></div>}<div className="dialog-actions"><Button type="button" className="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save Completion</Button></div></form></section></div>;
}

export default App;
