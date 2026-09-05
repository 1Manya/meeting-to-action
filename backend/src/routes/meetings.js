const express = require('express');
const pool = require('../db/pool');
const { extractActionItems } = require('../services/llmService');
const { createNotionPage } = require('../services/notionService');

const router = express.Router();

// POST /api/meetings — create a meeting from raw pasted notes.
// LLM processing is NOT triggered here (that's Day 2's job, via a
// separate /api/meetings/:id/generate endpoint) — this just stores
// the raw input so the two concerns stay decoupled.
router.post('/', async (req, res) => {
  const { title, raw_notes } = req.body;

  if (!raw_notes || typeof raw_notes !== 'string' || raw_notes.trim().length === 0) {
    return res.status(400).json({ error: 'raw_notes is required and must be non-empty text.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO meetings (title, raw_notes) VALUES ($1, $2) RETURNING *`,
      [title || 'Untitled meeting', raw_notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[meetings:create]', err);
    res.status(500).json({ error: 'Failed to create meeting.' });
  }
});

// GET /api/meetings — list all meetings, most recent first.
router.get('/', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, status, created_at, updated_at FROM meetings ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[meetings:list]', err);
    res.status(500).json({ error: 'Failed to list meetings.' });
  }
});

// GET /api/meetings/:id — one meeting plus its generated items.
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const meetingResult = await pool.query(`SELECT * FROM meetings WHERE id = $1`, [id]);
    if (meetingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found.' });
    }

    const itemsResult = await pool.query(
      `SELECT * FROM action_items WHERE meeting_id = $1 ORDER BY sort_order ASC, id ASC`,
      [id]
    );

    res.json({ ...meetingResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    console.error('[meetings:get]', err);
    res.status(500).json({ error: 'Failed to fetch meeting.' });
  }
});

// POST /api/meetings/:id/generate — run the LLM extraction on this
// meeting's raw_notes and store the results as action_items rows.
// This is intentionally a separate step from creation (Day 1), so a
// meeting can be re-generated later without re-submitting the notes,
// and so a failed LLM call doesn't lose the original notes.
router.post('/:id/generate', async (req, res) => {
  const { id } = req.params;

  try {
    const meetingResult = await pool.query(`SELECT * FROM meetings WHERE id = $1`, [id]);
    if (meetingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found.' });
    }
    const meeting = meetingResult.rows[0];

    await pool.query(`UPDATE meetings SET status = 'processing' WHERE id = $1`, [id]);

    let items;
    try {
      items = await extractActionItems(meeting.raw_notes);
    } catch (llmErr) {
      console.error('[meetings:generate] LLM extraction failed', llmErr);
      await pool.query(`UPDATE meetings SET status = 'draft' WHERE id = $1`, [id]);
      return res.status(502).json({ error: `AI extraction failed: ${llmErr.message}` });
    }

    // Clear any previously generated items for this meeting before
    // inserting fresh ones, so re-running generate doesn't duplicate rows.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM action_items WHERE meeting_id = $1`, [id]);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await client.query(
          `INSERT INTO action_items (meeting_id, type, title, description, owner, due_date, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, item.type, item.title, item.description, item.owner, item.due_date, i]
        );
      }

      await client.query(`UPDATE meetings SET status = 'reviewed' WHERE id = $1`, [id]);
      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

    const finalItems = await pool.query(
      `SELECT * FROM action_items WHERE meeting_id = $1 ORDER BY sort_order ASC`,
      [id]
    );
    res.json({ meeting_id: Number(id), items: finalItems.rows });
  } catch (err) {
    console.error('[meetings:generate]', err);
    res.status(500).json({ error: 'Failed to generate action items.' });
  }
});

// POST /api/meetings/:id/sync-to-notion — push every "confirmed" item
// for this meeting into Notion as a new page, then mark it "synced"
// so re-running this never double-pushes the same item. Only items
// the user explicitly confirmed are ever sent — this is the one
// place in the whole app that talks to an external PM tool.
router.post('/:id/sync-to-notion', async (req, res) => {
  const { id } = req.params;

  try {
    const itemsResult = await pool.query(
      `SELECT * FROM action_items WHERE meeting_id = $1 AND status = 'confirmed'`,
      [id]
    );
    const itemsToSync = itemsResult.rows;

    if (itemsToSync.length === 0) {
      return res.status(400).json({ error: 'No confirmed items to sync. Confirm at least one item first.' });
    }

    const results = { synced: [], failed: [] };

    for (const item of itemsToSync) {
      try {
        const notionPageId = await createNotionPage(item);
        await pool.query(
          `UPDATE action_items SET status = 'synced', notion_page_id = $1 WHERE id = $2`,
          [notionPageId, item.id]
        );
        results.synced.push(item.id);
      } catch (err) {
        console.error(`[sync-to-notion] Failed to sync item ${item.id}:`, err.message);
        results.failed.push({ id: item.id, error: err.message });
      }
    }

    res.json(results);
  } catch (err) {
    console.error('[meetings:sync-to-notion]', err);
    res.status(500).json({ error: 'Failed to sync items to Notion.' });
  }
});

module.exports = router;
