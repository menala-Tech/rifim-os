const ALLOWED_DEPLOYMENTS = new Set([
  'AKfycbzzK75gxawaylaUZpoC1zp_hq5ktznlN7scIl24HkdEgR2l3cVmpUSLck0potcMZZtw',
  'AKfycbxrgQ_MWvsdA_bsbNF4deIALWATDCspYvY47fakpuXMZeAtGAd4baeVVe1dPGDAi1tZJA',
]);

function validateTarget(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' || u.hostname !== 'script.google.com') return null;
  const m = u.pathname.match(/^\/macros\/s\/([^/]+)\/exec$/);
  if (!m || !ALLOWED_DEPLOYMENTS.has(m[1])) return null;
  return u.toString();
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const target = validateTarget(Array.isArray(req.query.url) ? req.query.url[0] : req.query.url);
  if (!target) return res.status(400).json({ success: false, message: 'Target GAS tidak diizinkan.' });

  const method = String(req.method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'HEAD'].includes(method)) {
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan.' });
  }

  try {
    let body;
    if (method === 'POST') {
      if (typeof req.body === 'string') body = req.body;
      else if (req.body == null) body = '';
      else body = JSON.stringify(req.body);
    }
    const upstream = await fetch(target, {
      method,
      headers: method === 'POST' ? { 'Content-Type': req.headers['content-type'] || 'text/plain;charset=utf-8' } : undefined,
      body,
      redirect: 'follow',
    });
    const text = method === 'HEAD' ? '' : await upstream.text();
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.status(upstream.status).send(text);
  } catch (err) {
    res.status(502).json({ success: false, message: 'GAS proxy gagal: ' + String(err && err.message || err) });
  }
};
