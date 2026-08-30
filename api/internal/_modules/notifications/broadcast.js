'use strict';

// Broadcast Helper — Chat Room + WhatsApp Parallel (Phase 6, 2026-08-31).
//
// Purpose:
//   Admin/Direksi kirim 1 pengumuman → post ke canonical Chat Room DAN
//   kirim ke WhatsApp admin (parallel best-effort). WA failure does NOT
//   rollback chat.
//
// Canonical chat mechanism:
//   RPC public.raos_post_system_message(p_room_id uuid, p_content text,
//   p_category text, p_metadata jsonb) — SECURITY DEFINER, dipanggil dari
//   service role. Rooms 'Pengumuman' (global branch_id=NULL) atau room
//   per-cabang (branch_id=<cabang>).
//
// WA reuses:
//   fonnte-wa.send() — no duplicate sender, no direct HTTP.
//
// Role authorization (server-side, tidak trust client role):
//   audience 'admin' / 'all_staff' → admin OR direksi only
//   audience 'branch'              → admin OR direksi (koord tidak
//                                    di-broaden silent karena canonical
//                                    chat RLS existing sudah cover koord
//                                    via /chat PWA route)
//
// Recipient discovery (WA):
//   audience 'admin' & 'branch'    → ADMIN_WA_PHONES env
//   audience 'all_staff'           → ADMIN_WA_PHONES env (initial scope —
//                                    do NOT blast all staff/driver phones
//                                    dari user_profiles otomatis)
//
// Client-provided phones REJECTED — no arbitrary target.
//
// Do NOT expose to browser directly. Access via
// /api/internal/hris-contracts?mode=notification_broadcast (admin session).

const createFonnteWa = require('./fonnte-wa');
const createSystemLog = require('./system-log');

// Room mapping — canonical global room ids (from Supabase seed).
// TODO(post-launch): fetch dynamic dari branches.pengumuman_room_id kalau
// perlu per-cabang mapping.
const GLOBAL_PENGUMUMAN_ROOM_ID = '8cccb374-afa7-4d18-a7f3-b76ec7430bea';

const ALLOWED_SENDER_ROLES = new Set(['admin', 'direksi']);
const ALLOWED_AUDIENCES = new Set(['admin', 'branch', 'all_staff']);
const ALLOWED_PRIORITIES = new Set(['normal', 'important', 'urgent']);

const MAX_TITLE_LEN = 120;
const MAX_MESSAGE_LEN = 2000;

function validateInput(input) {
  const errs = [];
  const title = String(input && input.title || '').trim();
  const message = String(input && input.message || '').trim();
  const audience = String(input && input.audience || '').trim().toLowerCase();
  const priority = String(input && input.priority || 'normal').trim().toLowerCase();
  const branch_id = input && input.branch_id ? String(input.branch_id).trim() : null;
  const channels = (input && input.channels) || {};
  const wantChat = channels.chat !== false;
  const wantWa = channels.whatsapp === true;

  if (!title) errs.push('title required');
  if (title.length > MAX_TITLE_LEN) errs.push(`title max ${MAX_TITLE_LEN} chars`);
  if (!message) errs.push('message required');
  if (message.length > MAX_MESSAGE_LEN) errs.push(`message max ${MAX_MESSAGE_LEN} chars`);
  if (!ALLOWED_AUDIENCES.has(audience)) errs.push(`audience must be one of ${[...ALLOWED_AUDIENCES].join('|')}`);
  if (!ALLOWED_PRIORITIES.has(priority)) errs.push(`priority must be one of ${[...ALLOWED_PRIORITIES].join('|')}`);
  if (audience === 'branch' && !branch_id) errs.push('branch_id required when audience=branch');
  if (!wantChat && !wantWa) errs.push('at least one channel (chat/whatsapp) required');

  // Ignore client-provided phones silently (defense in depth)
  // — do NOT throw, just don't use.

  return { errs, normalized: { title, message, audience, priority, branch_id, wantChat, wantWa } };
}

function composeChatContent(title, message, priority) {
  const prio = priority === 'urgent' ? '🚨 ' : (priority === 'important' ? '📢 ' : '📣 ');
  return `${prio}${title}\n\n${message}`;
}

function composeWaMessage(title, message, priority, audience) {
  const prio = priority === 'urgent' ? '🚨 URGENT' : (priority === 'important' ? '📢 PENTING' : '📣 Pengumuman');
  return [
    `*${prio}*`,
    '',
    `*${title}*`,
    '',
    message,
    '',
    `_Audience: ${audience} · Sumber: RIFIM OS Broadcast_`,
  ].join('\n');
}

