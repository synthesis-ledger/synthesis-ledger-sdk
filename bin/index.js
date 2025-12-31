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

async function executeLocalInference(logic, prompt) {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${XAI_KEY.trim()}`
        },
        body: JSON.stringify({ 
            model: logic.primary_model || "grok-beta", 
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1 
        })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data.choices[0].message.content;
}

async function run(outcomeName, commandLineData) {
    const spinner = ora(chalk.cyan(`[$] EXEC_START: Sovereign_Engine_Master.ps1 --logic ${outcomeName}`)).start();
    const inputData = commandLineData || "INPUT_MISSING";

    try {
        // PHASE 0: FETCH RECIPE FROM ARWEAVE REGISTRY
        spinner.text = 'FETCHING BLUEPRINT FROM REGISTRY...';
        const registryContract = new ethers.Contract(REGISTRY_ADDR, ["function registry(string) view returns (string,address,uint256,uint256,bool)"], provider);
        const [cidLink] = await registryContract.registry(outcomeName);
        const arCid = cidLink.replace("ar://", "").split("/")[0];
        
        const recipeRes = await fetch(`https://arweave.net/${arCid}/${outcomeName}.json`);
        const logic = await recipeRes.json();
        spinner.info(chalk.gray(`RECIPE IDENTIFIED: Outcome ${logic.outcome} | BPS: ${logic.successBps}`));

        // STAGE 1: BRAIN
        spinner.start('>>> [BRAIN] IS PROCESSING MATH AND LOGIC...');
        const brainPrompt = `Perform Audit for ${inputData} using logic: ${logic.details}. Provide deterministic calculations. Use the BPS and BVI formulas exactly.`;
        const mathOutput = await executeLocalInference(
            { ...logic, primary_model: "grok-4-1-fast-reasoning" },
            brainPrompt
        );
        console.log(chalk.cyan.bold(`\n[BRAIN] INTERNAL CHATTER:\n`) + chalk.white(`${mathOutput}\n`));

        // STAGE 2: AUDITOR
        spinner.start('>>> [AUDITOR] IS SCANNING FOR SCHEMA DRIFT...');
        const auditorPrompt = `AUDIT BRAIN AGAINST BLUEPRINTS. GLOBAL: synthesis_id, logic_id, bps_verified, model_stack, processing_ms, timestamp. CUSTOM: ${JSON.stringify(logic.custom_outputs)}. DATA: ${mathOutput}. Look for BPS manipulation or stale valuations.`;
        const auditCritique = await executeLocalInference(
            { ...logic, primary_model: "grok-code-fast-1" },
            auditorPrompt
        );
        console.log(chalk.red.bold(`\n[AUDITOR] INTERNAL CHATTER:\n`) + chalk.white(`${auditCritique}\n`));

        // STAGE 3: RECONCILER
        spinner.start('>>> [RECONCILER] FINALIZING ONCHAIN PAYLOAD...');
        const customSchemaTemplate = logic.custom_outputs.map(f =>
            `  "${f.field_name}": <${f.type.toLowerCase()}> // ${f.description}`
        ).join(',\n');

        const reconcilerPrompt = `You are the RECONCILER. Build the final on-chain JSON ledger for Atomic Outcome ${logic.outcome}.
CRITICAL RULES:
1. Output ONLY one valid JSON object.
2. NO prose, NO markdown, NO code fences.
3. Exact structure:
{
  "synthesis_id": "${crypto.randomUUID()}",
  "logic_id": "${logic.outcome}",
  "bps_verified": ${logic.successBps},
  "model_stack": ["grok-4-1-fast-reasoning", "grok-code-fast-1"],
  "processing_ms": 2500,
  "timestamp": "${new Date().toISOString()}",
  "certification_hash": "<generate random SHA-256 hex string>"${customSchemaTemplate.length ? ',\n' + customSchemaTemplate : ''}
}
Extract actual values from BRAIN: ${mathOutput}
From AUDITOR: ${auditCritique}`;

        const rawReconciler = await executeLocalInference(
            { ...logic, primary_model: "grok-code-fast-1" },
            reconcilerPrompt
        );

        // SURGICAL JSON EXTRACTION
        let clean = rawReconciler.replace(/```json|```/g, '').trim();
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('RECONCILER produced no valid JSON block.');

        let finalJson = JSON.parse(jsonMatch[0]);

        // AUTO-REPAIR GLOBALS
        if (!finalJson.certification_hash) {
            finalJson.certification_hash = crypto.createHash('sha256').update(JSON.stringify(finalJson)).digest('hex');
        }

        // PHASE 4: ANCHORING
        spinner.start('>>> ANCHORING TO BASE MAINNET...');
        const payloadStr = JSON.stringify(finalJson);
        const tx = await wallet.sendTransaction({
            to: "0x000000000000000000000000000000000000dEaD",
            data: ethers.hexlify(ethers.toUtf8Bytes(payloadStr)),
            gasLimit: 1000000
        });
        const receipt = await tx.wait();

        spinner.succeed(chalk.green('SUCCESS: Sovereign Ledger Entry Anchored on Base'));
        console.log(chalk.blueBright(`\n📜 Transaction Hash: ${receipt.hash}`));
        console.log(chalk.white('\nFinal Ledger Payload:\n') + JSON.stringify(finalJson, null, 2));

    } catch (error) {
        spinner.fail(chalk.red('CRITICAL FAILURE: ' + error.message));
        console.error(chalk.dim(error.stack));
    }
}

const [,, cmd, id, data] = process.argv;
if (cmd === "run") run(id, data);