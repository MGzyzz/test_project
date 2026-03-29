import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pg from 'pg'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const app = express()
app.use(cors())
app.use(express.json())

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod'

// ── Tables ────────────────────────────────────────────────────────────────────
await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    last_login    TIMESTAMPTZ
  )
`)

// Migrations
await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ`)
await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE`)
await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS block_reason TEXT`)

// Migrate old question_stats (without user_id) to new schema
const { rows: cols } = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'question_stats' AND column_name = 'user_id'
`)
if (!cols.length) {
  await pool.query(`DROP TABLE IF EXISTS question_stats`)
}

await pool.query(`
  CREATE TABLE IF NOT EXISTS question_stats (
    question_hash TEXT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    correct_count INTEGER DEFAULT 0,
    wrong_count   INTEGER DEFAULT 0,
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY   (question_hash, user_id)
  )
`)

// ── Auth middleware ───────────────────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' })

  try {
    const hash = await bcrypt.hash(password, 10)
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username.trim(), hash]
    )
    const token = jwt.sign({ id: rows[0].id, username: rows[0].username }, JWT_SECRET, { expiresIn: '30d' })
    res.json({ token, username: rows[0].username })
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Username already taken' })
    throw e
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' })

  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim()])
  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' })

  const valid = await bcrypt.compare(password, rows[0].password_hash)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  if (rows[0].is_blocked) {
    const reason = rows[0].block_reason ? ` Reason: ${rows[0].block_reason}` : ''
    return res.status(403).json({ error: `Your account has been blocked.${reason}` })
  }

  await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [rows[0].id])

  const token = jwt.sign({ id: rows[0].id, username: rows[0].username }, JWT_SECRET, { expiresIn: '30d' })
  res.json({ token, username: rows[0].username })
})

// ── Admin routes ──────────────────────────────────────────────────────────────
function adminOnly(req, res, next) {
  if (req.user.username !== 'admin') return res.status(403).json({ error: 'Forbidden' })
  next()
}

app.get('/api/admin/users', auth, adminOnly, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT u.username, u.created_at, u.last_login, u.is_blocked,
       COUNT(s.question_hash) AS questions_attempted,
       COALESCE(SUM(s.wrong_count), 0) AS total_wrong,
       COALESCE(SUM(s.correct_count), 0) AS total_correct
     FROM users u
     LEFT JOIN question_stats s ON s.user_id = u.id
     GROUP BY u.id
     ORDER BY u.last_login DESC NULLS LAST`
  )
  res.json(rows)
})

app.post('/api/admin/users/:username/block', auth, adminOnly, async (req, res) => {
  const { username } = req.params
  const { reason } = req.body
  if (username === 'admin') return res.status(400).json({ error: 'Cannot block admin' })
  await pool.query(
    'UPDATE users SET is_blocked = TRUE, block_reason = $1 WHERE username = $2',
    [reason || null, username]
  )
  res.json({ ok: true })
})

app.post('/api/admin/users/:username/unblock', auth, adminOnly, async (req, res) => {
  const { username } = req.params
  await pool.query('UPDATE users SET is_blocked = FALSE, block_reason = NULL WHERE username = $1', [username])
  res.json({ ok: true })
})

// ── Stats routes (protected) ──────────────────────────────────────────────────
app.post('/api/stats', auth, async (req, res) => {
  const { questionText, correct } = req.body
  if (!questionText) return res.status(400).json({ error: 'questionText required' })

  const hash = crypto.createHash('md5').update(questionText).digest('hex')
  const col  = correct ? 'correct_count' : 'wrong_count'

  await pool.query(
    `INSERT INTO question_stats (question_hash, user_id, question_text, ${col})
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (question_hash, user_id) DO UPDATE
     SET ${col} = question_stats.${col} + 1, updated_at = NOW()`,
    [hash, req.user.id, questionText]
  )
  res.json({ ok: true })
})

app.get('/api/stats', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT question_text, correct_count, wrong_count
     FROM question_stats WHERE user_id = $1
     ORDER BY wrong_count DESC`,
    [req.user.id]
  )
  res.json(rows)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
