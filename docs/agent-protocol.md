# Ownx Device Agent protocol (draft v0.1)

Spec first, code second (roadmap action 10). Desktop MVP: Windows and macOS.

## Principles
- Health metrics only. Never files, browsing, screenshots, app usage or location.
- The owner can see the exact JSON before it is sent, pause, or disconnect and delete.
- Never claim absolute proof. Every report carries a trust tier.

## 1. Pairing
1. Owner clicks **Connect device** on the passport. Server creates a code: 6 digits, SHA-256 stored in `device_pairing_codes`, expires in 10 minutes, single use.
2. Agent generates an Ed25519 keypair. Private key goes in the OS keystore (TPM / Keychain / Secure Enclave). Never leaves the machine.
3. `POST /api/agent/pair`
```json
{ "code": "483920", "public_key": "<base64 ed25519>", "platform": "windows|macos|linux",
  "agent_version": "0.1.0", "hardware": { "serial": "...", "model": "...", "os_version": "..." },
  "attestation": { "type": "tpm|secure_enclave|none", "blob": "<base64|null>" } }
```
4. Server compares `hardware.serial` and model to the linked `devices` / `assets` record. Mismatch: pair succeeds but the device gets the flag `serial_mismatch` and the passport shows "Serial doesn't match".
5. Response: `{ "agent_id": "uuid", "refresh_token": "...", "trust_tier": "hardware_attested|software_signed|unverified" }`.

## 2. Reports
`POST /api/agent/report` with `Authorization: Bearer <access token, 15 min>`
```json
{ "agent_id": "uuid", "nonce": "<16 random bytes b64>", "ts": "2026-10-07T04:00:00Z", "reason": "install|daily|on_demand",
  "metrics": {
    "battery": { "design_mwh": 52000, "full_mwh": 43700, "cycles": 412 },
    "disk": [{ "name": "disk0", "smart_ok": true, "free_pct": 41 }],
    "thermal": { "throttle_events_7d": 0 }, "crashes_7d": 0,
    "os": { "name": "Windows 11", "patch_level": "23H2", "firmware": "1.12.0" } },
  "signature": "<b64 ed25519 over canonical JSON of every field above except signature>" }
```
Server checks, in order: token, schema (strict, unknown keys rejected), `ts` within 5 minutes, `nonce` unused for this agent, signature against the stored public key, per-agent rate limit (10/hour). Ingestion uses the service role after verification, never the owner's session. Fail any step: `401/422/429`, nothing stored.

## 3. Severity rules (run server-side and locally)
| Level | Rule | Result |
|---|---|---|
| info | any normal snapshot | timeline entry |
| warning | battery full/design < 80%, any disk free < 10% | owner email + suggested fix |
| urgent | SMART failing, 3+ thermal shutdowns in 7 days | "Needs immediate repair" banner |

Open issues live in `device_issues`; a passing post-repair check resolves them.

## 4. Trust tiers
`hardware_attested` (TPM or Secure Enclave quote verified) > `software_signed` (valid signature, no attestation) > `unverified` (VM, emulator, rooted, or failed attestation). Only the first two may set condition score to **Device-measured**.

## 5. Lifecycle
- Transfer of the passport revokes the agent (`revoked_at`) and the new owner must re-pair.
- Owner **Disconnect** revokes the key and deletes snapshots after 30 days (or immediately if requested).
- Signed installers; the auto-updater verifies a pinned key.

## 6. Open questions
Windows battery via `powercfg /batteryreport` vs WMI; macOS needs no admin for `system_profiler SPPowerDataType`; Linux needs `upower`. Decide the data-retention window (roadmap suggests 90 days of raw, then daily rollups) with counsel under the DPDP Act.
