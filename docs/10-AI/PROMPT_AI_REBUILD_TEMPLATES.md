# PROMPT AI — Rebuild 18 Template Google Docs RIFIM OS
*Dibuat: 2026-07-19 | Digunakan saat session berikutnya mengerjakan rebuild template*

---

## Tujuan
Buat ulang seluruh 18 template Google Docs (6 per perusahaan: RIFIM, MIG, LAILAN)
dengan format kop surat, TTD, dan stempel yang **BENAR** sesuai dokumen asli perusahaan.
Masalah sebelumnya: logo/TTD/stempel bergeser saat template diedit.

---

## ⚠️ ATURAN WAJIB SEBELUM MULAI

**WAJIB tampilkan PREVIEW layout terlebih dahulu** sebelum:
- Menjalankan / mengubah script GAS apapun
- Membuat deployment GAS baru
- Mengubah tabel Supabase apapun
- Menimpa template yang sudah ada

Preview minimal berisi:
1. Layout ASCII / tabel HTML per jenis template (kop, body, tanda tangan)
2. Daftar Drive File ID yang akan dipakai
3. Daftar template ID yang akan **dihapus/diganti**
4. Nama fungsi GAS yang akan dijalankan

Tunggu konfirmasi user "lanjut" atau "ok" sebelum eksekusi.

---

## Dokumen Referensi Format Asli

| File | Perusahaan | Isi |
|------|------------|-----|
| `C:\Users\ADMIN\Documents\RIFIM\invoive kursi.docx` | LAILAN | Kop + Invoice + TTD + Stempel |
| `C:\Users\ADMIN\Documents\RIFIM\Menala\DATA PT\Perjanjian PKWT STAFF RIFIM.docx` | RIFIM | Kop Header + PKWT |
| `C:\Users\ADMIN\Documents\RIFIM\Menala\PT.Menala Internasional Gemilang\Administrasi\Data PT\Administrasi surat\Permohonan Penunjukan sebagai Operator.docx` | MIG | Kop Header + Surat Resmi |

---

## Spesifikasi Kop Surat (dari dokumen asli)

### RIFIM — PT. Rifim International Gemilang
```
LOKASI : HEADER section dokumen (bukan di body)
Logo   : 109×109px (2.87×2.87cm)
         posH relativeFrom=column, offset=-1.56cm (agak ke kiri)
         posV relativeFrom=paragraph, offset=-0.05cm
         Drive ID: 1nCupDI298AB2BEZi-0La_fiTi7kc7GYL
Teks   : PT. RIFIM INTERNASIONAL GEMILANG         ← bold, merah
         Vendor Operasional Aplikasi Maxim By RIFIM GROUP
         📍 Batam,Kepri | 📞 +62 821 7010 2349 | ✉️ menalagemilang@gmail.com | 🌐 www.menala.co.id
Pemisah: garis horizontal di bawah kop
```

### MIG — PT. Menala Internasional Gemilang
```
LOKASI : HEADER section dokumen (bukan di body)
Logo   : 126×112px (3.32×2.96cm)
         posH relativeFrom=column, offset=-1.96cm
         posV relativeFrom=paragraph, offset=+0.29cm
         Drive ID: 1mQqV99UdKXkwz1E1lKTjb2UtzhWmOFX9
Teks   : PT. MENALA INTERNASIONAL GEMILANG        ← bold, merah
         Vendor Operasional Aplikasi Maxim By RIFIM GROUP
         📍 Batam,Kepri | 📞 +62 821 7010 2349 | ✉️ menalagemilang@gmail.com | 🌐 www.menala.co.id
Pemisah: garis horizontal di bawah kop
```

### LAILAN — CV. Lailan Kalilan Indonesia
```
LOKASI : BODY dokumen (tidak pakai header section — sesuai dokumen asli)
Logo   : ~120×100px inline di tabel kop (kiri)
         Drive ID: 17mfkZ8xA-TSzKqIRi9XEGT-LHobD9N_I
Teks   : CV. LAILAN KALILAN INDONESIA             ← bold, merah/hitam
         PERCETAKAN DAN ADVERTISING
         Komplek Fanindo Batu Aji - Batam | 📞 0821-7010-2349
Pemisah: garis horizontal di bawah kop
```

