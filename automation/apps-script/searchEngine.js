/**
 * RIFIM OS — Search Engine
 * Full-text search dokumen di doc_documents + doc_revisions.payload.
 *
 * OWNER TASK: Codex (branch: codex/search-engine)
 *
 * Strategi awal (v1): PostgREST filter `or=(title.ilike.*q*,doc_number.ilike.*q*)`
 * digabung filter jsonb payload `.metadata @> '{"key":"value"}'`. Cukup untuk
 * dataset <10k doc.
 *
 * Strategi lanjut (v2, opsional — tunggu volume): bikin materialized view
 * doc_search_index dengan tsvector; refresh via cron/GAS trigger.
 * Kalau butuh MV, minta Claude yang bikin migration — Codex jangan touch
 * migrations.
 *
 * Kontrak fungsi:
 *
 *   searchDocuments({
 *     query        : string,          // free text
 *     companySlug  : string?,
 *     docType      : string?,
 *     status       : doc_status?,
 *     from         : ISO date?,
 *     to           : ISO date?,
 *     limit        : int  (default 20, max 100),
 *     offset       : int  (default 0),
 *   }) → {
 *     total   : int,
 *     results : [
 *       { id, title, doc_number, company_slug, doc_type, status,
 *         current_revision_id, created_at,
 *         snippet : string  // potongan match dari title/metadata
 *       }, ...
 *     ]
 *   }
 *
 * Aturan:
 *   - Escape wildcards `%_*` di query sebelum inject ke ilike.
 *   - Kalau query kosong tapi filter (company/status/date) diisi, tetap valid.
 *   - Log pencarian ke system_log LEVEL=DEBUG (opsional, buat analitik dulu).
 */

function searchDocuments(input) {
  input = input || {};

  var query = String(input.query || '').trim();
  var limit = Number(input.limit || 20);
  var offset = Number(input.offset || 0);
  if (!isFinite(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100;
  if (!isFinite(offset) || offset < 0) offset = 0;

  var params = [
    'select=id,title,doc_number,company_slug,doc_type,status,current_revision_id,created_at',
  ];

  if (query) {
    var escapedQuery = encodeURIComponent(_searchEscLike(query));
    params.push('or=(title.ilike.*' + escapedQuery + '*,doc_number.ilike.*' + escapedQuery + '*)');
  }
  if (input.companySlug) {
    params.push('company_slug=eq.' + encodeURIComponent(input.companySlug));
  }
  if (input.docType) {
    params.push('doc_type=eq.' + encodeURIComponent(input.docType));
  }
  if (input.status) {
    params.push('status=eq.' + encodeURIComponent(input.status));
  }
  if (input.from) {
    params.push('created_at=gte.' + encodeURIComponent(input.from));
  }
  if (input.to) {
    params.push('created_at=lte.' + encodeURIComponent(input.to));
  }
  params.push('order=created_at.desc');
  params.push('limit=' + limit);
  params.push('offset=' + offset);

  var searchResult = _searchSbGetWithCount(_searchRestUrl('doc_documents', params));
  var rows = searchResult.rows || [];
  return {
    total: searchResult.total,
    results: rows.map(function (row) {
      return {
        id: row.id,
        title: row.title,
        doc_number: row.doc_number,
        company_slug: row.company_slug,
        doc_type: row.doc_type,
        status: row.status,
        current_revision_id: row.current_revision_id,
        created_at: row.created_at,
        snippet: _searchBuildSnippet(row, query),
      };
    }),
  };
}

function _searchEscLike(s) {
  return String(s || '').replace(/[\\%_*]/g, function (ch) {
    return '\\' + ch;
  });
}

function _searchSbGetWithCount(url) {
  var rows = _sbGet(url);
  var fallbackTotal = rows.length;
  var total = fallbackTotal;

  try {
    total = _searchSbHeadCount(url, fallbackTotal);
  } catch (headErr) {
    try {
      total = _searchSbAggregateCount(url, fallbackTotal);
    } catch (aggregateErr) {
      total = fallbackTotal;
    }
  }

  return { rows: rows, total: total };
}

function _searchSbHeadCount(url, fallback) {
  var cfg = _getSupabaseConfig();
  var res = UrlFetchApp.fetch(url, {
    method: 'HEAD',
    headers: _sbHeaders(cfg.key, 'count=exact'),
    muteHttpExceptions: true,
  });
  _searchCheckResponse(res, 'HEAD ' + url);
  return _searchParseContentRangeTotal(res, fallback);
}

function _searchSbAggregateCount(url, fallback) {
  var rows = _sbGet(_searchCountAggregateUrl(url));
  if (!rows || !rows.length || rows[0].count === undefined) return fallback;
  var total = Number(rows[0].count);
  return isFinite(total) ? total : fallback;
}

function _searchCountAggregateUrl(url) {
  var parts = String(url).split('?');
  var query = parts[1] || '';
  var params = query ? query.split('&') : [];
  var filters = params.filter(function (param) {
    return !/^(select|order|limit|offset)=/.test(param);
  });
  filters.unshift('select=count()');
  return parts[0] + '?' + filters.join('&');
}

function _searchParseContentRangeTotal(res, fallback) {
  var headers = res.getAllHeaders ? res.getAllHeaders() : res.getHeaders();
  var contentRange = headers['Content-Range'] || headers['content-range'] || '';
  var match = String(contentRange).match(/\/(\d+|\*)$/);
  if (match && match[1] !== '*') return Number(match[1]);
  return fallback;
}

function _searchBuildSnippet(row, query) {
  var title = String(row.title || '');
  var docNumber = String(row.doc_number || '');
  if (!query) return title.substring(0, 120);

  var needle = String(query).toLowerCase();
  var titleIndex = title.toLowerCase().indexOf(needle);
  if (titleIndex !== -1) return title.substring(0, 120);

  var docNumberIndex = docNumber.toLowerCase().indexOf(needle);
  if (docNumberIndex !== -1) {
    var start = Math.max(0, docNumberIndex - 40);
    var end = Math.min(docNumber.length, docNumberIndex + needle.length + 80);
    return docNumber.substring(start, end);
  }

  return title.substring(0, 120);
}

function _searchRestUrl(table, params) {
  var cfg = _getSupabaseConfig();
  return cfg.url + '/rest/v1/' + table + (params && params.length ? '?' + params.join('&') : '');
}

function _searchCheckResponse(res, context) {
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error(context + ' — HTTP ' + code + ': ' + res.getContentText().substring(0, 200));
  }
}