module.exports = function createBroadcast(deps) {
  if (!deps || typeof deps.sb !== 'function') throw new Error('broadcast: missing sb dependency');
  const { sb } = deps;
  const fonnte = createFonnteWa();
  const sysLog = createSystemLog({ sb });

  /**
   * Post pengumuman ke chat + WA parallel.
   * @param {object} req
   * @param {object} p - actor profile {id, role, branch_id}
   * @returns {Promise<{chat: object, wa: object, audit_ok: boolean}>}
   */
  async function postBroadcast(req, p) {
    // AuthZ
    if (!p || !ALLOWED_SENDER_ROLES.has(String(p.role || '').toLowerCase())) {
      throw new Error('Broadcast hanya untuk role admin/direksi');
    }

    const { errs, normalized } = validateInput(req && req.body || {});
    if (errs.length) throw new Error('Validation: ' + errs.join('; '));

    const { title, message, audience, priority, branch_id, wantChat, wantWa } = normalized;

    // Resolve target chat room. For branch scope, resolve room per branch;
    // if not resolvable, fail-fast (do NOT silently fall back to global).
    let roomId = GLOBAL_PENGUMUMAN_ROOM_ID;
    if (audience === 'branch') {
      const rows = await sb(`/rest/v1/chat_rooms?branch_id=eq.${encodeURIComponent(branch_id)}&name=eq.Pengumuman&select=id&limit=1`);
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row || !row.id) {
        throw new Error(`Room Pengumuman untuk branch_id=${branch_id} tidak ditemukan`);
      }
      roomId = row.id;
    }

    // 1. Chat write FIRST (canonical, must succeed for combined broadcast)
    let chatResult = { ok: false, reason: 'not_attempted' };
    if (wantChat) {
      try {
        const chatBody = {
          p_room_id: roomId,
          p_content: composeChatContent(title, message, priority),
          p_category: 'pengumuman',
          p_metadata: {
            kind: 'admin_broadcast',
            audience,
            priority,
            branch_id: branch_id || null,
            actor_id: p.id || null,
            actor_role: p.role || null,
          },
        };
        const res = await sb('/rest/v1/rpc/raos_post_system_message', {
          method: 'POST',
          body: JSON.stringify(chatBody),
        });
        const msgId = Array.isArray(res) ? res[0] : (res && res.message_id) || res;
        chatResult = { ok: true, message_id: msgId, room_id: roomId };
      } catch (e) {
        chatResult = { ok: false, reason: 'chat_write_failed', error: String(e && e.message || e).slice(0, 300) };
      }
    } else {
      chatResult = { ok: false, reason: 'chat_skipped_by_channels' };
    }

    // 2. WA decision — split-brain prevention (Phase 6 remediation):
    //    - Combined broadcast (chat+WA) & chat FAILED → STOP WA. Canonical
    //      chat is primary record; do NOT announce something that failed to
    //      become a chat message.
    //    - WA-only mode (chat=false, WA=true) → do NOT require chat success.
    //    - chat+WA & chat OK → attempt WA best-effort.
    let waResult = { ok: false, sent: 0, reason: 'not_attempted' };
    if (wantWa && wantChat && !chatResult.ok) {
      waResult = { ok: false, sent: 0, reason: 'skipped_due_to_chat_failure' };
    } else if (wantWa) {
      const phones = fonnte.getAdminPhonesFromEnv();
      const waMsg = composeWaMessage(title, message, priority, audience);
      waResult = await fonnte.send({ phones, message: waMsg, tag: 'broadcast' });
    } else {
      waResult = { ok: false, sent: 0, reason: 'wa_skipped_by_channels' };
    }

    // 3. Audit both results via canonical system_logs (Phase 6 remediation:
    //    replace opsAudit which wrote to non-existent rifim_ops_audit_log).
    const auditRes = await sysLog.writeSystemLog({
      type: 'notification_broadcast',
      process: `${audience}:${branch_id || 'global'}:${priority}`,
      status: chatResult.ok ? (waResult.ok ? 'chat_wa_ok' : (waResult.reason || 'chat_ok_wa_failed')) : 'chat_failed',
      detail: {
        actor_id: p.id || null,
        actor_role: p.role || null,
        audience,
        branch_id: branch_id || null,
        priority,
        title_length: title.length,
        chat: { ok: chatResult.ok, reason: chatResult.reason || null, message_id: chatResult.message_id || null, room_id: chatResult.room_id || null },
        wa: { ok: waResult.ok, sent: waResult.sent, skipped: waResult.skipped || 0, reason: waResult.reason || null },
      },
    });

    return { chat: chatResult, wa: waResult, audit_ok: auditRes.ok };
  }

  return { postBroadcast, _internals: { validateInput, composeChatContent, composeWaMessage } };
};
