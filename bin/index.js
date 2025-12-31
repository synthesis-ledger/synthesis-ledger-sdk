#!/usr/bin/env node
import { Command } from 'commander';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Force look for .env.local in the current working directory
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const program = new Command();
const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_BASE_RPC_URL);

// --- 🏛️ ADDRESS ANCHORS ---
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
const SYNL_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_SYNL_TOKEN_ADDRESS;

const LEDGER_ABI = [
    "function recordPulse(bytes32 id, uint256 bps, bytes32 certHash) external returns (bool)",
    "function registry(bytes32 id) view returns (string cid, address creator, uint256 bps, uint256 strikes, bool isObsolete)",
    "function createSilo(bytes32 id, string cid) external returns (bool)"
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)"
];

const callBridge = async (messages, modelName) => {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.XAI_API_KEY}` },
        body: JSON.stringify({ model: modelName, messages, temperature: 0 })
    });
    if (!res.ok) throw new Error(`xAI Error: ${res.status}`);
    return await res.json();
};

program
  .name('synthesis')
  .description('Sovereign Audit Engine - Genesis v2')
  .version('2.0.3');

// --- 📋 COMMAND: LIST ---
program
  .command('list')
  .description('Audit all 38 active Silos on the Base Ledger')
  .action(() => {
    try {
        const genesisPath = 'C:/synthesis-ledger/genesis_onchain.json';
        if (!fs.existsSync(genesisPath)) throw new Error(`Registry not found at ${genesisPath}`);
        const genesisData = JSON.parse(fs.readFileSync(genesisPath));
        console.log("\x1b[32m🔍 AUDITING BASE LEDGER SILOS...\x1b[0m");
        console.log("--------------------------------------------------");
        genesisData.forEach(s => {
            console.log(`\x1b[36m[${s.id}]\x1b[0m \x1b[37m${s.outcome}\x1b[0m`);
        });
    } catch (err) { console.error(`\x1b[31mCRITICAL ERROR: ${err.message}\x1b[0m`); }
  });

// --- 🚀 COMMAND: RUN ---
program
  .command('run')
  .description('Execute a 3-Stage Sovereign Audit')
  .argument('<id>', 'Atomic ID')
  .argument('<data>', 'Input Path or Raw JSON')
  .action(async (id, dataInput) => {
    try {
        if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing in .env.local");
        
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const engine = new ethers.Contract(REGISTRY_ADDRESS, LEDGER_ABI, wallet);
        const token = new ethers.Contract(SYNL_TOKEN_ADDRESS, ERC20_ABI, wallet);

        const logicClock = new Date().toISOString();
        const genesisData = JSON.parse(fs.readFileSync('C:/synthesis-ledger/genesis_onchain.json'));
        const logic = genesisData.find(item => item.outcome === id);
        if (!logic) throw new Error(`Logic ID "${id}" not found.`);

        let inputContent = dataInput;
        if (fs.existsSync(dataInput)) {
            inputContent = fs.readFileSync(dataInput, 'utf8');
        }

        console.log(`\x1b[32m[$] EXEC_START: ${id}\x1b[0m`);
        console.log(`\x1b[35m[$] LOGIC_CLOCK: ${logicClock}\x1b[0m`);
        console.log("\x1b[90m--------------------------------------------------\x1b[0m");

        // 🛡️ ENCODING & HASHING
        const hashedId = ethers.id(id);
        console.log(`⚓ TARGET ID HASH: ${hashedId}`);

        // 🔍 STAGE 0: CHECK REGISTRY STATE
        const silo = await engine.registry(hashedId);
        if (silo.creator === ethers.ZeroAddress) {
            console.log("⚠️  SILO UNINITIALIZED. ATTEMPTING GENESIS ANCHOR...");
            const initTx = await engine.createSilo(hashedId, "ipfs://synthesis-genesis-v2-logic");
            console.log(`[PENDING] Initialization: ${initTx.hash}`);
            await initTx.wait();
            console.log("✅ SILO INITIALIZED ON BASE.");
        }

        // 🛡️ SETTLEMENT: SYNL ALLOWANCE
        const allowance = await token.allowance(wallet.address, REGISTRY_ADDRESS);
        if (allowance < ethers.parseEther("1")) {
            console.log(">>> [SETTLEMENT] AUTHORIZING $SYNL...");
            await (await token.approve(REGISTRY_ADDRESS, ethers.parseUnits("1000", 18))).wait();
            console.log("✅ ALLOWANCE ANCHORED.");
        }

        // 🧠 REASONING
        console.log(">>> [BRAIN] PROCESSING MATH AND LOGIC...");
        const brainRes = await callBridge([{ role: "user", content: `Audit: ${inputContent}. Logic: ${logic.details}` }], "grok-4-1-fast-reasoning");
        const mathOutput = brainRes.choices[0].message.content;
        console.log(`\x1b[36m[BRAIN] CHATTER:\x1b[0m\n${mathOutput}\n`);

        // 🛡️ AUDITOR: BPS PARSING & SCALING
        console.log(">>> [AUDITOR] VALIDATING PARITY...");
        const auditorRes = await callBridge([{ role: "system", content: "Extract the BPS equivalent as a decimal number (0.0 to 1.0) only." }, { role: "user", content: mathOutput }], "grok-code-fast-1");
        
        const bpsDecimal = parseFloat(auditorRes.choices[0].message.content.match(/[\d.]+/)[0]) || 0;
        const bpsInteger = Math.round(bpsDecimal * 10000); 
        const certHash = ethers.keccak256(ethers.toUtf8Bytes(mathOutput));

        console.log(`📊 BPS SCALING: ${bpsDecimal} -> ${bpsInteger} units`);

        // ⚓ ANCHOR
        console.log(`>>> [ANCHOR] SETTLING 1 $SYNL ON BASE...`);
        const tx = await engine.recordPulse(hashedId, bpsInteger, certHash, { gasLimit: 500000 });
        console.log(`\x1b[33m[PENDING] Pulse Sent: ${tx.hash}\x1b[0m`);
        await tx.wait();

        console.log(`\x1b[32m✅ SUCCESS: https://basescan.org/tx/${tx.hash}\x1b[0m`);

    } catch (err) { console.error(`\x1b[31mCRITICAL ERROR: ${err.message}\x1b[0m`); }
  });

program.parse();