# P8 production reconciliation — 2026-08-10

> ALREADY APPLIED TO PRODUCTION ON 2026-08-10  
> DO NOT REAPPLY MANUALLY  
> repository reconciliation only

## Canonical P8 CRM/GAS source

The retained P8 V2 production-cutover source for `automation/apps-script/crmApi.js` has:

- SHA-256: `a54e13c48fb3a1b910b1f3e17ceffde7ee65f5201305b1dcae781688d88a6c64`
- JavaScript syntax validation: `node --check` PASS
- Read roles: `admin`, `management`, `direksi`, `direktur`
- Write roles: `admin`, `direksi`, `direktur`
- Privileged CRM/Finance/HRIS proxy calls: POST-only
- Actor identity: verified Supabase access token; caller-supplied email is not trusted
- Protected HRIS/SSoT identity fields are not directly writable from CRM
- RAOS credential reset uses the P8 bcrypt-safe path; plaintext credential write is not canonical

## Production contract

- Management: read-only
- Koordinator: read-only and branch scoped where applicable
- Admin/Direksi/Direktur: mutation authority according to the P8 role matrix
- GAS was already manually redeployed during the P8 cutover; this reconciliation must not trigger another GAS deployment.

## Repository note

The canonical P8 V2 source package is the frozen source-of-truth used for checksum comparison. This file records the production contract and exact source checksum so repository drift is detectable without applying any database migration or redeploying GAS.
