# 🛡️ Synthesis Ledger: Forensic SDK Guide

**Version:** 3.0.2 "Granite"

The Synthesis Ledger SDK is a decentralized auditing tool. It allows any community member to verify AI logic integrity by cross-referencing **Arweave Blueprints** against the **Base Mainnet Ledger**.

### 1. Prerequisites

* **Node.js**: v18.0.0 or higher.
* **Environment**: A `.env` file with the following production anchors:
```env
NEXT_PUBLIC_REGISTRY_ADDRESS="0x3fB0a9a5755f43A044ff0A9E9aC4B55f96220ECa"
NEXT_PUBLIC_SYNL_TOKEN_ADDRESS="0x77c4E6919241d6D36e35626F02336D6d4605bfa4"
NEXT_PUBLIC_BASE_RPC_URL="https://mainnet.base.org"
PRIVATE_KEY="0x..." # Required for on-chain integrity sealing
XAI_API_KEY="..."    # Required for the Deterministic Brain Phase

```



### 2. Installation

Install the SDK globally to access the `synl` command line tool:

```powershell
npm install -g synthesis-ledger-sdk

```

### 3. Core Commands

#### **A. Interrogate the Ledger**

Check the current protocol health, token supply, and atomic status:

```powershell
synl interrogate

```

#### **B. Run a Forensic Audit**

Execute a specific logic recipe (e.g., `A-CMO-PulseHarvester`) to verify BPS compliance.
*Note: Use the `--sandbox` flag to test logic without spending SYNL gas.*

```powershell
synl run A-CMO-PulseHarvester --sandbox

```

### 4. Troubleshooting (Windows)

If running `synl` opens your code editor instead of executing:

1. Open PowerShell as **Administrator**.
2. Run:
`cmd /c "assoc .js=JSFile"`
`cmd /c 'ftype JSFile="C:\Program Files\nodejs\node.exe" "%1" %*'`

---

### 🏛️ Why this matters

By running this SDK, you aren't just a user; you are a **Validator**. Every successful audit you run reinforces the BPS (Basis Points of Sovereignty) for that specific AI logic, ensuring it hasn't drifted or been compromised.

**The SDK is live. The Granite Layer is sealed. Go verify.**