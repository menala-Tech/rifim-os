const { chromium } = require('playwright')

const DEFAULT_AIST_URL = 'https://aist-id.taxsee.com/'

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`${name} belum dikonfigurasi`)
  return value
}

async function firstVisible(candidates, timeout = 2500) {
  for (const locator of candidates) {
    try {
      if (await locator.first().isVisible({ timeout })) return locator.first()
    } catch (_) {}
  }
  return null
}

async function fillRequired(candidates, value, fieldName) {
  const input = await firstVisible(candidates)
  if (!input) throw new Error(`Field AIST "${fieldName}" tidak ditemukan`)
  await input.fill(String(value))
  return input
}

async function clickRequired(candidates, label) {
  const target = await firstVisible(candidates)
  if (!target) throw new Error(`Kontrol AIST "${label}" tidak ditemukan`)
  await target.click()
  return target
}

async function selectOptional(page, labelRegex, value) {
  if (!value) return
  const select = await firstVisible([
    page.getByLabel(labelRegex),
    page.locator('select').filter({ has: page.locator(`option:has-text("${value}")`) }),
  ])
  if (!select) throw new Error(`Pilihan AIST untuk ${labelRegex} tidak ditemukan`)
  try {
    await select.selectOption({ label: value })
  } catch (_) {
    await select.selectOption(value)
  }
}

async function loginAist(page) {
  const username = requiredEnv('AIST_USERNAME')
  const password = requiredEnv('AIST_PASSWORD')

  const userInput = await firstVisible([
    page.getByLabel(/email|login|username|user name/i),
    page.getByPlaceholder(/email|login|username|user name/i),
    page.locator('input[name*="login" i], input[name*="email" i], input[type="email"]'),
  ], 4000)

  const passwordInput = await firstVisible([
    page.getByLabel(/password|kata sandi/i),
    page.getByPlaceholder(/password|kata sandi/i),
    page.locator('input[type="password"]'),
  ], 4000)

  // Beberapa sesi AIST bisa langsung berada di halaman app karena SSO browser,
  // tetapi runner tidak menyimpan storage state. Kalau form login ada, isi ulang.
  if (userInput || passwordInput) {
    if (!userInput || !passwordInput) throw new Error('Form login AIST terdeteksi tidak lengkap')
    await userInput.fill(username)
    await passwordInput.fill(password)
    await clickRequired([
      page.getByRole('button', { name: /sign in|log in|login|masuk/i }),
      page.locator('button[type="submit"], input[type="submit"]'),
    ], 'Login')
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  }
}

async function openBalanceReplenishment(page) {
  await clickRequired([
    page.getByRole('link', { name: /documents?/i }),
    page.getByRole('button', { name: /documents?/i }),
    page.getByText(/^documents?$/i),
  ], 'Documents')

  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})

  await clickRequired([
    page.getByRole('button', { name: /^add$|new|create/i }),
    page.getByText(/^add$/i),
  ], 'Add')

  await clickRequired([
    page.getByText(/balance replenishment/i),
    page.getByRole('option', { name: /balance replenishment/i }),
    page.getByRole('menuitem', { name: /balance replenishment/i }),
  ], 'Balance replenishment')
}

async function fillBalanceForm(page, payload) {
  await selectOptional(page, /subdivision|cabang/i, process.env.AIST_SUBDIVISION)
  await selectOptional(page, /currency|mata uang/i, process.env.AIST_CURRENCY)

  await fillRequired([
    page.getByLabel(/amount|jumlah|nominal/i),
    page.getByPlaceholder(/amount|jumlah|nominal/i),
    page.locator('input[name*="amount" i]'),
  ], payload.nominal, 'Amount')

  await fillRequired([
    page.getByLabel(/driver login|login id|driver id|login/i),
    page.getByPlaceholder(/driver login|login id|driver id|login/i),
    page.locator('input[name*="driver" i], input[name*="login" i]'),
  ], payload.driver_login, 'Driver login')

  if (process.env.AIST_COMMENT) {
    const comment = await firstVisible([
      page.getByLabel(/comment|komentar|catatan/i),
      page.getByPlaceholder(/comment|komentar|catatan/i),
      page.locator('textarea'),
    ])
    if (comment) await comment.fill(process.env.AIST_COMMENT)
  }
}

async function submitAndConfirm(page) {
  await clickRequired([
    page.getByRole('button', { name: /^ok$|save|submit|simpan/i }),
    page.locator('button[type="submit"]'),
  ], 'Save/OK')

  const confirm = await firstVisible([
    page.getByRole('button', { name: /^yes$|confirm|ok|ya$/i }),
  ], 1500)
  if (confirm) await confirm.click()

  const success = page.getByText(/success|successful|successfully|berhasil|completed/i).first()
  const failure = page.getByText(/error|failed|failure|gagal|invalid/i).first()

  const outcome = await Promise.race([
    success.waitFor({ state: 'visible', timeout: 30000 }).then(() => ({ ok: true })),
    failure.waitFor({ state: 'visible', timeout: 30000 }).then(async () => ({ ok: false, message: (await failure.textContent()) || 'AIST gagal' })),
  ]).catch(() => null)

  if (!outcome) throw new Error('Timeout menunggu konfirmasi hasil AIST')
  if (!outcome.ok) throw new Error(outcome.message)
}

async function runAistSaldo(payload) {
  if (!payload || !payload.request_id) throw new Error('request_id wajib')
  if (!payload.driver_login) throw new Error('driver_login wajib')
  const nominal = Number(payload.nominal)
  if (!Number.isFinite(nominal) || nominal <= 0) throw new Error('nominal tidak valid')

  const browser = await chromium.launch({
    headless: process.env.AIST_HEADLESS !== 'false',
  })

  const context = await browser.newContext()
  const page = await context.newPage()
  const startedAt = new Date().toISOString()

  try {
    await page.goto(process.env.AIST_BASE_URL || DEFAULT_AIST_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    await loginAist(page)
    await openBalanceReplenishment(page)
    await fillBalanceForm(page, { ...payload, nominal })
    await submitAndConfirm(page)

    return {
      success: true,
      request_id: payload.request_id,
      driver_login: payload.driver_login,
      nominal,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    }
  } catch (error) {
    const screenshotPath = process.env.AIST_FAILURE_SCREENSHOT
    if (screenshotPath) {
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {})
    }
    throw error
  } finally {
    // Tidak ada persistent storageState/session. Browser baru setiap run.
    await context.close().catch(() => {})
    await browser.close().catch(() => {})
  }
}

module.exports = { runAistSaldo }