---

## Spesifikasi TTD + Stempel (dari LAILAN Invoice — dokumen asli)

```
TTD    : 85×42px
         Drive ID (Bobby Rahman): 1hacw-5aFC2RNASx2iV2fSaZTk4Ry6SZ7  ← sama untuk semua
Stempel:
  RIFIM  → Drive ID: 1o4bTu5Xl_fU71NqRJy0AnQmnVyuVMQEA  (~119×100px)
  MIG    → Drive ID: 1zmEVKU2cwaBkZtl0Ki96P-nQ74YUTPjb   (~100×100px)
  LAILAN → Drive ID: 1Jt45lz3VaKrXMVKNaq99vEHyIHD7Ae9Q  (~119×100px)
```

### Posisi TTD + Stempel yang BENAR (tidak bergeser)
**JANGAN** gunakan floating/anchored object dengan posisi absolut EMU.
**GUNAKAN** inline image di dalam tabel borderless 2-kolom:

```
┌─────────────────────────────┬──────────────────┐
│ Hormat kami,                │                  │
│ {{COMPANY_NAME}}            │   [STEMPEL]      │
│                             │   100×100px      │
│ [TTD 85×42px]               │                  │
│                             │                  │
│ {{DIRECTOR_NAME}}           │                  │
│ {{DIRECTOR_TITLE}}          │                  │
└─────────────────────────────┴──────────────────┘
  kolom kiri: width=200pt       kolom kanan: width=120pt
  border: 0 (invisible)
```

Dengan inline image di dalam table cell:
- TTD & stempel TIDAK BERGESER saat body text bertambah/berkurang
- Posisi selalu mengikuti tabel tanda tangan, bukan text anchor floating

---

## Drive File IDs (Lengkap)

```javascript
var RIFIM_ASSETS = {
  logoId    : '1nCupDI298AB2BEZi-0La_fiTi7kc7GYL',
  ttdId     : '1hacw-5aFC2RNASx2iV2fSaZTk4Ry6SZ7',
  stempelId : '1o4bTu5Xl_fU71NqRJy0AnQmnVyuVMQEA',
};
var MIG_ASSETS = {
  logoId    : '1mQqV99UdKXkwz1E1lKTjb2UtzhWmOFX9',
  ttdId     : '1hacw-5aFC2RNASx2iV2fSaZTk4Ry6SZ7',
  stempelId : '1zmEVKU2cwaBkZtl0Ki96P-nQ74YUTPjb',
};
var LAILAN_ASSETS = {
  logoId    : '17mfkZ8xA-TSzKqIRi9XEGT-LHobD9N_I',
  ttdId     : '1hacw-5aFC2RNASx2iV2fSaZTk4Ry6SZ7',
  stempelId : '1Jt45lz3VaKrXMVKNaq99vEHyIHD7Ae9Q',
};
```

---

## Pendekatan Teknis GAS

### 1. Kop Surat → Document Header (untuk RIFIM & MIG)

Google Docs header = segment terpisah, selalu muncul di atas setiap halaman,
tidak terpengaruh perubahan body. Masukkan logo via Docs REST API batchUpdate:

