/**
 * RIFIM OS — RAOS Chat Bridge
 * Kanal tunggal notifikasi sistem dari GAS ke RAOS Chat.
 */

var BRANCH_ID_BY_NAME = {
  'ID Rifim Airport Batam':          '029723bc-f500-464f-bbc6-f65a8160cc7b',
  'ID Rifim Airport Makassar':       '0a82c6dc-d072-4eec-bf4a-57a5b1625b80',
  'ID Rifim Jambi Luar':             '1a63f6e5-dffc-4dc5-a346-0e192dd086ce',
  'ID Rifim Airport Soekarno-Hatta': '53c52493-83c1-4e41-9702-bcbbc9f8b836',
  'ID Rifim Airport Pekanbaru':      '5446da8d-f5c5-487c-8d0d-c2b44af6c9bb',
  'ID Rifim Airport Jambi':          '99f16688-b172-42f9-815f-64a7cb3ea2ec',
  'ID Rifim Batam':                  'cafa964d-45a2-480b-9a0a-1a15666a0e6b',
  'ID Rifim Airport Manado':         'd983f58b-9deb-411e-8876-2d1cc8a8c341',
  'ID Rifim Airport Balikpapan':     'ee4dca51-5348-4f64-96c6-e91641d3eb1a',
};

function _supaRpc(name, params) {
  var cfg = _getSupabaseConfig();
  var url = cfg.url + '/rest/v1/rpc/' + encodeURIComponent(name);
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': cfg.key,
      'Authorization': 'Bearer ' + cfg.key,
    },
    payload: JSON.stringify(params || {}),
    muteHttpExceptions: true,
  });
  var code = resp.getResponseCode();
  var body = resp.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('RPC ' + name + ' failed — HTTP ' + code + ': ' + body.substring(0, 500));
  }
  return body ? JSON.parse(body) : null;
}

function _chatPostSystem(roomId, content, category, metadata) {
  if (!roomId) throw new Error('Room chat tidak ditemukan untuk kategori ' + category);
  return _supaRpc('raos_post_system_message', {
    p_room_id: roomId,
    p_content: content,
    p_category: category || null,
    p_metadata: metadata || null,
  });
}

function _chatPostAnnouncement(content, category, metadata) {
  return _chatPostSystem(
    _supaRpc('raos_resolve_announcement_room', {}),
    content,
    category,
    metadata
  );
}

function _chatPostSaldoRoom(branchName, content, category, metadata) {
  var branchId = BRANCH_ID_BY_NAME[branchName];
  if (!branchId) throw new Error('Branch ID belum dipetakan: ' + branchName);
  var meta = metadata || {};
  meta.branch_id = branchId;
  meta.branch_name = branchName;
  return _chatPostSystem(
    _supaRpc('raos_resolve_saldo_room', { p_branch_id: branchId }),
    content,
    category,
    meta
  );
}

function _chatFormatRupiah(value) {
  return 'Rp ' + Math.round(Number(value) || 0).toLocaleString('id-ID');
}

function _chatFormatPeriode(date) {
  var months = ['Januari','Februari','Maret','April','Mei','Juni',
    'Juli','Agustus','September','Oktober','November','Desember'];
  if (!(date instanceof Date)) return String(date || '');
  return months[date.getMonth()] + ' ' + date.getFullYear();
}

function _buildSlipGajiMessage(name, period, link) {
  return [
    '📄 Slip Gaji ' + period,
    '',
    'Yth. ' + name + ',',
    'Slip gaji Anda untuk periode ' + period + ' sudah tersedia.',
    link && link !== '-' ? 'Buka dokumen: ' + link : '',
    '',
    'Dokumen ini rahasia. Jangan dibagikan ke pihak lain.',
    'RIFIM OS — HRIS',
  ].filter(function(line, index) { return line || index === 1 || index === 5; }).join('\n');
}

function _buildDokumenBaruMessage(params) {
  return [
    '📋 Dokumen Baru Dibuat',
    '',
    'No: ' + (params.nomorDokumen || '-'),
    'Jenis: ' + (params.jenisDokumen || '-'),
    'Perihal: ' + (params.perihal || '-'),
    'Oleh: ' + (params.createdBy || '-'),
    '',
    'RIFIM Smart Office',
  ].join('\n');
}

