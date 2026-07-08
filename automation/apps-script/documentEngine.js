/**
 * RIFIM OS — Document Engine
 * Engine utama untuk generate semua jenis dokumen perusahaan.
 *
 * Prinsip: satu fungsi GenerateDocument() untuk semua jenis dokumen.
 * Tidak ada GenerateSurat(), GenerateInvoice() terpisah.
 */

// Import dari engine lain (di GAS semua file dalam satu project)
// numberingEngine.js   → generateDocumentNumber()
// placeholderEngine.js → replacePlaceholders(), buildPlaceholderData()
// driveManager.js      → saveDocument(), getTemplateCopy()
// pdfEngine.js         → exportToPDF()
// databaseLayer.js     → saveDocumentRecord()
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
 *   input.attachment      {string} - Lampiran
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

    const config     = getCompanyConfig();
    const docNumber  = generateDocumentNumber(input.documentType);
    const templateId = _getTemplateId(input.documentType, config);
    const docCopy    = getTemplateCopy(templateId, docNumber);
    const data       = buildPlaceholderData(input, config, docNumber);

    replacePlaceholders(docCopy.getId(), data);

    const finalDoc   = saveDocument(docCopy, input.documentType, docNumber);
    const pdfFile    = exportToPDF(finalDoc.getId(), docNumber);
    const record     = _buildRecord(input, config, docNumber, finalDoc, pdfFile);

    saveDocumentRecord(record);

    return {
      success:        true,
      documentNumber: docNumber,
      gdocUrl:        finalDoc.getUrl(),
      pdfUrl:         pdfFile.getUrl(),
      message:        'Dokumen berhasil dibuat: ' + docNumber,
    };

  } catch (err) {
    console.error('DocumentEngine Error:', err.message);
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
  if (!input)                 throw new Error('Input tidak boleh kosong.');
  if (!input.documentType)    throw new Error('documentType diperlukan.');
  if (!input.recipientName)   throw new Error('recipientName diperlukan.');
  if (!input.subject)         throw new Error('subject (perihal) diperlukan.');
  if (!input.body)            throw new Error('body (isi dokumen) diperlukan.');
}

/**
 * Ambil Template Google Doc ID berdasarkan jenis dokumen.
 * Template ID disimpan di company_config, bukan hardcoded.
 * @private
 */
function _getTemplateId(docType, config) {
  const key = 'TEMPLATE_ID_' + docType;
  const id  = config[key];
  if (!id) throw new Error('Template ID tidak ditemukan untuk: ' + docType + '. Set ' + key + ' di company_config.');
  return id;
}

/**
 * Buat record untuk disimpan ke database.
 * @private
 */
function _buildRecord(input, config, docNumber, finalDoc, pdfFile) {
  return {
    id:              'DOC-' + Date.now(),
    document_number: docNumber,
    document_type:   input.documentType,
    document_date:   input.documentDate || new Date().toISOString().split('T')[0],
    recipient_name:  input.recipientName,
    recipient_address: input.recipientAddress || '',
    subject:         input.subject,
    body:            input.body,
    attachment:      input.attachment || '-',
    status:          'FINAL',
    gdoc_url:        finalDoc.getUrl(),
    pdf_url:         pdfFile.getUrl(),
    created_by:      Session.getActiveUser().getEmail(),
    created_at:      new Date().toISOString(),
    updated_at:      new Date().toISOString(),
  };
}
