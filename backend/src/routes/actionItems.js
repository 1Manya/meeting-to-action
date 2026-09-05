const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

const ALLOWED_TYPES = ['decision', 'task', 'follow_up'];
const ALLOWED_STATUSES = ['pending', 'confirmed', 'rejected', 'synced'];

// PATCH /api/action-items/:id — edit a single generated item.
// This is the core "user control" requirement: every field the LLM
// generated (title, description, owner, due_date, type) can be
// overwritten here before anything is pushed to Notion.
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, owner, due_date, type, status } = req.body;

  if (type && !ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${ALLOWED_TYPES.join(', ')}` });
  }
  if (status && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
  }

  // Build the SET clause dynamically so a partial edit (e.g. just
  // changing the due_date) doesn't overwrite untouched fields with null.
  const fields = { title, description, owner, due_date, type, status };
  const updates = Object.entries(fields).filter(([, v]) => v !== undefined);

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields provided to update.' });
  }

  const setClause = updates.map(([key], i) => `${key} = $${i + 1}`).join(', ');
  const values = updates.map(([, v]) => v);

  try {
    const result = await pool.query(
      `UPDATE action_items SET ${setClause} WHERE id = $${values.length + 1} RETURNING *`,
      [...values, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Action item not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[action-items:update]', err);
    res.status(500).json({ error: 'Failed to update action item.' });
  }
});

// DELETE /api/action-items/:id — user rejects a generated item entirely.
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`DELETE FROM action_items WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Action item not found.' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('[action-items:delete]', err);
    res.status(500).json({ error: 'Failed to delete action item.' });
  }
});

module.exports = router;