function _buildRingkasanHarianMessage(branches, dateLabel) {
  var lines = ['📊 REKAP KEUANGAN HARIAN', 'Tanggal: ' + dateLabel, ''];
  var income = 0, expense = 0;
  (branches || []).forEach(function(branch) {
    income += Number(branch.pemasukan) || 0;
    expense += Number(branch.pengeluaran) || 0;
    lines.push('• ' + branch.nama + ' ' + (branch.status || ''));
    lines.push('  Masuk: ' + _chatFormatRupiah(branch.pemasukan) +
      ' | Keluar: ' + _chatFormatRupiah(branch.pengeluaran) +
      ' | Net: ' + _chatFormatRupiah(branch.net));
  });
  lines.push('', 'TOTAL', 'Masuk: ' + _chatFormatRupiah(income) +
    ' | Keluar: ' + _chatFormatRupiah(expense) +
    ' | Net: ' + _chatFormatRupiah(income - expense));
  return lines.join('\n');
}

function _buildRingkasanBulananMessage(branches, monthLabel) {
  var lines = ['📈 REKAP KEUANGAN BULANAN', 'Bulan: ' + monthLabel, ''];
  var income = 0, expense = 0, best = null;
  (branches || []).forEach(function(branch) {
    income += Number(branch.pemasukan) || 0;
    expense += Number(branch.pengeluaran) || 0;
    if (!best || (Number(branch.net) || 0) > best.net) best = { name: branch.nama, net: Number(branch.net) || 0 };
    lines.push('• ' + branch.nama + ' ' + (branch.status || ''));
    lines.push('  Masuk: ' + _chatFormatRupiah(branch.pemasukan) +
      ' | Keluar: ' + _chatFormatRupiah(branch.pengeluaran) +
      ' | Net: ' + _chatFormatRupiah(branch.net) +
      ' | Margin: ' + ((Number(branch.margin) || 0) * 100).toFixed(1) + '%');
  });
  var net = income - expense;
  lines.push('', 'TOTAL', 'Masuk: ' + _chatFormatRupiah(income) +
    ' | Keluar: ' + _chatFormatRupiah(expense) +
    ' | Net: ' + _chatFormatRupiah(net) +
    ' | Margin: ' + (income > 0 ? (net / income * 100).toFixed(1) : '0.0') + '%');
  if (best) lines.push('🏆 Terbaik: ' + best.name + ' (' + _chatFormatRupiah(best.net) + ')');
  return lines.join('\n');
}

function _buildSaldoRendahMessage(params) {
  return [
    '⚠️ Saldo Driver Rendah', '',
    'Driver: ' + (params.namaDriver || '-'),
    'ID: ' + (params.idDriver || '-'),
    'Cabang: ' + (params.cabang || '-'),
    'Saldo: ' + _chatFormatRupiah(params.saldo), '',
    'Mohon segera top-up saldo.',
    'RIFIM OS — RAOS',
  ].join('\n');
}

function _buildKontrakHampirBerakhirMessage(params) {
  return [
    '⏳ Kontrak Hampir Berakhir', '',
    'Karyawan: ' + (params.namaKaryawan || '-'),
    'ID: ' + (params.idKaryawan || '-'),
    'Berakhir: ' + (params.tanggalBerakhir || '-'),
    'Sisa: ' + (params.sisaHari || 0) + ' hari', '',
    'Mohon segera ditindaklanjuti.',
    'RIFIM OS — HRIS',
  ].join('\n');
}

function _buildPayrollSiapMessage(params) {
  return [
    '💰 Payroll Siap Diproses', '',
    'Periode: ' + (params.periode || '-'),
    'Staff: ' + (params.jumlahStaff || 0) + ' orang',
    'Cabang: ' + (params.jumlahCabang || 0),
    'Estimasi: ' + _chatFormatRupiah(params.estimasiTotal), '',
    'Segera jalankan Hitung Gaji dan Tutup Buku.',
    'RIFIM OS — HRIS',
  ].join('\n');
}
