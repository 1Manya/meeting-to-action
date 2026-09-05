const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const API_KEY = import.meta.env.VITE_APP_API_KEY || '';

// Every request gets this header. The backend simply ignores it if
// APP_API_KEY isn't set on that side, so this is safe to send even
// during local dev before you've configured a key.
const authHeaders = API_KEY ? { 'x-api-key': API_KEY } : {};

async function handleResponse(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  // 204 No Content has no body to parse
  if (res.status === 204) return null;
  return res.json();
}

export async function listMeetings() {
  const res = await fetch(`${API_URL}/api/meetings`, { headers: authHeaders });
  return handleResponse(res);
}

export async function createMeeting(title, rawNotes) {
  const res = await fetch(`${API_URL}/api/meetings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ title, raw_notes: rawNotes }),
  });
  return handleResponse(res);
}

export async function getMeeting(id) {
  const res = await fetch(`${API_URL}/api/meetings/${id}`, { headers: authHeaders });
  return handleResponse(res);
}

export async function generateItems(meetingId) {
  const res = await fetch(`${API_URL}/api/meetings/${meetingId}/generate`, {
    method: 'POST',
    headers: authHeaders,
  });
  return handleResponse(res);
}

export async function updateActionItem(id, fields) {
  const res = await fetch(`${API_URL}/api/action-items/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(fields),
  });
  return handleResponse(res);
}

export async function deleteActionItem(id) {
  const res = await fetch(`${API_URL}/api/action-items/${id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  return handleResponse(res);
}

export async function syncMeetingToNotion(meetingId) {
  const res = await fetch(`${API_URL}/api/meetings/${meetingId}/sync-to-notion`, {
    method: 'POST',
    headers: authHeaders,
  });
  return handleResponse(res);
}
