// Wraps the Gemini API call + prompt design for turning raw meeting
// notes into structured items. Kept separate from the route so the
// prompt/parsing logic can be tested or swapped (e.g. for OpenAI) later
// without touching route code.

const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are an assistant that extracts structured action items from raw meeting notes.

Given raw meeting notes, extract every distinct item and classify each as one of:
- "decision": something the team agreed on or decided
- "task": a concrete piece of work someone needs to do
- "follow_up": something to check on later / a reminder, not a full task

For each item, extract (when mentioned; leave null if not mentioned):
- title: a short, clear summary (max ~10 words)
- description: 1-2 sentences of relevant detail from the notes
- owner: the person's name responsible, if mentioned
- due_date: an ISO date (YYYY-MM-DD) if a deadline is mentioned or can be reasonably inferred (e.g. "by Friday" relative to the notes' likely context); otherwise null. Do not guess a real date for vague terms like "soon" — use null instead.

Respond with ONLY a JSON array, no markdown fences, no commentary, no preamble. Example shape:
[
  {"type": "decision", "title": "...", "description": "...", "owner": null, "due_date": null},
  {"type": "task", "title": "...", "description": "...", "owner": "Alex", "due_date": "2026-09-05"}
]

If the notes contain no extractable items, respond with an empty array: []`;

/**
 * Calls Gemini to extract structured items from raw meeting notes.
 * Returns a parsed array of { type, title, description, owner, due_date }.
 * Throws if the API call fails or the response isn't valid JSON.
 */
async function extractActionItems(rawNotes) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in .env');
  }

  const body = {
    contents: [
      {
        parts: [{ text: `${SYSTEM_PROMPT}\n\nMeeting notes:\n"""\n${rawNotes}\n"""` }],
      },
    ],
    generationConfig: {
      temperature: 0.2, // low temperature: we want consistent extraction, not creativity
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini returned no content — check your API key and quota.');
  }

  let items;
  try {
    items = JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse Gemini response as JSON: ${err.message}. Raw response: ${text.slice(0, 300)}`);
  }

  if (!Array.isArray(items)) {
    throw new Error('Gemini response was valid JSON but not an array.');
  }

  // Validate + normalize each item defensively — never trust LLM output blindly,
  // since a malformed field here would otherwise break the DB insert later.
  const VALID_TYPES = ['decision', 'task', 'follow_up'];
  return items
    .filter((item) => item && typeof item.title === 'string' && item.title.trim().length > 0)
    .map((item) => ({
      type: VALID_TYPES.includes(item.type) ? item.type : 'task',
      title: item.title.trim().slice(0, 500),
      description: typeof item.description === 'string' ? item.description.trim() : null,
      owner: typeof item.owner === 'string' && item.owner.trim() ? item.owner.trim() : null,
      due_date: isValidIsoDate(item.due_date) ? item.due_date : null,
    }));
}

function isValidIsoDate(value) {
  if (typeof value !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(new Date(value).getTime());
}

module.exports = { extractActionItems };