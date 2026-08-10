const path = require('path')
const { chromium } = require('playwright')

function envBool(name, fallback) {
  const raw = String(process.env[name] || '').trim().toLowerCase()
  if (!raw) return fallback
  return !['0','false','no','off'].includes(raw)
}

async function firstVisible(candidates, timeout = 1800) {
  for (const locator of candidates) {
    try { if (await locator.first().isVisible({ timeout })) return locator.first() }
    catch (_) {}
  }
  return null
}

class AistBrowser {
  constructor() { this.context = null; this.page = null; this.lastAdminActivityAt = null }

  async open() {
    const profileDir = path.resolve(process.env.AIST_PROFILE_DIR || '.menala-aist-profile')
    this.context = await chromium.launchPersistentContext(profileDir, {
      headless:envBool('AIST_HEADLESS', false), viewport:null, args:['--start-maximized'],
    })
    this.page = this.context.pages()[0] || await this.context.newPage()
    this.installActivityGuard()
    await this.page.goto(process.env.AIST_BASE_URL || 'https://aist-id.taxsee.com/', {
      waitUntil:'domcontentloaded', timeout:30000,
    })
    return this.page
  }

  installActivityGuard() {
    if (!this.page) return
    const mark = () => { this.lastAdminActivityAt = new Date().toISOString() }
    this.page.exposeFunction('__menalaAdminActivity', mark).catch(() => {})
    this.page.addInitScript(() => {
      window.__menalaAutomationRunning = false
      const report = () => {
        if (window.__menalaAutomationRunning) return
        try { window.__menalaAdminActivity?.() } catch (_) {}
      }
      for (const ev of ['pointerdown','keydown','wheel','touchstart']) {
        window.addEventListener(ev, report, { capture:true, passive:true })
      }
    }).catch(() => {})
  }

  async isLoggedIn() {
    if (!this.page) return false
    const password = await firstVisible([
      this.page.locator('input[type="password"]'), this.page.getByLabel(/password|kata sandi/i),
    ], 500)
    if (password) return false
    const appMarker = await firstVisible([
      this.page.getByText(/documents?/i),
      this.page.getByRole('link', { name:/documents?/i }),
      this.page.getByRole('button', { name:/documents?/i }),
    ], 1000)
    return !!appMarker
  }

  async openBalanceReplenishment() {
    const page = this.page
    if (!page) throw new Error('AIST browser belum dibuka')
    if (!(await this.isLoggedIn())) throw new Error('AIST belum login. Login manual di browser MENALA AIST terlebih dahulu.')

    const documents = await firstVisible([
      page.getByRole('link', { name:/documents?/i }),
      page.getByRole('button', { name:/documents?/i }),
      page.getByText(/^documents?$/i),
    ], 3000)
    if (!documents) throw new Error('Menu Documents AIST tidak ditemukan')
    await documents.click()

    const add = await firstVisible([
      page.getByRole('button', { name:/^add$|new|create/i }), page.getByText(/^add$/i),
    ], 3000)
    if (!add) throw new Error('Tombol Add AIST tidak ditemukan')
    await add.click()

    const balance = await firstVisible([
      page.getByText(/balance replenishment/i),
      page.getByRole('option', { name:/balance replenishment/i }),
      page.getByRole('menuitem', { name:/balance replenishment/i }),
    ], 3000)
    if (!balance) throw new Error('Balance replenishment tidak ditemukan')
    await balance.click()
  }

  async fillAndSubmit(job) {
    const page = this.page
    if (!page) throw new Error('AIST browser belum dibuka')
    await page.evaluate(() => { window.__menalaAutomationRunning = true }).catch(() => {})
    try { return await this._fillAndSubmitInternal(job) }
    finally { await page.evaluate(() => { window.__menalaAutomationRunning = false }).catch(() => {}) }
  }

  async _fillAndSubmitInternal(job) {
    const page = this.page
    await this.openBalanceReplenishment()
    const amount = await firstVisible([
      page.getByLabel(/amount|jumlah|nominal/i), page.getByPlaceholder(/amount|jumlah|nominal/i), page.locator('input[name*="amount" i]'),
    ], 3000)
    if (!amount) throw new Error('Field Amount tidak ditemukan')
    const driver = await firstVisible([
      page.getByLabel(/driver login|login id|driver id|login/i),
      page.getByPlaceholder(/driver login|login id|driver id|login/i),
      page.locator('input[name*="driver" i],input[name*="login" i]'),
    ], 3000)
    if (!driver) throw new Error('Field Driver Login tidak ditemukan')

    await amount.fill(String(job.nominal))
    await driver.fill(String(job.driver_login_id))
    const amountNow = String(await amount.inputValue()).replace(/[^0-9]/g, '')
    const driverNow = String(await driver.inputValue()).trim()
    if (Number(amountNow) !== Number(job.nominal)) throw new Error('Verifikasi nominal sebelum submit gagal')
    if (driverNow !== String(job.driver_login_id)) throw new Error('Verifikasi ID Driver sebelum submit gagal')

    const save = await firstVisible([
      page.getByRole('button', { name:/^ok$|save|submit|simpan/i }), page.locator('button[type="submit"]'),
    ], 3000)
    if (!save) throw new Error('Tombol Save/OK AIST tidak ditemukan')
    await save.click()

    const confirm = await firstVisible([page.getByRole('button', { name:/^yes$|confirm|ok|ya$/i })], 1500)
    if (confirm) await confirm.click()

    const success = page.getByText(/success|successful|successfully|berhasil|completed/i).first()
    const failure = page.getByText(/error|failed|failure|gagal|invalid/i).first()
    const outcome = await Promise.race([
      success.waitFor({ state:'visible', timeout:30000 }).then(async () => ({ ok:true, text:String(await success.textContent() || '').trim() })),
      failure.waitFor({ state:'visible', timeout:30000 }).then(async () => ({ ok:false, text:String(await failure.textContent() || 'AIST gagal').trim() })),
    ]).catch(() => null)
    if (!outcome) throw new Error('Timeout menunggu hasil AIST')
    if (!outcome.ok) throw new Error(outcome.text)

    const refEl = await firstVisible([
      page.getByText(/reference|document no|document number|ref\.?/i), page.locator('[data-testid*="reference" i]'),
    ], 700)
    const referenceText = refEl ? String(await refEl.textContent() || '').trim() : ''
    return {
      success:true,
      reference:referenceText,
      result:{ success_text:outcome.text, driver_login_id:job.driver_login_id, nominal:Number(job.nominal), verified_at:new Date().toISOString() },
    }
  }
}
module.exports = { AistBrowser }
