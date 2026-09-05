import { useEffect, useState } from 'react';
import ItemRow from './ItemRow.jsx';
import {
  listMeetings,
  createMeeting,
  getMeeting,
  generateItems,
  updateActionItem,
  deleteActionItem,
  syncMeetingToNotion,
} from './api.js';

const TYPE_META = {
  decision: { label: 'Decisions', colorVar: 'var(--decision)' },
  task: { label: 'Tasks', colorVar: 'var(--task)' },
  follow_up: { label: 'Follow-ups', colorVar: 'var(--followup)' },
};

export default function App() {
  const [meetings, setMeetings] = useState([]);
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    refreshMeetingList();
  }, []);

  async function refreshMeetingList() {
    try {
      const list = await listMeetings();
      setMeetings(list);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerate() {
    if (!notes.trim()) {
      setError('Paste some meeting notes first.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const meeting = await createMeeting(title, notes);
      await generateItems(meeting.id);
      const fullMeeting = await getMeeting(meeting.id);
      setActiveMeeting(fullMeeting);
      setTitle('');
      setNotes('');
      await refreshMeetingList();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectMeeting(id) {
    setError(null);
    setSyncResult(null);
    try {
      const fullMeeting = await getMeeting(id);
      setActiveMeeting(fullMeeting);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpdateItem(itemId, fields) {
    try {
      await updateActionItem(itemId, fields);
      setActiveMeeting((prev) => ({
        ...prev,
        items: prev.items.map((it) => (it.id === itemId ? { ...it, ...fields } : it)),
      }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteItem(itemId) {
    try {
      await deleteActionItem(itemId);
      setActiveMeeting((prev) => ({
        ...prev,
        items: prev.items.filter((it) => it.id !== itemId),
      }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSyncToNotion() {
    setSyncResult(null);
    setError(null);
    setSyncing(true);
    try {
      const result = await syncMeetingToNotion(activeMeeting.id);
      setSyncResult(result);
      const refreshed = await getMeeting(activeMeeting.id);
      setActiveMeeting(refreshed);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  const groupedItems = activeMeeting
    ? activeMeeting.items.reduce((acc, item) => {
        acc[item.type] = acc[item.type] || [];
        acc[item.type].push(item);
        return acc;
      }, {})
    : {};

  const confirmedCount = activeMeeting?.items.filter((i) => i.status === 'confirmed').length || 0;
  const syncedCount = activeMeeting?.items.filter((i) => i.status === 'synced').length || 0;
  const rejectedCount = activeMeeting?.items.filter((i) => i.status === 'rejected').length || 0;

  return (
    <>
      <header className="masthead">
        <h1 className="masthead-brand">
          Meeting<span>→</span>Action
        </h1>
        <p className="masthead-tagline">Notes in. Reviewed decisions, tasks, and follow-ups out.</p>
      </header>

      <div className="app-shell">
        <aside className="input-pane">
          <h2 className="pane-heading">New meeting</h2>
          <p className="pane-sub">Paste your notes below. Nothing gets added anywhere until you review and confirm it.</p>

          <div className="field-label">Meeting title (optional)</div>
          <input
            className="title-input"
            placeholder="e.g. Sprint planning — Sept 1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div className="field-label">Raw notes</div>
          <textarea
            className="notes-input"
            placeholder="Paste your meeting notes here..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {error && <div className="error-banner">{error}</div>}

          <button className="primary-btn" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating…' : 'Generate action items'}
          </button>

          {meetings.length > 0 && (
            <div className="meeting-list">
              <div className="meeting-list-title">Previous meetings</div>
              {meetings.map((m) => (
                <div
                  key={m.id}
                  className={`meeting-list-item ${activeMeeting?.id === m.id ? 'active' : ''}`}
                  onClick={() => handleSelectMeeting(m.id)}
                >
                  <span>{m.title}</span>
                  <span className="status-tag">{m.status}</span>
                </div>
              ))}
            </div>
          )}
        </aside>

        <main className="results-pane">
          {!activeMeeting && !loading && (
            <div className="results-empty">
              <div className="empty-stack">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p>
                Generated decisions, tasks, and follow-ups will show up here as reviewable cards — nothing is final
                until you confirm it.
              </p>
            </div>
          )}

          {loading && (
            <p className="loading-text">Reading your notes and pulling out decisions, tasks, and follow-ups…</p>
          )}

          {activeMeeting && (
            <>
              <h2 className="meeting-heading">{activeMeeting.title}</h2>
              <div className="meeting-meta">
                <span className="stat-pill">{activeMeeting.items.length} items</span>
                <span className="stat-pill stat-pill--confirmed">{confirmedCount} confirmed</span>
                <span className="stat-pill stat-pill--synced">{syncedCount} synced</span>
                {rejectedCount > 0 && <span className="stat-pill stat-pill--rejected">{rejectedCount} rejected</span>}
              </div>

              <button
                className="primary-btn sync-btn"
                onClick={handleSyncToNotion}
                disabled={syncing || confirmedCount === 0}
              >
                {syncing ? 'Syncing…' : '↗ Sync confirmed items to Notion'}
              </button>

              {syncResult && (
                <div className="sync-result">
                  {syncResult.synced.length > 0 && <span>✓ {syncResult.synced.length} synced to Notion.</span>}
                  {syncResult.failed.length > 0 && (
                    <span className="sync-result-error">
                      {' '}
                      {syncResult.failed.length} failed — check console for details.
                    </span>
                  )}
                </div>
              )}

              {Object.entries(TYPE_META).map(([type, meta]) =>
                groupedItems[type]?.length ? (
                  <section className="item-section" key={type}>
                    <div className="item-section-title">
                      <span className="type-dot" style={{ background: meta.colorVar }} />
                      {meta.label}
                    </div>
                    <div className="item-cards">
                      {groupedItems[type].map((item) => (
                        <ItemRow key={item.id} item={item} onUpdate={handleUpdateItem} onDelete={handleDeleteItem} />
                      ))}
                    </div>
                  </section>
                ) : null
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}