// Wraps calls to the Notion API. Kept separate from routes so the
// mapping between our action_items schema and Notion's property
// format lives in one place.

const NOTION_API_URL = 'https://api.notion.com/v1/pages';
const NOTION_VERSION = '2022-06-28'; // Notion requires a version header on every request

/**
 * Creates a new page (row) in the configured Notion database for one
 * confirmed action item. Returns the created page's Notion ID, which
 * we store back on the item so we know it's already synced.
 */
async function createNotionPage(item) {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!apiKey || !databaseId) {
    throw new Error('NOTION_API_KEY or NOTION_DATABASE_ID is not set in .env');
  }

  // Maps our action_items row -> Notion's property format.
  // Select properties (Type, Status) must be sent as { name: value }.
  // A Date property with no value must be omitted entirely, not sent as null,
  // or Notion returns a validation error.
  const properties = {
    Name: {
      title: [{ text: { content: item.title } }],
    },
    Type: {
      select: { name: item.type },
    },
    Status: {
      select: { name: 'confirmed' },
    },
  };

  if (item.owner) {
    properties.Owner = {
      rich_text: [{ text: { content: item.owner } }],
    };
  }

  if (item.due_date) {
    properties['Due date'] = {
      date: { start: item.due_date },
    };
  }

  const response = await fetch(NOTION_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties,
      
      children: item.description
        ? [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: { rich_text: [{ text: { content: item.description } }] },
            },
          ]
        : [],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Notion API error (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  return data.id;
}

module.exports = { createNotionPage };
