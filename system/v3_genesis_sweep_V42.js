import { ethers } from 'ethers';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

/**
 * [V42] v3_genesis_sweep_V42.js
 * Automated Forensic Auditing via Multi-Model Consensus (MMC).
 */

const XAI_KEY = process.env.XAI_API_KEY;
const PROVIDER_URL = "https://mainnet.base.org"; 
const CONTRACT_ADDRESS = "0x030A8e0eC9f584484088a4cea8D0159F32438613";

async function streamGrok(model, system, user, label) {
    process.stdout.write(chalk.cyan(`\n>>> [${label}] INITIATING (${model}) <<<\n`));
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${XAI_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            model, 
            messages: [{role: 'system', content: system}, {role: 'user', content: user}],
            temperature: 0, // DETERMINISTIC HARDENING
            stream: true
        })
    });

    let fullText = "";
    const decoder = new TextDecoder();
    for await (const chunk of response.body) {
        const lines = decoder.decode(chunk).split("\n");
        for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
                try {
                    const data = JSON.parse(line.replace("data: ", ""));
                    const delta = data.choices[0]?.delta?.content || "";
                    process.stdout.write(chalk.white(delta));
                    fullText += delta;
                } catch (e) {}
            }
        }
    }
    return fullText;
}

async function runSovereignSweep() {
    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    const abi = [
        "function registry(string) view returns (string, address, uint256, uint256, bool)",
        "function issueStrike(string, uint256) external",
        "function idToName(uint256) view returns (string)"
    ];
    const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);

    console.log(chalk.bold.green(`\n[INIT] V42 IMMUNE SYSTEM ACTIVE | AUDITING GLOBAL LEDGER`));

    // Audit the 38 core Genesis silos
    for (let i = 3; i < 99; i++) { // Adjusted range for standard V42 silos
        try {
            const atomicId = await contract.idToName(i);
            if (!atomicId) continue;

            // 1. [BLOCKCHAIN] Fetch logic CID
            const [cid, , , , obsolete] = await contract.registry(atomicId);
            if (obsolete) {
                console.log(chalk.gray(`\n[SKIP] ${atomicId} IS OBSOLETE.`));
                continue;
            }

            console.log(chalk.yellow(`\n[AUDIT] PROBING ATOMIC: ${atomicId} | CID: ${cid}`));

            // 2. [STORAGE] Pull Specs from Arweave
            const cleanCid = cid.replace("ar://", "").split("/")[0];
            const arweaveData = await fetch(`https://arweave.net/${cleanCid}/${atomicId}.json`).then(res => res.json());
            const context = JSON.stringify(arweaveData);

            // 3. [MMC] Multi-Model Consensus Forensic Debate
            const silos = await Promise.all([
                streamGrok("grok-4.1-fast-non-reasoning", "SRE Auditor: Audit for Logic Drift and Toil.", context, "TOIL"),
                streamGrok("grok-4.1-fast-non-reasoning", "Security Architect: Audit for structural leakage.", context, "SECURITY"),
                streamGrok("grok-4.1-fast-non-reasoning", "Economist: Audit for IP Royalty arbitrage.", context, "ECONOMY"),
                streamGrok("grok-4.1-fast-non-reasoning", "Technical Architect: Audit for structural integrity.", context, "STRUCTURE")
            ]);

            const juryReport = await streamGrok("grok-4.1-fast-reasoning", 
                "10-person Jury verdict. 1-sentence verdict and 1-100 severity score. JSON: {'jury': [{'score': int}]}",
                `Audit Reports:\n${silos.join('\n')}`, "JURY");

            const finalVerdict = await streamGrok("grok-4.1-fast-reasoning", 
                "Senior Auditor. Calculate Final BPS: 10000 - (Avg_Jury_Score * 20). Output JSON ONLY: {'bps': int}",
                `Jury Data: ${juryReport}`, "VERDICT");

            // 4. [VERDICT] Extract BPS and Anchor to Base
            const bpsMatch = finalVerdict.match(/\{.*"bps":\s*(\d+).*\}/s);
            if (!bpsMatch) throw new Error("FORENSIC_PARSER_FAILURE");

            const newBps = JSON.parse(bpsMatch[0]).bps;
            console.log(chalk.cyan(`\n[ANCHOR] Committing Cold Truth... BPS: ${newBps}`));
            
            const tx = await contract.issueStrike(atomicId, newBps);
            await tx.wait();
            
            console.log(chalk.green(`[SUCCESS] AUDIT SEALED FOR ${atomicId}.`));
            
        } catch (err) {
            console.error(chalk.red(`\n[FAILURE] MMC ERROR: ${err.message}`));
            await new Promise(r => setTimeout(r, 5000));
        }
    }
    console.log(chalk.bold.green("\n[COMPLETE] GLOBAL SWEEP FINISHED. IMMUNE SYSTEM HARDENED."));
}

runSovereignSweep().catch(console.error);