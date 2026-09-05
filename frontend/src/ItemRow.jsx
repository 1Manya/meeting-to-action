import { useState } from 'react';

// A single editable row for one action item (decision/task/follow_up).
// Every field is directly editable, and the item carries a review
// status — pending (default), confirmed, or rejected. Nothing is
// treated as "final" until the user explicitly confirms it.

export default function ItemRow({ item, onUpdate, onDelete }) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description || '');
  const [owner, setOwner] = useState(item.owner || '');
  const [dueDate, setDueDate] = useState(item.due_date || '');
  const [justSaved, setJustSaved] = useState(false);

  function flashSaved() {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1200);
  }

  function saveIfChanged(field, value, original) {
    if (value !== (original || '')) {
      onUpdate(item.id, { [field]: value || null });
      flashSaved();
    }
  }

  function setStatus(status) {
    onUpdate(item.id, { status });
  }

  const isConfirmed = item.status === 'confirmed';
  const isRejected = item.status === 'rejected';
  const isSynced = item.status === 'synced';

  return (
    <div className={`item-row ${isRejected ? 'item-row--rejected' : ''} ${isConfirmed ? 'item-row--confirmed' : ''}`}>
      <div className="item-row-top">
        <input
          className="item-title-input"
          value={title}
          disabled={isRejected}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => saveIfChanged('title', title, item.title)}
        />
        {justSaved && <span className="saved-flash">saved</span>}
      </div>
      <textarea
        className="item-desc-input"
        rows={2}
        placeholder="Add detail..."
        value={description}
        disabled={isRejected}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => saveIfChanged('description', description, item.description)}
      />
      <div className="item-controls">
        <input
          type="text"
          placeholder="owner"
          value={owner}
          disabled={isRejected}
          onChange={(e) => setOwner(e.target.value)}
          onBlur={() => saveIfChanged('owner', owner, item.owner)}
        />
        <input
          type="date"
          value={dueDate}
          disabled={isRejected}
          onChange={(e) => setDueDate(e.target.value)}
          onBlur={() => saveIfChanged('due_date', dueDate, item.due_date)}
        />

        <div className="status-actions">
          {!isConfirmed && !isRejected && !isSynced && (
            <>
              <button className="confirm-btn" onClick={() => setStatus('confirmed')}>
                confirm
              </button>
              <button className="reject-btn" onClick={() => setStatus('rejected')}>
                reject
              </button>
            </>
          )}
          {isConfirmed && (
            <>
              <span className="status-badge status-badge--confirmed">✓ confirmed</span>
              <button className="icon-btn" onClick={() => setStatus('pending')}>
                undo
              </button>
            </>
          )}
          {isSynced && <span className="status-badge status-badge--synced">↗ synced to Notion</span>}
          {isRejected && (
            <>
              <span className="status-badge status-badge--rejected">rejected</span>
              <button className="icon-btn" onClick={() => setStatus('pending')}>
                restore
              </button>
            </>
          )}
        </div>

        <button className="icon-btn delete-btn" onClick={() => onDelete(item.id)} disabled={isSynced}>
          delete
        </button>
      </div>
    </div>
  );
}
