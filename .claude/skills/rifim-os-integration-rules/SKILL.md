---
name: rifim-os-integration-rules
description: SSoT data contract rules (Rule 40-47) untuk RIFIM OS + RAOS — kontrak payload wajib update 3 sisi (PWA + webApp + engine) dalam 1 commit, timestamp ISO UTC di storage, race condition pakai ScriptLock 10 detik, validasi tipe & enum di baris pertama endpoint, error logging ke sheet system_log. Gunakan skill ini setiap kali mengubah nama field / tipe / enum di kontrak lintas modul, menulis endpoint yang terima input, atau debug data race — bahkan kalau user hanya sebut "field baru", "ubah kolom", "endpoint kirim data", "sync backend-frontend".
---

# Integration Rules — SSoT Data Contract (MUTLAK)

Empat aturan ini WAJIB pada SETIAP kode yang menyentuh data (PWA payload, Modul Backend, GAS). Detail: `PROJECT_RULES.md` seksi Integration Rules (Rule 40-47).

## Rule 40 — Timestamp ISO UTC di Storage

Semua kolom storage waktu: `YYYY-MM-DDTHH:mm:ss.sssZ`. Pakai `_gasNow()`. Display lokal WIB pakai `_gasTimeDisplay(ss)` — bukan pengganti storage.

## Rule 41 — Race Condition (ScriptLock 10 detik)

Semua write konkuren WAJIB dalam lock:
```js
_gasWithLock(() => {
  // read-modify-write dalam 1 lock utuh
  const val = readSheet();
  writeSheet(val + 1);
});
```
Read-modify-write yang dipecah 2 lock = race condition.

## Rule 42 — Validasi Tipe & Enum

`_gasValidate({...})` di baris pertama endpoint:
- `attachment` = integer
- Status Antrian Bandara = uppercase enum `WAITING/CALLED/PICKED/DONE/CANCEL`
- ID baru = UUID v4 via `_gasUuid()`
- Frontend kirim tipe final (`parseInt(x) || 0`, bukan string mentah)

## Rule 43 — Error Logging

Semua `catch` → sheet `system_log` via `_gasLogError(e, ctx)` + return `{ok:false, error}`. Pengecualian: di dalam logger sendiri → `console.error()` (avoid loop).

## Rule 44-47 — Kontrak Payload

**Perubahan nama field / tipe / enum WAJIB update 3 sisi sekaligus dalam 1 commit:**

1. **PWA** (frontend query/insert)
2. **webApp** (GAS endpoint dispatcher + validate)
3. **Engine** (business logic yang consume)

Kalau salah satu tidak di-update → deployment split-brain, data corrupt.

## Kanonik Utilitas

Semua di `automation/apps-script/gasUtils.js` — **jangan implementasi ulang**. Detail lengkap util lihat skill `rifim-os-gas-rules`.

## Reminder Redeploy

Perubahan `automation/apps-script/*.js` → push GitHub (clasp auto) → **Web App wajib redeploy manual** di GAS Editor. URL `/exec` tetap.

## AI API Integration (Prompt Caching Wajib)

Untuk Modul AI Assistant / Claude API via GAS (Sprint 3+):

1. Header fetch WAJIB: `"anthropic-beta": "prompt-caching-2024-07-31"`
2. Parameter `"cache_control": {"type": "ephemeral"}` pada `system` atau `messages` yang muat konteks berat/panjang
3. Dokumen referensi operasional di awal request → hash dikenali → skema harga Read ($0.20/MTok) di execution berikutnya