```javascript
function _insertLogoInDocHeader(docId, assets) {
  var doc       = DocumentApp.openById(docId);
  var header    = doc.getHeader() || doc.addHeader();
  var logoBlob  = DriveApp.getFileById(assets.logoId).getBlob();

  // Tabel 2 kolom: logo | teks kop
  var tbl = header.appendTable([['', '']]);
  tbl.setBorderWidth(0);
  tbl.setColumnWidth(0, 100); // logo col
  tbl.setColumnWidth(1, 350); // text col

  var logoCell = tbl.getCell(0, 0);
  logoCell.clear();
  logoCell.getChild(0).asParagraph()
    .appendInlineImage(logoBlob)
    .setWidth(109).setHeight(109);
  logoCell.setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE);

  var textCell = tbl.getCell(0, 1);
  textCell.clear();
  var p1 = textCell.getChild(0).asParagraph();
  p1.appendText('{{COMPANY_NAME}}');
  p1.editAsText().setFontFamily('Arial').setFontSize(13).setBold(true).setForegroundColor('#C40000');
  textCell.appendParagraph('Vendor Operasional Aplikasi Maxim By RIFIM GROUP')
    .editAsText().setFontFamily('Arial').setFontSize(9).setBold(false).setForegroundColor('#444444');
  textCell.appendParagraph('📍 Batam,Kepri  |  📞 +62 821 7010 2349  |  ✉️ menalagemilang@gmail.com')
    .editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#666666');
  textCell.setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE);

  header.appendHorizontalRule();
  doc.saveAndClose();
}
```

### 2. Kop Surat → Body Table (untuk LAILAN)

LAILAN tidak pakai header section — kop di body:

```javascript
function _makeLailanDocBody(doc, assets) {
  var body     = doc.getBody();
  var logoBlob = DriveApp.getFileById(assets.logoId).getBlob();

  var tbl = body.appendTable([['', '']]);
  tbl.setBorderWidth(0);
  tbl.setColumnWidth(0, 110);
  tbl.setColumnWidth(1, 350);

  var logoCell = tbl.getCell(0, 0);
  logoCell.clear();
  logoCell.getChild(0).asParagraph()
    .appendInlineImage(logoBlob).setWidth(109).setHeight(90);
  logoCell.setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE);

  var textCell = tbl.getCell(0, 1);
  textCell.clear();
  var p1 = textCell.getChild(0).asParagraph();
  p1.appendText('CV. LAILAN KALILAN INDONESIA');
  p1.editAsText().setFontFamily('Arial').setFontSize(13).setBold(true).setForegroundColor('#1A1A1A');
  textCell.appendParagraph('PERCETAKAN DAN ADVERTISING')
    .editAsText().setFontFamily('Arial').setFontSize(10).setBold(false);
  textCell.appendParagraph('Komplek Fanindo Batu Aji - Batam  /  0821-7010-2349')
    .editAsText().setFontFamily('Arial').setFontSize(9).setForegroundColor('#444444');
  textCell.setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE);

  body.appendHorizontalRule();
  return body;
}
```

### 3. Blok Tanda Tangan (semua perusahaan)

```javascript
function _makeSignatureBlock(body, assets) {
  var _sp = function() { body.appendParagraph(''); };
  _sp();

  var ttdBlob     = DriveApp.getFileById(assets.ttdId).getBlob();
  var stempelBlob = DriveApp.getFileById(assets.stempelId).getBlob();

  var sigTbl = body.appendTable([['', '']]);
  sigTbl.setBorderWidth(0);
  sigTbl.setColumnWidth(0, 200);
  sigTbl.setColumnWidth(1, 120);

  // Kolom kiri: teks + TTD + nama direktur
  var leftCell = sigTbl.getCell(0, 0);
  leftCell.clear();
  var leftPara = leftCell.getChild(0).asParagraph();
  leftPara.appendText('Hormat kami,');
  leftCell.appendParagraph('{{COMPANY_NAME}}')
    .editAsText().setBold(true);
  leftCell.appendParagraph('');  // spacer agar TTD punya ruang
  // TTD image
  var ttdPara = leftCell.appendParagraph('');
  ttdPara.appendInlineImage(ttdBlob).setWidth(85).setHeight(42);
  leftCell.appendParagraph('');
  leftCell.appendParagraph('{{DIRECTOR_NAME}}')
    .editAsText().setBold(true);
  leftCell.appendParagraph('{{DIRECTOR_TITLE}}');

  // Kolom kanan: stempel
  var rightCell = sigTbl.getCell(0, 1);
  rightCell.clear();
  rightCell.appendParagraph('');  // spacer vertikal agar sejajar TTD
  rightCell.getChild(0).asParagraph()
    .appendInlineImage(stempelBlob).setWidth(100).setHeight(100);
  rightCell.setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE);
}
```

