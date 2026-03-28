import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pg from 'pg'
import crypto from 'crypto'

const app = express()
app.use(cors())
app.use(express.json())

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

await pool.query(`
  CREATE TABLE IF NOT EXISTS question_stats (
    question_hash TEXT PRIMARY KEY,
    question_text TEXT NOT NULL,
    correct_count INTEGER DEFAULT 0,
    wrong_count   INTEGER DEFAULT 0,
    updated_at    TIMESTAMPTZ DEFAULT NOW()
  )
`)

app.post('/api/stats', async (req, res) => {
  const { questionText, correct } = req.body
  if (!questionText) return res.status(400).json({ error: 'questionText required' })

  const hash = crypto.createHash('md5').update(questionText).digest('hex')
  const col  = correct ? 'correct_count' : 'wrong_count'

  await pool.query(
    `INSERT INTO question_stats (question_hash, question_text, ${col})
     VALUES ($1, $2, 1)
     ON CONFLICT (question_hash) DO UPDATE
     SET ${col} = question_stats.${col} + 1, updated_at = NOW()`,
    [hash, questionText]
  )

  res.json({ ok: true })
})

app.get('/api/stats', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT question_text, correct_count, wrong_count
     FROM question_stats
     ORDER BY wrong_count DESC`
  )
  res.json(rows)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
