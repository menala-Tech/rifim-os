# Finance Canonical Target Prorate — 2026-08-20

Canonical equal-share rule for Target Cabang / Target Staff:

1. Person override (`raos_kpi_targets_staff`) wins.
2. Branch default (`raos_kpi_targets_branch.target_staff_default`) is second.
3. Otherwise derive equal-share from branch target divided by active target-bearing people.
4. Target-bearing people are active Staff + Koordinator.
5. Derived equal-share uses `Math.ceil`, matching RAOS canonical KPI RPCs (`raos_saldo_kpi_snapshot` / `raos_order_kpi_snapshot`).

This removes the prior Finance-only `Math.floor` discrepancy (for example Batam Rp110,000,000 / 7 and Makassar 5,000 / 12).
