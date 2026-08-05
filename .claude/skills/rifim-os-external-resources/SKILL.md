---
name: rifim-os-external-resources
description: External resources & lokasi kanonik RIFIM OS — folder lokal proyek (working directory), Google Drive folder aset kop/TTD/stempel + PDF output, Google Spreadsheet DB, GAS Project Editor + Web App URL aktif. Semua sumber daya eksternal harus diakses via MCP tools (Google_Workspace, Supabase, Vercel) — jangan copy-paste manual atau hardcode ID. Gunakan skill ini setiap kali butuh reference ke Drive folder ID, Spreadsheet ID, GAS URL, working directory path — bahkan kalau user hanya sebut "folder Drive", "spreadsheet", "backup", "output PDF", "buka GAS editor".
---

# External Resources — RIFIM OS

## Working Directory (WAJIB)

**Semua file proyek HANYA di:**
- Lokal: `C:\Projects\menala\rifim-os`
- Sesi remote/container: `/home/user/rifim-os/`

**Aturan:**
- Jangan buat file di luar folder ini (Desktop, Downloads, /tmp sistem)
- File temporary → subfolder `temp/` di dalam proyek
- File data/analisa → subfolder yang sesuai di dalam proyek

## Google Drive (Aset + Output)

**Folder induk:** https://drive.google.com/drive/folders/19taBn0YXxjXTb-SxqFXGhwOPShZ4VlIt

Isi: kop, TTD, stempel, PDF output Document Engine.

## Google Spreadsheet DB

**Spreadsheet ID:** `1jHeA-w1bM32S3-AU-ENN2UjiaCb4iLzRhaf4G7y4ozM`
**Link:** https://docs.google.com/spreadsheets/d/1jHeA-w1bM32S3-AU-ENN2UjiaCb4iLzRhaf4G7y4ozM

Bound ke GAS Project RIFIM OS (Main).

## GAS Project Editor

**Editor:** https://script.google.com/u/0/home/projects/1IK8-2anrxahce1X1MG7Bi3aGe6e-_4e3obanTRprT6brYSdla9rEYOxp/edit

## GAS Web App URL (AKTIF)

```
https://script.google.com/macros/s/AKfycbzzK75gxawaylaUZpoC1zp_hq5ktznlN7scIl24HkdEgR2l3cVmpUSLck0potcMZZtw/exec
```

⚠️ **URL mengandung `scIl`** (huruf besar I + huruf kecil l) — mudah tertukar dengan `scll`. Copy dari file ini, jangan retype.

## Aturan MCP-First

Gunakan MCP tools untuk semua interaksi:
- `mcp__Google_Drive__*` — untuk baca/upload/list file Drive
- `mcp__Supabase__*` — untuk DB (list_tables, execute_sql, apply_migration, get_logs, get_advisors)
- `mcp__Vercel__*` — untuk deploy status, get_project, list_projects, get_deployment_build_logs
- `mcp__github__*` — untuk PR, commit, issue

**Jangan fallback manual** (curl, git via terminal) kalau MCP available.

## Cross-Reference

- **GAS project registry lengkap (2 project):** lihat skill `rifim-os-gas-rules`
- **RAOS punya lokasi berbeda:** repo `raos-menala` di `C:\Projects\menala\RAOS\` — Drive folder RAOS terpisah, lihat CLAUDE.md RAOS

## Security

Jangan expose:
- API Keys
- Secrets / Tokens
- Passwords
- Spreadsheet IDs hardcoded (pakai config file / Script Properties)
