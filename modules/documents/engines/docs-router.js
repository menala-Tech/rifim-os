(function (global) {
  'use strict';

  var state = {
    root: null,
    currentRoute: '',
    listFilters: { limit: 20, offset: 0 }
  };

  function docsApi() {
    if (!global.CrmApi || !global.CrmApi.docs) throw new Error('CrmApi.docs belum tersedia. Pastikan Prompt F sudah merged dan crmApi.js ter-load.');
    return global.CrmApi.docs;
  }

  function parseHash() {
    var hash = (global.location.hash || '#/list').replace(/^#\/?/, '');
    var parts = hash.split('?');
    var route = parts[0] || 'list';
    if (route === 'search') route = 'list';
    var params = new URLSearchParams(parts[1] || '');
    var query = {};
    params.forEach(function (value, key) { query[key] = value; });
    return { route: route, query: query };
  }

  async function loadFragment(route) {
    state.root.innerHTML = global.DocsRenderer.skeleton();
    var response = await fetch('/modules/documents/pages/' + route + '.html');
    if (!response.ok) throw new Error('Halaman tidak ditemukan: ' + route);
    state.root.innerHTML = await response.text();
  }

  function setActiveTab(route) {
    document.querySelectorAll('[data-route]').forEach(function (link) {
      var key = link.getAttribute('data-route');
      link.classList.toggle('active', key === route || (key === 'search' && route === 'list'));
    });
  }

  function formValues(form) {
    var data = {};
    Array.prototype.slice.call(new FormData(form).entries()).forEach(function (entry) {
      if (entry[1] !== '') data[entry[0]] = entry[1];
    });
    return data;
  }

  function assertJson(textarea, statusEl) {
    try {
      var parsed = JSON.parse(textarea.value || '{}');
      statusEl.textContent = 'JSON valid.';
      statusEl.className = 'hint ok';
      return parsed;
    } catch (err) {
      statusEl.textContent = 'JSON tidak valid: ' + err.message;
      statusEl.className = 'hint err';
      throw err;
    }
  }

  async function renderList(query) {
    await loadFragment('list');
    setActiveTab('list');
    var form = document.getElementById('doc-list-filter');
    var result = document.getElementById('doc-list-result');
    Object.keys(query || {}).forEach(function (key) {
      if (form.elements[key]) form.elements[key].value = query[key];
    });

    async function refresh() {
      result.innerHTML = global.DocsRenderer.skeleton();
      try {
        var filters = Object.assign({ limit: 20, offset: 0 }, formValues(form));
        state.listFilters = filters;
        var data = await docsApi().list(filters);
        result.innerHTML = global.DocsRenderer.renderDocumentTable(data);
        result.querySelectorAll('[data-doc-id]').forEach(function (row) {
          row.addEventListener('click', function () {
            global.location.hash = '#/detail?id=' + encodeURIComponent(row.getAttribute('data-doc-id'));
          });
        });
      } catch (err) {
        result.innerHTML = global.DocsRenderer.empty('Gagal memuat dokumen.');
        global.DocsRenderer.toast(err.message, 'err');
      }
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      refresh();
    });
    await refresh();
  }

  async function renderDetail(query) {
    await loadFragment('detail');
    setActiveTab('list');
    var id = query.id || query.documentId;
    var wrap = document.getElementById('doc-detail');
    if (!id) {
      wrap.innerHTML = global.DocsRenderer.empty('Document ID kosong.');
      return;
    }

    try {
      var api = docsApi();
      var detail = await api.get(id);
      var documentRow = detail.document || detail.doc || detail;
      var revision = detail.revision || detail.current_revision || {};
      var revisions = await api.revisions(id);
      var audits = await api.audit({ entityType: 'document', entityId: id, limit: 20 }).catch(function () { return []; });
      var approvals = detail.approvals || documentRow.approvals || revision.approvals || [];

      wrap.innerHTML = '<section class="detail-header"><div><h2>' + global.DocsRenderer.escapeHtml(documentRow.title || 'Untitled') + '</h2>' +
        '<p class="muted mono">' + global.DocsRenderer.escapeHtml(documentRow.doc_number || id) + '</p></div><div>' + global.DocsRenderer.statusPill(documentRow.status) + '</div></section>' +
        '<div class="meta-grid"><div><span>Company</span><strong>' + global.DocsRenderer.escapeHtml(documentRow.company_slug || '—') + '</strong></div><div><span>Type</span><strong>' + global.DocsRenderer.escapeHtml(documentRow.doc_type || '—') + '</strong></div><div><span>Current Revision</span><strong>' + global.DocsRenderer.escapeHtml(documentRow.current_revision_id || revision.id || '—') + '</strong></div></div>' +
        '<section class="section-card"><div class="section-title"><h3>Revision Timeline</h3><a class="btn small ghost" href="#/revise?id=' + encodeURIComponent(id) + '">Buat Revisi</a></div>' + global.DocsRenderer.renderRevisionTimeline(revisions || []) + '</section>' +
        '<section class="section-card"><h3>Approval Progress</h3>' + global.DocsRenderer.renderApprovalProgress(approvals) + '</section>' +
        '<section class="section-card"><h3>Audit Trail</h3>' + global.DocsRenderer.renderAuditTable(audits || []) + '</section>';

      wrap.querySelectorAll('[data-diff-a]').forEach(function (button) {
        button.addEventListener('click', async function () {
          try {
            var diff = await api.revisionDiff(button.getAttribute('data-diff-a'), button.getAttribute('data-diff-b'));
            alert(JSON.stringify(diff, null, 2));
          } catch (err) {
            global.DocsRenderer.toast(err.message, 'err');
          }
        });
      });
    } catch (err) {
      wrap.innerHTML = global.DocsRenderer.empty('Gagal memuat detail dokumen.');
      global.DocsRenderer.toast(err.message, 'err');
    }
  }

  async function renderCreate() {
    await loadFragment('create');
    setActiveTab('create');
    var form = document.getElementById('doc-create-form');
    var textarea = form.elements.payload;
    var status = document.getElementById('payload-status');
    textarea.addEventListener('blur', function () {
      try { assertJson(textarea, status); } catch (err) {}
    });
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      try {
        var payload = assertJson(textarea, status);
        var data = await docsApi().create({
          companySlug: form.elements.companySlug.value.trim(),
          docType: form.elements.docType.value.trim(),
          title: form.elements.title.value.trim(),
          payload: payload
        });
        global.DocsRenderer.toast('Dokumen berhasil dibuat.', 'ok');
        var id = data.id || data.documentId;
        global.location.hash = id ? '#/detail?id=' + encodeURIComponent(id) : '#/list';
      } catch (err) {
        global.DocsRenderer.toast(err.message, 'err');
      }
    });
  }

  async function renderInbox() {
    await loadFragment('inbox');
    setActiveTab('inbox');
    var list = document.getElementById('doc-inbox-list');
    async function refresh() {
      list.innerHTML = global.DocsRenderer.skeleton();
      try {
        var rows = await docsApi().pending();
        list.innerHTML = global.DocsRenderer.renderInboxCards(rows || []);
        list.querySelectorAll('[data-open-decision]').forEach(function (button) {
          button.addEventListener('click', function (event) {
            var card = event.target.closest('[data-approval-id]');
            var approvalId = card.getAttribute('data-approval-id');
            global.DocsRenderer.showDecisionModal(approvalId, async function (decision, comment) {
              try {
                await docsApi().decide({ approvalId: approvalId, decision: decision, comment: comment });
                global.DocsRenderer.toast('Keputusan approval tersimpan.', 'ok');
                refresh();
              } catch (err) {
                global.DocsRenderer.toast(err.message, 'err');
              }
            });
          });
        });
      } catch (err) {
        list.innerHTML = global.DocsRenderer.empty('Gagal memuat inbox approval.');
        global.DocsRenderer.toast(err.message, 'err');
      }
    }
    document.getElementById('refresh-inbox').addEventListener('click', refresh);
    await refresh();
  }

  async function renderRevise(query) {
    await loadFragment('revise');
    setActiveTab('list');
    var id = query.id || query.documentId;
    var form = document.getElementById('doc-revise-form');
    var textarea = form.elements.payload;
    var status = document.getElementById('revise-payload-status');
    form.elements.documentId.value = id || '';
    document.getElementById('revise-back').href = id ? '#/detail?id=' + encodeURIComponent(id) : '#/list';

    if (id) {
      try {
        var detail = await docsApi().get(id);
        var revision = detail.revision || detail.current_revision || {};
        textarea.value = JSON.stringify(revision.payload || {}, null, 2);
      } catch (err) {
        global.DocsRenderer.toast(err.message, 'err');
      }
    }

    textarea.addEventListener('blur', function () {
      try { assertJson(textarea, status); } catch (err) {}
    });
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      try {
        var payload = assertJson(textarea, status);
        await docsApi().revise({ documentId: form.elements.documentId.value, payload: payload });
        global.DocsRenderer.toast('Revisi berhasil dibuat.', 'ok');
        global.location.hash = '#/detail?id=' + encodeURIComponent(form.elements.documentId.value);
      } catch (err) {
        global.DocsRenderer.toast(err.message, 'err');
      }
    });
  }

  async function renderPage() {
    var parsed = parseHash();
    state.currentRoute = parsed.route;
    try {
      if (parsed.route === 'detail') return renderDetail(parsed.query);
      if (parsed.route === 'create') return renderCreate(parsed.query);
      if (parsed.route === 'inbox') return renderInbox(parsed.query);
      if (parsed.route === 'revise') return renderRevise(parsed.query);
      return renderList(parsed.query);
    } catch (err) {
      state.root.innerHTML = global.DocsRenderer.empty(err.message || 'Gagal memuat halaman.');
      global.DocsRenderer.toast(err.message, 'err');
    }
  }

  global.DocsRouter = {
    init: function (options) {
      state.root = options.root;
      global.addEventListener('hashchange', renderPage);
      global.addEventListener('docs-updated', function () {
        if (state.currentRoute === 'list' || state.currentRoute === 'inbox') renderPage();
      });
      if (!global.location.hash) global.location.hash = '#/list';
      return renderPage();
    },
    renderPage: renderPage
  };
})(window);
