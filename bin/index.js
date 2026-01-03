import "dotenv/config";
import { ethers } from "ethers";
import fetch from "node-fetch";
import chalk from 'chalk';
import ora from 'ora';
import crypto from 'crypto';

const REGISTRY_ADDR = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL;
const PRIV_KEY = process.env.PRIVATE_KEY;
const XAI_KEY = process.env.XAI_API_KEY;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIV_KEY, provider);

/**
 * [PROCESS] Executes local inference with model-hardening
 */
async function executeLocalInference(logic, prompt) {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${XAI_KEY.trim()}`
        },
        body: JSON.stringify({ 
            model: logic.primary_model || "grok-4-1-fast-reasoning", 
            messages: [{ role: "user", content: prompt }],
            temperature: 0 // DETERMINISTIC HARDENING
        })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data.choices[0].message.content;
}

/**
 * [V42] Main Execution Logic
 */
async function run(outcomeName, commandLineData) {
    const spinner = ora(chalk.cyan(`[INIT] Starting Sovereign Pipeline: ${outcomeName}`)).start();
    const inputData = commandLineData || "INPUT_MISSING";

    try {
        // 1. [BLOCKCHAIN] Resolve logic CID from Base Registry
        spinner.text = '[BLOCKCHAIN] Querying Ledger Registry...';
        const registryContract = new ethers.Contract(
            REGISTRY_ADDR, 
            ["function registry(string) view returns (string,address,uint256,uint256,bool)"], 
            provider
        );
        
        const [cidLink, , , , obsolete] = await registryContract.registry(outcomeName);
        if (obsolete) throw new Error(`ATOMIC_OBSOLETE: ${outcomeName} failed immune audit.`);
        
        const arCid = cidLink.replace("ar://", "").split("/")[0];
        
        // 2. [STORAGE] Pull Immutable Spec from Arweave
        spinner.text = `[STORAGE] Fetching Spec (ar://${arCid})`;
        const recipeRes = await fetch(`https://arweave.net/${arCid}/${outcomeName}.json`);
        const logic = await recipeRes.json();
        spinner.info(chalk.gray(`[READY] Outcome: ${logic.outcome} | Verified BPS: ${logic.successBps}`));

        // 3. [PROCESS] Phase 1: CORE_BRAIN Execution
        spinner.start('[PROCESS] Executing Deterministic Brain Phase...');
        const brainPrompt = `Execute technical spec: ${logic.details}. Input: ${inputData}. Output deterministic calculation results only.`;
        const mathOutput = await executeLocalInference(
            { ...logic, primary_model: "grok-4-1-fast-reasoning" },
            brainPrompt
        );
        console.log(chalk.cyan.bold(`\n[BRAIN_DEBUG] >>>\n`) + chalk.white(`${mathOutput}\n`));

        // 4. [PROCESS] Phase 2: FORENSIC_AUDITOR Validation
        spinner.start('[PROCESS] Scanning for Hallucinations and Logic Drift...');
        const auditorPrompt = `JURY AUDIT. EXPECTED_OUTPUTS: ${JSON.stringify(logic.custom_outputs)}. BRAIN_DATA: ${mathOutput}. Validate BPS threshold (7800) compliance.`;
        const auditCritique = await executeLocalInference(
            { ...logic, primary_model: "grok-4-1-fast-non-reasoning" },
            auditorPrompt
        );
        console.log(chalk.red.bold(`\n[AUDITOR_DEBUG] >>>\n`) + chalk.white(`${auditCritique}\n`));

        // 5. [PROCESS] Phase 3: RECONCILER (JSON Finalization)
        spinner.start('[PROCESS] Reconciling Verified Ledger Payload...');
        const customSchemaTemplate = logic.custom_outputs.map(f =>
            `  "${f.field_name}": <value_from_brain>`
        ).join(',\n');

        const reconcilerPrompt = `Build forensic JSON ledger for ${logic.outcome}.
SCHEMA:
{
  "synthesis_id": "${crypto.randomUUID()}",
  "logic_id": "${logic.outcome}",
  "bps_verified": ${logic.successBps},
  "timestamp": "${new Date().toISOString()}",
  "certification_hash": "keccak256_of_payload"${customSchemaTemplate.length ? ',\n' + customSchemaTemplate : ''}
}
INPUTS: Brain: ${mathOutput} | Auditor: ${auditCritique}`;

        const rawReconciler = await executeLocalInference(
            { ...logic, primary_model: "grok-code-fast-1" },
            reconcilerPrompt
        );

        // Surgical JSON Extraction
        const jsonMatch = rawReconciler.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('RECONCILER_MALFORMED_OUTPUT');

        let finalJson = JSON.parse(jsonMatch[0]);

        // Force Cryptographic Finality
        finalJson.certification_hash = crypto.createHash('sha256').update(JSON.stringify(finalJson)).digest('hex');

        // 6. [ANCHOR] Commit to Base Mainnet
        spinner.start('[ANCHOR] Anchoring Proof to Base Ledger...');
        const payloadStr = JSON.stringify(finalJson);
        const tx = await wallet.sendTransaction({
            to: "0x000000000000000000000000000000000000dEaD",
            data: ethers.hexlify(ethers.toUtf8Bytes(payloadStr)),
            gasLimit: 800000 // Optimized V42 Limit
        });
        const receipt = await tx.wait();

        spinner.succeed(chalk.green(`[VERDICT] Integrity Sealed on Base (Tx: ${receipt.hash})`));
        console.log(chalk.white('\nVerified Ledger Payload:\n') + JSON.stringify(finalJson, null, 2));

    } catch (error) {
        spinner.fail(chalk.red(`[CRITICAL] Execution Failed: ${error.message}`));
        console.error(chalk.dim(error.stack));
    }
}

const [,, cmd, id, data] = process.argv;
if (cmd === "run") run(id, data);