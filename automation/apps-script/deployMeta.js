/**
 * DEPLOY META — auto-overwritten by .github/workflows/deploy-gas.yml before
 * `clasp push`. The placeholder values below are what a local `clasp push`
 * would ship if a developer ran it by hand; CI replaces them with the actual
 * commit SHA + push timestamp so `finance_ping` can report the currently
 * running deployment. Never edit these by hand -- the CI job rewrites the
 * file every push and any local edit would be overwritten anyway.
 *
 * The values are read by `finance_ping` in crmApi.js. If the constants below
 * differ from what `git rev-parse HEAD` returns on `main`, the CI verify job
 * concludes the Apps Script Web App is running a stale version and fails the
 * build so a human can investigate.
 */
var DEPLOY_META = {
  version: 'local-dev',
  deployed_at: '1970-01-01T00:00:00Z',
};
