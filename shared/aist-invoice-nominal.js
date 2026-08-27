/**
 * Canonical invoice rounding for AIST / RIFIM Finance saldo.
 *
 * Saldo request is always RAW; invoice is a separate rounded label.
 * This map is the single source for the rounding rule.
 */

const INVOICE_ROUND = {
  45000: 50000,
  95000: 100000,
  140000: 150000,
  145000: 150000,
  190000: 200000,
  195000: 200000,
};

function invoiceNominal(raw) {
  const n = Number(raw) || 0;
  return INVOICE_ROUND[n] || n;
}

module.exports = { INVOICE_ROUND, invoiceNominal };
