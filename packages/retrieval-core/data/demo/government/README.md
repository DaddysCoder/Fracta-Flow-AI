# Government demo corpus

Eight synthetic, Australian-spelling public sector documents for demoing the
workspace against government-style content (e.g. a DTA "AI in Government"
showcase). All content is fictional — the fictitious "Fictional Department of
Digital Services (FDDS)" — and each file is clearly marked as synthetic in
its body text. No real government or personal data is included.

There is no baked-in NDIS demo corpus in this repository either — NDIS-style
content normally reaches the workspace the same way any company document
does, via the Documents upload screen (`/documents`), or via the regulatory
crawler/import pipeline in `tools/crawler/` and `src/lib/regulatory.ts` for
real published sources. These files follow that same pattern: upload them
through the Documents screen (or point a local import script at this folder)
to seed a demo workspace. They are not auto-loaded at build or server start.

Files:
- information-security-policy.txt
- procurement-and-contract-management-procedure.txt
- staff-induction-and-training-guide.txt
- records-management-policy.txt
- privacy-and-personal-information-procedure.txt
- delegations-and-approval-authority-guide.txt
- incident-and-data-breach-response-procedure.txt
- grants-administration-procedure.txt

## Automated seeding

`scripts/seed-demo-government.mjs` automates the "point a local import
script at this folder" option mentioned above. It drives the real app HTTP
API (setup/login, then the same multipart upload endpoint the Documents
screen uses), so every file lands in `needs_review` first, exactly like a
manual upload, and is only optionally approved afterwards via the normal
approve endpoint. It never touches the database directly.

```
BASE_URL=http://localhost:3000 \
ADMIN_PASSWORD='a-strong-passphrase' \
node scripts/seed-demo-government.mjs
```

See the comment header at the top of that script for the full list of env
vars (`SETUP_TOKEN` for non-local hosts, `APPROVE=0` to leave documents in
`needs_review` only, `DEMO_DIR` to point at a different folder). Re-running
the script is safe — it skips any file whose name already exists in the
workspace.
