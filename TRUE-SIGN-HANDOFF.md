# TrueSign — implementation and verification handoff

## Project scope confirmed from the uploaded archive
- React + TypeScript + Vite frontend
- Java + Spring Boot + Web3j backend
- Solidity contracts tested with Foundry; local Ethereum-compatible Anvil network (chain ID 31337)
- SQLite persistence
- No Quai integration is present in this archive.

## Important findings from source inspection

1. `ProofController.attachExecution` checks transaction-hash syntax, transaction existence and receipt presence, then attaches the receipt. It does **not** fetch and compare the mined transaction's sender, `to`, `value`, calldata, chain, or Safe execution envelope with the passport proposal. A mined receipt therefore proves the outcome of that hash, not that the passport's intended payment was executed. Do not present it as a matched payment until that binding is implemented and tested.
2. `AttackSimulationService` has all eight scenario IDs. `AMOUNT_MANIPULATION`, `UNAUTHORIZED_TARGET`, and `SELECTOR_MANIPULATION` are synthetic comparisons against stored constraints; `NONCE_REPLAY` reads the Safe transaction hash/nonce; `BASELINE_EVM_CALL` calls the stored target. `RECIPIENT_MANIPULATION`, `UNAUTHORIZED_EXECUTION`, and `GUARD_BYPASS` explicitly return `INCONCLUSIVE`. The current service states it is read-only and does not sign or broadcast. These results are not eight complete on-chain exploit tests.
3. The verification flow aggregates three verifier results and creates a proof bundle/history record. Aggregating three application verifier results is not, by itself, cryptographic proof of three independent attestations or proof that the deployed Guard validates those signatures.
4. The ZIP stores Windows-style backslash entry names. It has been normalized during extraction for inspection; the original ZIP is preserved as uploaded.
5. Frontend build was not verified in this environment because dependencies were not installed. Maven wrapper execution could not be run in this Linux environment because the uploaded Windows wrapper uses CRLF and its `.cmd` form is Windows-only. No test is represented as passing unless actually executed.

## Run checks on Windows

Open PowerShell in the extracted project root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\TrueSign-Run-All.ps1 -InstallDependencies
```

Prerequisites: Node.js/npm, JDK compatible with the project's `pom.xml`, Foundry (`forge`), and (optionally) Anvil. The script runs frontend build/lint, backend Maven tests, Foundry tests, and checks whether Anvil RPC is reachable on port 8545. It writes `truesign-test-report.txt`.

For an RPC-only check against a different local URL:

```powershell
.\TrueSign-Run-All.ps1 -RpcUrl http://127.0.0.1:8545
```

## End-to-end validation still required

The runner is a build/test harness, not a claim that the complete requested E2E scenarios pass. A full E2E run needs a live Anvil instance, fresh contract deployment, backend and frontend running, and test fixtures that create a passport and perform Safe/Guard operations. It must validate:

- GREEN, AMBER, RED, and INCONCLUSIVE with stored verification history and proof contents.
- Verifier/attestation signatures against the actual deployed Guard's expected digest, signer set, threshold, expiry, chain ID, Safe address, and passport hash.
- Successful and reverted mined receipts, pending hashes, unknown hashes, RPC outage, and explicit mismatch rejection. Receipt matching must decode Safe `execTransaction` calldata when the outer transaction is sent to the Safe; simply comparing outer `to` with the passport's target is insufficient.
- Eight scenario results with explicit evidence. For recipient mutation, unauthorized execution, and Guard bypass, use isolated test fixtures and `eth_call`/reverts or Foundry tests; never sign or broadcast attack transactions.

Do not use real funds, mainnet RPC, or production private keys for these tests. Use Anvil's disposable test accounts only.
