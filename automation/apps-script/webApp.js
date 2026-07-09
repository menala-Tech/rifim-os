/**
 * RIFIM OS — Web App Entry Point
 * Deploy sebagai GAS Web App agar dashboard Vercel bisa call engine.
 *
 * Cara deploy:
 * 1. Apps Script → Deploy → New Deployment → Web App
 * 2. Execute as: Me
 * 3. Who has access: Anyone
 * 4. Copy Web App URL → paste ke GAS_WEB_APP_URL di dashboard index.html
 */

/**
 * Handle POST dari dashboard.
 * Content-Type: text/plain dipakai di frontend untuk skip CORS preflight.
 *
 * Body JSON:
 * {
 *   documentType: 'INV',
 *   subject:      'Tagihan Jasa Promosi',
 *   attachment:   '-',
 *   documentDate: '2026-07-09',
 *   directorName: 'BOBBY RAHMAN M.B',
 *   directorTitle: 'Direktur Utama',
 *   extra: { client_name: 'PT. Maxim', items: '...', ... }
 * }
 */
function doPost(e) {
  try {
    const input  = JSON.parse(e.postData.contents);
    const result = generateDocument(input);

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: 'Server error: ' + err.message,
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET — health check & info.
 */
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action === 'peek') {
    const code = e.parameter.code || 'SURAT';
    try {
      const nextNum = peekNextDocumentNumber(code);
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, nextNumber: nextNum }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'auth') {
    try {
      var email  = ((e.parameter.email || '').toLowerCase()).trim();
      var config = getCompanyConfig();

      // Bangun daftar email yang diizinkan:
      // 1. company_email (email utama perusahaan)
      // 2. allowed_emails (daftar tambahan, dipisah koma di Google Sheets)
      var allowedList = [];
      if (config.company_email) {
        allowedList.push(config.company_email.toLowerCase().trim());
      }
      if (config.allowed_emails) {
        config.allowed_emails.split(',').forEach(function(e) {
          var trimmed = e.toLowerCase().trim();
          if (trimmed) allowedList.push(trimmed);
        });
      }

      if (email && allowedList.indexOf(email) > -1) {
        return ContentService
          .createTextOutput(JSON.stringify({
            success: true,
            user: {
              name:  config.director_name  || 'Bobby Rahman M.B',
              role:  config.director_title || 'Direktur Utama',
              email: email,
            },
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: 'Email tidak diizinkan.' }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'arsip') {
    try {
      const options = {
        status: e.parameter.status || 'ALL',
        search: e.parameter.search || '',
        page:   e.parameter.page   || 1,
        limit:  e.parameter.limit  || 100,
      };
      const result = getDocumentList(options);
      return ContentService
        .createTextOutput(JSON.stringify(Object.assign({ success: true }, result)))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Default: health check
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      app:     'RIFIM OS Smart Office',
      version: '1.0.0',
      status:  'running',
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
