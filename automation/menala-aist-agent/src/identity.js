const os = require('os')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

function identityPath() { return path.join(process.cwd(), '.agent-identity.json') }
function getIdentity() {
  const file = identityPath()
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (parsed.device_id) return parsed
    } catch (_) {}
  }
  const identity = { device_id:crypto.randomUUID(), machine_name:os.hostname(), created_at:new Date().toISOString() }
  fs.writeFileSync(file, JSON.stringify(identity, null, 2))
  return identity
}
module.exports = { getIdentity }
