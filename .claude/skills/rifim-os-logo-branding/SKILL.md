---
name: rifim-os-logo-branding
description: Logo & branding assets untuk PT. RIFIM Internasional Gemilang + subsidiaries (Menala, Lailan, Maxim, Rifim Group) — mapping file logo per perusahaan, lokasi folder branding/logo/, stempel per perusahaan, icon PWA. Gunakan skill ini SETIAP KALI user minta logo perusahaan (dalam dokumen, template HTML, GAS, output apapun) — Claude wajib LANGSUNG ambil file dari folder branding/logo/ TANPA menunggu konfirmasi. Trigger juga saat user sebut "Menala", "Rifim", "Lailan", "Maxim", "stempel", "kop surat", "letterhead", "PWA icon".
---

# Logo & Branding — RIFIM OS

## Aturan Emas

Setiap kali user minta logo perusahaan — dalam dokumen, template HTML, GAS, output apapun — Claude WAJIB langsung ambil file dari folder lokal **tanpa menunggu konfirmasi**.

**Folder induk:**
```
C:\Users\ADMIN\Documents\RIFIM\rifim-os\branding\logo\
```

(Di sesi remote/container: `/home/user/rifim-os/branding/logo/`)

## Mapping Cepat Logo

| Kata kunci / Perusahaan | File |
|---|---|
| Menala / PT. Menala Internasional Gemilang | `branding/logo/logo-menala.png` |
| Rifim / PT. RIFIM Internasional Gemilang | `branding/logo/logo-rifim.png` |
| Lailan / CV. LailanKalilan Indonesia | `branding/logo/logo-lailan.png` |
| Maxim | `branding/logo/logo-maxim.png` |
| Rifim Group / Grup / Semua Perusahaan | `branding/logo/logo-rifim-group.jpg` |
| Icon / PWA icon | `branding/icon/icon-192.png` |
| Stempel Menala | `branding/logo/stempel-menala.png` |
| Stempel Rifim | `branding/logo/stempel-rifim.png` |
| Stempel Lailan | `branding/logo/stempel-lailan.png` |

## Aturan Stempel

Stempel hanya untuk dokumen resmi (SK, PKWT, Surat Tugas). Composite dengan tanda tangan via Slides API (bukan superimpose PNG plain).

## Document Studio (Kop + Footer)

Kop dan footer per perusahaan sudah tersedia sebagai banner PNG di `branding/logo/`. Signature composite pakai Slides API — lihat skill `rifim-os-document-engine` untuk implementasi.

## RAOS PWA (`MenalaLogo` component)

RAOS pakai component `MenalaLogo` (Next.js) dengan variant:
- `header` — kecil di navbar
- `splash` — besar di login

Baca dari `apps/pwa/public/images/logo-menala.png` (mark cropped 360×268 dari `Logo Menala.png` horizontal 1200×268). Regenerate icon multi-size: `node scripts/generate-icons.js`.

## Referensi Lengkap

Mapping lengkap + aturan stempel: `PROJECT_RULES.md` bagian **Logo & Branding Rules**.
