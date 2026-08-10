require('dotenv').config()

const { getIdentity } = require('./identity')
const { AgentApi } = require('./api')
const { AistBrowser } = require('./browser')

const identity = getIdentity()
const api = new AgentApi(identity)
const browser = new AistBrowser()
const POLL_MS = Number(process.env.POLL_MS || 2000)
const HEARTBEAT_MS = Number(process.env.HEARTBEAT_MS || 10000)
const state = {
  status:'online', aistReady:false, financeReady:true,
  lastAdminActivityAt:null, lastError:null, busy:false,
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

async function heartbeatLoop() {
  while (true) {
    try {
      state.aistReady = await browser.isLoggedIn()
      state.lastAdminActivityAt = browser.lastAdminActivityAt
      await api.heartbeat(state)
      if (!state.busy && state.status === 'error') state.status = 'online'
      state.lastError = null
    } catch (err) {
      state.lastError = err instanceof Error ? err.message : String(err)
    }
    await sleep(HEARTBEAT_MS)
  }
}

async function processJob(job) {
  state.busy = true
  state.status = 'busy'
  state.lastError = null
  try {
    await api.running(job.id)
    const result = await browser.fillAndSubmit(job)
    await api.verifying(job.id, result.reference, result.result)
    await api.complete(job.id, { success:true })
    state.status = 'online'
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    state.lastError = message
    state.status = 'error'
    try { await api.complete(job.id, { success:false, errorCode:'aist_run_failed', errorMessage:message }) } catch (_) {}
    console.error('[MENALA AIST]', message)
  } finally {
    state.busy = false
  }
}

async function pollLoop() {
  while (true) {
    if (!state.busy) {
      try {
        state.aistReady = await browser.isLoggedIn()
        state.lastAdminActivityAt = browser.lastAdminActivityAt
        if (state.aistReady && state.financeReady) {
          const claimed = await api.claim()
          if (claimed?.job) await processJob(claimed.job)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (!/admin_active|no_job|agent_not_ready/i.test(msg)) state.lastError = msg
      }
    }
    await sleep(POLL_MS)
  }
}

async function main() {
  console.log('MENALA AIST Agent', identity)
  console.log('Browser AIST akan dibuka. Login AIST manual bila belum login.')
  await browser.open()
  heartbeatLoop().catch(console.error)
  pollLoop().catch(console.error)
}

main().catch(err => { console.error(err); process.exit(1) })
