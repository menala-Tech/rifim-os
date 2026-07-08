/**
 * RIFIM OS — Document Type Registry
 * Master registry untuk 20 jenis dokumen RIFIM Smart Office.
 * Sumber: RIFIM SMART OFFICE.txt
 *
 * Format nomor: 001/RIFIM/{CODE}/{MONTH_ROMAN}/{YEAR}
 */

const DOCUMENT_TYPES = {

  // ── KORESPONDENSI ──────────────────────────────────────────
  SURAT: {
    code:     'SURAT',
    label:    'Surat Resmi',
    category: 'Korespondensi',
    icon:     '📨',
    folder:   'Surat',
    fields:   ['recipient_name','recipient_address','subject','attachment','body'],
  },
  ST: {
    code:     'ST',
    label:    'Surat Tugas',
    category: 'Korespondensi',
    icon:     '📋',
    folder:   'Surat',
    fields:   ['employee_name','employee_id','task_desc','task_location','start_date','end_date'],
  },
  SIZ: {
    code:     'SIZ',
    label:    'Surat Izin',
    category: 'Korespondensi',
    icon:     '🗓',
    folder:   'Surat',
    fields:   ['employee_name','leave_type','start_date','end_date','reason'],
  },
  SKT: {
    code:     'SKT',
    label:    'Surat Keterangan',
    category: 'Korespondensi',
    icon:     '📃',
    folder:   'Surat',
    fields:   ['employee_name','employee_id','position','purpose'],
  },

  // ── KEUANGAN ───────────────────────────────────────────────
  INV: {
    code:     'INV',
    label:    'Invoice',
    category: 'Keuangan',
    icon:     '🧾',
    folder:   'Invoice',
    fields:   ['client_name','client_address','items','due_date','bank_account'],
  },
  KWT: {
    code:     'KWT',
    label:    'Kwitansi',
    category: 'Keuangan',
    icon:     '💰',
    folder:   'Kwitansi',
    fields:   ['payer_name','amount','payment_purpose','payment_date'],
  },

  // ── KERJASAMA ──────────────────────────────────────────────
  PROP: {
    code:     'PROP',
    label:    'Proposal',
    category: 'Kerjasama',
    icon:     '📊',
    folder:   'Proposal',
    fields:   ['recipient_name','project_name','scope','timeline','budget'],
  },
  CP: {
    code:     'CP',
    label:    'Company Profile',
    category: 'Kerjasama',
    icon:     '🏢',
    folder:   'Proposal',
    fields:   ['recipient_name','purpose'],
  },
  MOU: {
    code:     'MOU',
    label:    'MoU',
    category: 'Kerjasama',
    icon:     '🤝',
    folder:   'MOU',
    fields:   ['party_a','party_b','scope','duration','signing_date'],
  },
  PKS: {
    code:     'PKS',
    label:    'Perjanjian Kerjasama',
    category: 'Kerjasama',
    icon:     '📑',
    folder:   'Kontrak',
    fields:   ['party_a','party_b','scope','value','duration','signing_date'],
  },

  // ── HR / SDM ───────────────────────────────────────────────
  SP1: {
    code:     'SP1',
    label:    'Surat Peringatan 1',
    category: 'HR / SDM',
    icon:     '⚠️',
    folder:   'SP',
    fields:   ['employee_name','employee_id','position','violation','incident_date'],
  },
  SP2: {
    code:     'SP2',
    label:    'Surat Peringatan 2',
    category: 'HR / SDM',
    icon:     '🔴',
    folder:   'SP',
    fields:   ['employee_name','employee_id','position','violation','incident_date','previous_sp'],
  },
  SP3: {
    code:     'SP3',
    label:    'Surat Peringatan 3',
    category: 'HR / SDM',
    icon:     '🚫',
    folder:   'SP',
    fields:   ['employee_name','employee_id','position','violation','incident_date','previous_sp'],
  },
  PKWT: {
    code:     'PKWT',
    label:    'Kontrak PKWT',
    category: 'HR / SDM',
    icon:     '📝',
    folder:   'Kontrak',
    fields:   ['employee_name','position','department','salary','contract_start','contract_end'],
  },
  SPG: {
    code:     'SPG',
    label:    'Surat Pengangkatan',
    category: 'HR / SDM',
    icon:     '🎖',
    folder:   'Kontrak',
    fields:   ['employee_name','employee_id','old_position','new_position','effective_date'],
  },
  SMT: {
    code:     'SMT',
    label:    'Surat Mutasi',
    category: 'HR / SDM',
    icon:     '🔄',
    folder:   'Kontrak',
    fields:   ['employee_name','employee_id','from_dept','to_dept','effective_date'],
  },
  PHK: {
    code:     'PHK',
    label:    'Surat PHK',
    category: 'HR / SDM',
    icon:     '📤',
    folder:   'SP',
    fields:   ['employee_name','employee_id','position','last_working_day','reason'],
  },
  PI: {
    code:     'PI',
    label:    'Pakta Integritas',
    category: 'HR / SDM',
    icon:     '🛡',
    folder:   'Kontrak',
    fields:   ['employee_name','employee_id','position','signing_date'],
  },

  // ── OPERASIONAL ────────────────────────────────────────────
  BA: {
    code:     'BA',
    label:    'Berita Acara',
    category: 'Operasional',
    icon:     '📰',
    folder:   'Berita Acara',
    fields:   ['event_name','event_date','location','attendees','description','result'],
  },
  FCO: {
    code:     'FCO',
    label:    'Form Checklist Operasional',
    category: 'Operasional',
    icon:     '✅',
    folder:   'Berita Acara',
    fields:   ['checklist_type','officer_name','date','items'],
  },
};

/**
 * Kembalikan semua tipe dokumen dikelompokkan per kategori.
 */
function getDocumentTypesByCategory() {
  const result = {};
  Object.values(DOCUMENT_TYPES).forEach(function(dt) {
    if (!result[dt.category]) result[dt.category] = [];
    result[dt.category].push(dt);
  });
  return result;
}

/**
 * Validasi tipe dokumen.
 */
function isValidDocumentType(code) {
  return Object.prototype.hasOwnProperty.call(DOCUMENT_TYPES, code);
}
