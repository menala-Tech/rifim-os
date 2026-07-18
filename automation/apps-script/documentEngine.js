/**
 * RIFIM OS — Document Engine
 * Engine utama untuk generate semua jenis dokumen perusahaan.
 *
 * Prinsip: satu fungsi GenerateDocument() untuk semua jenis dokumen.
 * Tidak ada GenerateSurat(), GenerateInvoice() terpisah.
 *
 * PERUBAHAN (refactor konsistensi):
 *   - _buildRecord() → id pakai _gasUuid() bukan 'DOC-' + Date.now() (fix #2)
 *   - _buildRecord() → attachment divalidasi ke integer via _docSanitizeAttachment() (fix #3)
 *   - generateDocument() catch → error di-log ke system_log via _gasLogError() (fix #8)
 */

// Import dari engine lain (di GAS semua file dalam satu project)
// numberingEngine.js   → generateDocumentNumber()
// placeholderEngine.js → replacePlaceholders(), buildPlaceholderData()
// driveManager.js      → saveDocument(), getTemplateCopy()
// pdfEngine.js         → exportToPDF()
// databaseLayer.js     → saveDocumentRecord(), _docSanitizeAttachment()
// configLoader.js      → getCompanyConfig()

/**
 * Generate dokumen perusahaan.
 * Entry point utama Smart Office.
 *
 * @param {object} input - Data dari form user
 *   input.documentType    {string} - SURAT / INVOICE / PKWT / SP / dll
 *   input.recipientName   {string}
 *   input.recipientCompany {string}
 *   input.recipientAddress {string}
 *   input.subject         {string} - Perihal
 *   input.attachment      {number} - Lampiran (integer). '-' atau kosong → 0
 *   input.body            {string} - Isi dokumen
 *   input.documentDate    {string} - Opsional, default hari ini
 *
 * @returns {object} Result
 *   result.success        {boolean}
 *   result.documentNumber {string}
 *   result.gdocUrl        {string}
 *   result.pdfUrl         {string}
 *   result.message        {string}
 */
function generateDocument(input) {
  try {
    _validateInput(input);

    // Route ke HTML pipeline jika diminta (atau jika flag global aktif)
    if (input.use_html_pipeline) {
      var htmlConfig  = getCompanyConfig();
      var htmlCompany = input.company_code ? getCompanyByCode(input.company_code) : null;
      var htmlPrefix  = htmlCompany && htmlCompany.doc_prefix ? String(htmlCompany.doc_prefix) : 'RIFIM';
      var htmlNum     = generateDocumentNumber(input.documentType, htmlPrefix);
      var htmlData    = buildPlaceholderData(input, htmlConfig, htmlNum);
      return generateDocumentViaHtml(input, htmlConfig, htmlCompany, htmlNum, htmlData);
    }

    var config  = getCompanyConfig();
    var company = input.company_code ? getCompanyByCode(input.company_code) : null;
    if (company) {
      config = Object.assign({}, config, {
        company_name:    company.name,
        company_address: company.address,
        company_phone:   company.phone,
        company_email:   company.email,
        company_city:    company.city || config.company_city,
        director_name:   company.director_name,
        director_title:  company.director_title,
      });
    }
    var docPrefix  = company && company.doc_prefix ? String(company.doc_prefix) : 'RIFIM';
    var docNumber  = generateDocumentNumber(input.documentType, docPrefix);
    var templateId = _getTemplateId(input.documentType, config, input.company_code);
    var docCopy    = getTemplateCopy(templateId, docNumber);
    var data       = buildPlaceholderData(input, config, docNumber);

    replacePlaceholders(docCopy.getId(), data);

    var finalDoc = saveDocument(docCopy, input.documentType, docNumber);
    var qrUrl    = embedQrInDoc(finalDoc.getId(), finalDoc.getUrl());
    var pdfFile  = exportToPDF(finalDoc.getId(), input.documentType, docNumber);
    var record   = _buildRecord(input, config, docNumber, finalDoc, pdfFile, qrUrl);

    saveDocumentRecord(record);

    return {
      success:        true,
      documentNumber: docNumber,
      gdocUrl:        finalDoc.getUrl(),
      pdfUrl:         pdfFile.getUrl(),
      message:        'Dokumen berhasil dibuat: ' + docNumber,
    };

  } catch (err) {
    // FIX #8 — log ke system_log (bukan hanya console.error)
    _gasLogError('Smart Office', 'generateDocument', err, {
      documentType: input && input.documentType || '',
      subject:      input && input.subject      || '',
      company_code: input && input.company_code || '',
    });
    return {
      success: false,
      message: 'Gagal membuat dokumen: ' + err.message,
    };
  }
}

/**
 * @private
 */
function _validateInput(input) {
  if (!input)              throw new Error('Input tidak boleh kosong.');
  if (!input.documentType) throw new Error('documentType diperlukan.');
  if (!input.subject)      throw new Error('subject (perihal) diperlukan.');
}