### 4. Blok Tanda Tangan untuk SP / PKWT / MOU (2 pihak)

```javascript
function _makeSignatureBlock2Pihak(body, assets, leftLabel, rightLabel) {
  var ttdBlob     = DriveApp.getFileById(assets.ttdId).getBlob();
  var stempelBlob = DriveApp.getFileById(assets.stempelId).getBlob();

  var sigTbl = body.appendTable([
    [leftLabel,         rightLabel],
    ['{{COMPANY_NAME}}',''],
    ['',                ''],  // baris TTD + stempel
    ['{{DIRECTOR_NAME}}\n{{DIRECTOR_TITLE}}', '{{EMPLOYEE_NAME}}\n{{EMPLOYEE_POSITION}}'],
  ]);
  sigTbl.setBorderWidth(0);
  sigTbl.setColumnWidth(0, 240);
  sigTbl.setColumnWidth(1, 240);

  // Baris 2 = TTD kiri + Stempel kiri (overlapping via table)
  var ttdCell = sigTbl.getCell(2, 0);
  ttdCell.clear();
  var ttdPara = ttdCell.getChild(0).asParagraph();
  ttdPara.appendInlineImage(ttdBlob).setWidth(80).setHeight(40);
  ttdPara.appendInlineImage(stempelBlob).setWidth(75).setHeight(75);
}
```

---

## Urutan Kerja Sesi Mendatang

### Step 1 — Baca state saat ini
```
Read setupTemplates.js        → lihat fungsi builder yang ada
Read setupCompanies.js        → lihat template IDs yang tersimpan
Read sheet companies (via GAS) → catat tpl_* kolom per perusahaan
```

### Step 2 — Tampilkan preview
Sebelum menulis kode apapun, tampilkan:
1. Preview layout setiap template (ASCII table atau widget HTML)
2. Daftar file ID yang akan dipakai
3. Nama fungsi baru yang akan dibuat
4. Template lama yang akan diganti (dan ID-nya)

Tunggu konfirmasi user.

### Step 3 — Buat fungsi GAS baru di setupTemplates.js
Buat fungsi per perusahaan:
- `createRifimTemplatesV2()` — 6 template dengan header logo, TTD+stempel inline
- `createMenalaTemplatesV2()` — sama
- `createLailanTemplatesV2()` — sama (kop di body, bukan header)

Semua memanggil `_saveCompanyTemplateIds(code, ids)` yang sudah ada.

### Step 4 — clasp push + jalankan di GAS Editor
```
cd C:\Projects\menala\rifim-os\automation\apps-script
clasp push
```
Lalu jalankan 3 fungsi dari GAS Editor satu per satu.

### Step 5 — Verifikasi
Generate 1 dokumen test per perusahaan (via dashboard) dan verifikasi:
- [ ] Logo muncul di kop (header), tidak bergeser
- [ ] TTD muncul di blok tanda tangan
- [ ] Stempel muncul di samping TTD
- [ ] Saat teks body ditambah/dikurangi, posisi TTD+stempel TIDAK bergeser

---

## Yang TIDAK boleh berubah

- Semua placeholder `{{...}}` tetap sama persis
- Nama kolom di sheet `companies` (`tpl_surat`, `tpl_inv`, dst.)
- GAS Web App URL (jangan buat deployment baru tanpa instruksi eksplisit)
- Tabel Supabase (rebuild template tidak perlu sentuh Supabase)

---

## Kontak / Detail Perusahaan (untuk teks kop)

| Field | Nilai |
|-------|-------|
| Telepon | +62 821 7010 2349 |
| Email | menalagemilang@gmail.com / rifim01@adminrifim.org |
| Website | www.menala.co.id |
| Alamat LAILAN | Komplek Fanindo Batu Aji - Batam |
| Direktur | Bobby Rahman Maholi Berutu |
| Jabatan | Direktur Utama |
