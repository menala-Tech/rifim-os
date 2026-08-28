/**
 * Canonical server-side Supabase env resolver.
 *
 * Problem (2026-08-29 Preview UAT):
 *   Frontend on Preview correctly targets QA Supabase (cdlkujllqnrurgecoaur)
 *   because portal-session.js switches on location.hostname. But every
 *   backend serverless handler read process.env.SUPABASE_URL blindly, so a
 *   QA-issued JWT was posted to the PROD project's /auth/v1/user and got
 *   401 -> handler threw "Session invalid" -> frontend showed the red
 *   error card. Vercel Preview env still pointing at PROD Supabase is a
 *   config mistake, but code that hard-trusts one env var and cannot be
 *   overridden per-environment is the second half of the bug.
 *
 * Fix:
 *   ONE helper decides project identity per request. Preference order:
 *     1. VERCEL_ENV === 'preview'  AND SUPABASE_URL_QA is set     -> QA
 *        (Vercel automatically sets VERCEL_ENV. Owner sets *_QA vars once
 *         in the Vercel dashboard's Preview environment.)
 *     2. Any explicit override the caller passes (unused today; hook for
 *        multi-tenant tests).
 *     3. Default: SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY /
 *        SUPABASE_SERVICE_ROLE_KEY (existing PROD behavior).
 *
 *   This preserves 100% of Production behavior when no QA vars are set,
 *   and eliminates cross-project auth on Preview once the owner adds the
 *   three *_QA vars scoped to Preview only.
 *
 * NOT a hostname hack. VERCEL_ENV is Vercel's own canonical environment
 * indicator. request.headers.host is never read here.
 */
'use strict';

function env(name) { return String(process.env[name] || '').trim(); }

function isPreviewEnv() {
  // VERCEL_ENV is set by Vercel to one of: 'production', 'preview', 'development'.
  // Anything other than 'production' with QA overrides available means Preview/dev.
  const ve = env('VERCEL_ENV').toLowerCase();
  return ve === 'preview' || ve === 'development';
}

function haveQaOverrides() {
  return !!(env('SUPABASE_URL_QA') && env('SUPABASE_PUBLISHABLE_KEY_QA') && env('SUPABASE_SERVICE_ROLE_KEY_QA'));
}

function resolve() {
  if (isPreviewEnv() && haveQaOverrides()) {
    return {
      url: env('SUPABASE_URL_QA'),
      publishable: env('SUPABASE_PUBLISHABLE_KEY_QA'),
      service: env('SUPABASE_SERVICE_ROLE_KEY_QA'),
      target: 'qa',
    };
  }
  return {
    url: env('SUPABASE_URL'),
    publishable: env('SUPABASE_PUBLISHABLE_KEY'),
    service: env('SUPABASE_SERVICE_ROLE_KEY'),
    target: 'default',
  };
}

/**
 * Typed auth errors -> HTTP status. Handlers catch and use httpStatusFor()
 * so /api/internal/hris-v2 stops mis-classifying every auth failure as 400.
 */
class AuthMissingError extends Error {
  constructor(msg) { super(msg || 'Session required'); this.httpStatus = 401; this.code = 'auth_missing'; }
}
class AuthInvalidError extends Error {
  constructor(msg) { super(msg || 'Session invalid'); this.httpStatus = 401; this.code = 'auth_invalid'; }
}
class RoleForbiddenError extends Error {
  constructor(msg) { super(msg || 'Role tidak diizinkan'); this.httpStatus = 403; this.code = 'role_forbidden'; }
}
class BadInputError extends Error {
  constructor(msg) { super(msg || 'Input tidak valid'); this.httpStatus = 400; this.code = 'bad_input'; }
}

/**
 * Best-effort classifier for legacy string-throw handlers. Recognizes the
 * exact error messages the pre-hotfix handlers used so we don't have to
 * refactor 100+ throw sites. New code should throw the typed classes above.
 */
function httpStatusFor(err) {
  if (err && Number.isInteger(err.httpStatus)) return err.httpStatus;
  const msg = String(err && err.message || err || '').toLowerCase();
  if (/session required/.test(msg)) return 401;
  if (/session invalid|session tidak valid|token invalid|profil tidak aktif/.test(msg)) return 401;
  if (/hanya admin|role tidak boleh|role view-only|tidak diizinkan|hanya admin\/direksi/.test(msg)) return 403;
  if (/supabase server env missing|aist handoff secret missing/.test(msg)) return 500;
  return 400;
}

module.exports = { env, resolve, isPreviewEnv, haveQaOverrides, httpStatusFor, AuthMissingError, AuthInvalidError, RoleForbiddenError, BadInputError };