/**
 * Ambil Template Google Doc ID berdasarkan jenis dokumen.
 *
 * Prioritas:
 * 0. companies sheet → kolom tpl_* (template khusus perusahaan, mis. MIG dengan logo)
 * 1. sheet document_types → kolom template_gdoc_id (per baris, paling fleksibel)
 * 2. company_config → gdoc_template_* (fallback, 6 template shared)
 * @private
 */
function _getTemplateId(docType, config, companyCode) {
  var CO_KEY_MAP = {
    SURAT:'tpl_surat', ST:'tpl_surat', SIZ:'tpl_surat', SKT:'tpl_surat',
    BA:'tpl_surat', FCO:'tpl_surat', PROP:'tpl_surat', CP:'tpl_surat',
    INV:'tpl_inv', KWT:'tpl_kwt',
    SP1:'tpl_sp', SP2:'tpl_sp', SP3:'tpl_sp', PHK:'tpl_sp',
    PKWT:'tpl_pkwt', SPG:'tpl_pkwt', SMT:'tpl_pkwt', PI:'tpl_pkwt',
    MOU:'tpl_mou', PKS:'tpl_mou',
  };

  // Prioritas 0: template spesifik perusahaan (companies sheet kolom tpl_*)
  if (companyCode) {
    try {
      var company = getCompanyByCode(companyCode);
      if (company) {
        var coKey   = CO_KEY_MAP[docType];
        var coTplId = coKey ? String(company[coKey] || '').trim() : '';
        if (coTplId) return coTplId;
      }
    } catch (_) { /* fall through */ }
  }

  // Prioritas 1: sheet document_types → kolom E = template_gdoc_id
  try {
    var dtSheet = _getDB().getSheetByName('document_types');
    if (dtSheet) {
      var dtData = dtSheet.getDataRange().getValues();
      for (var i = 1; i < dtData.length; i++) {
        if (String(dtData[i][0]).trim() === docType) {
          var id = String(dtData[i][4] || '').trim();
          if (id) return id;
          break;
        }
      }
    }
  } catch (_) { /* fall through */ }

  // Prioritas 2: company_config (gdoc_template_*)
  var KEY_MAP = {
    SURAT: 'gdoc_template_surat', ST:   'gdoc_template_surat',
    SIZ:   'gdoc_template_surat', SKT:  'gdoc_template_surat',
    BA:    'gdoc_template_surat', FCO:  'gdoc_template_surat',
    PROP:  'gdoc_template_surat', CP:   'gdoc_template_surat',
    INV:   'gdoc_template_inv',
    KWT:   'gdoc_template_kwt',
    MOU:   'gdoc_template_mou',   PKS:  'gdoc_template_mou',
    SP1:   'gdoc_template_sp',    SP2:  'gdoc_template_sp',
    SP3:   'gdoc_template_sp',    PHK:  'gdoc_template_sp',
    PKWT:  'gdoc_template_pkwt',  SPG:  'gdoc_template_pkwt',
    SMT:   'gdoc_template_pkwt',  PI:   'gdoc_template_pkwt',
  };
  var key = KEY_MAP[docType];
  if (!key) throw new Error('Tidak ada mapping template untuk: ' + docType);
  var cfId = config[key];
  if (!cfId) throw new Error(
    'Template belum dibuat. Jalankan createAllTemplates() di Apps Script terlebih dahulu.'
  );
  return cfId;
}

/**
 * Buat record untuk disimpan ke database.
 * @private
 */
function _buildRecord(input, config, docNumber, finalDoc, pdfFile, qrUrl) {
  var now = _gasNow(); // ← ISO UTC via gasUtils
  return {
    // FIX #2 — UUID v4 menggantikan 'DOC-' + Date.now() (tidak unik saat concurrent)
    id:               _gasUuid(),
    document_number:  docNumber,
    document_type:    DOCUMENT_TYPES[input.documentType]
                        ? DOCUMENT_TYPES[input.documentType].label
                        : input.documentType,
    document_code:    input.documentType,
    document_date:    input.documentDate || now.split('T')[0],
    recipient_name:   input.recipientName    || '',
    recipient_address:input.recipientAddress || '',
    subject:          input.subject,
    // FIX #3 — sanitasi attachment ke integer (bukan teks '-', 'N/A', dll.)
    attachment:       _docSanitizeAttachment(input.attachment),
    body_summary:     (input.body || '').substring(0, 200),
    status:           'FINAL',
    gdoc_url:         finalDoc.getUrl(),
    pdf_url:          pdfFile.getUrl(),
    qr_url:           qrUrl || '',
    created_by:       (input.performed_by && input.performed_by.email)
                        || Session.getActiveUser().getEmail(),
    created_at:       now, // ← ISO UTC
    updated_at:       now, // ← ISO UTC
  };
}
