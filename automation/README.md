# automation/

> Seluruh automation engine RIFIM OS. Semua automation harus reusable.

---

## Rules

- Automation harus dapat digunakan oleh lebih dari satu modul
- Jangan taruh business logic di sini — hanya execution engine
- Setiap engine harus terdokumentasi dengan jelas

---

## Engines

| Folder | Engine | Description |
|--------|--------|-------------|
| `apps-script/` | GAS Core | Google Apps Script utilities & shared functions |
| `workflow/` | Workflow Engine | Orchestration alur kerja antar modul |
| `email/` | Email Engine | Pengiriman notifikasi email otomatis |
| `whatsapp/` | WhatsApp Engine | Pengiriman pesan WhatsApp via API |
| `pdf/` | PDF Engine | Konversi dokumen Google Docs ke PDF |
| `qr/` | QR Engine | Generate QR code untuk dokumen |
| `numbering/` | Numbering Engine | Auto-generate nomor dokumen unik |
