const express = require('express')
const crypto = require('crypto')
const { runAistSaldo } = require('./runner')

const app = express()
app.use(express.json({ limit: '64kb' }))

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''))
  const bb = Buffer.from(String(b || ''))
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb)
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'menala-aist-playwright-runner' })
})

app.post('/run', async (req, res) => {
  const expectedSecret = String(process.env.AIST_RUNNER_SHARED_SECRET || '')
  if (!expectedSecret) return res.status(503).json({ success: false, message: 'Runner secret belum dikonfigurasi' })
  if (!safeEqual(req.get('x-runner-secret'), expectedSecret)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' })
  }

  try {
    const result = await runAistSaldo({
      request_id: String(req.body?.request_id || '').trim(),
      driver_login: String(req.body?.driver_login || '').trim(),
      nominal: req.body?.nominal,
    })
    res.json(result)
  } catch (error) {
    console.error('[aist-runner]', error)
    res.status(502).json({
      success: false,
      message: error instanceof Error ? error.message : 'AIST runner gagal',
    })
  }
})

const port = Number(process.env.PORT || 8787)
app.listen(port, '127.0.0.1', () => {
  console.log(`AIST runner listening on 127.0.0.1:${port}`)
})
