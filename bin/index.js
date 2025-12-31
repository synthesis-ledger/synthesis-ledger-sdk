#!/usr/bin/env node
import { Command } from 'commander';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load Environment - Local Override Pattern
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const program = new Command();
const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_BASE_RPC_URL);

// --- 🏛️ SOVEREIGN CONTRACT CONSTANTS ---
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
const SYNL_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_SYNL_TOKEN_ADDRESS;

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)"
];

const callBridge = async (messages, modelName) => {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json", 
            "Authorization": `Bearer ${process.env.XAI_API_KEY}` 
        },
        body: JSON.stringify({ model: modelName, messages, temperature: 0 })
    });
    if (!res.ok) throw new Error(`xAI Error: ${res.status}`);
    return await res.json();
};

program
  .name('synthesis')
  .description('Sovereign Audit Engine - Genesis v2')
  .version('2.0.4');

program
  .command('run')
  .argument('<id>', 'Atomic ID')
  .argument('<data>', 'Input Path')
  .action(async (id, dataInput) => {
    try {
        if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing in .env.local");
        
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const hashedId = ethers.id(id);
        
        console.log(`[$] LOGIC_CLOCK: ${new Date().toISOString()}`);
        console.log(`⚓ TARGET ID HASH: ${hashedId}`);

        // --- 🔬 STAGE 0: SELECTOR SWEEP (ABI FORENSICS) ---
        // We sweep likely function names to avoid 'no data present' reverts
        const candidates = [
            { name: "silos", abi: ["function silos(bytes32) view returns (string cid, address creator, uint256 bps, uint256 strikes, bool isObsolete)"] },
            { name: "registry", abi: ["function registry(bytes32) view returns (string cid, address creator, uint256 bps, uint256 strikes, bool isObsolete)"] },
            { name: "getSilo", abi: ["function getSilo(bytes32) view returns (string cid, address creator, uint256 bps, uint256 strikes, bool isObsolete)"] }
        ];

        let activeAbiFragment = null;
        let siloState = null;
        let functionName = "";

        for (const cand of candidates) {
            try {
                const contractProbe = new ethers.Contract(REGISTRY_ADDRESS, cand.abi, provider);
                siloState = await contractProbe[cand.name](hashedId);
                activeAbiFragment = cand.abi[0];
                functionName = cand.name;
                console.log(`✅ SELECTOR MATCH: Using '${cand.name}'`);
                break;
            } catch (e) {
                continue; 
            }
        }

        if (!activeAbiFragment) throw new Error("Registry View Mismatch: 'silos', 'registry', and 'getSilo' all reverted.");

        const engine = new ethers.Contract(REGISTRY_ADDRESS, [
            activeAbiFragment,
            "function recordPulse(bytes32 id, uint256 bps, bytes32 certHash) external returns (bool)",
            "function createSilo(bytes32 id, string cid) external returns (bool)"
        ], wallet);

        const token = new ethers.Contract(SYNL_TOKEN_ADDRESS, ERC20_ABI, wallet);

        // --- 🔍 STAGE 1: INITIALIZATION CHECK ---
        if (siloState.creator === ethers.ZeroAddress) {
            console.log("⚠️  SILO UNINITIALIZED. EXECUTING CREATE_SILO...");
            const initTx = await engine.createSilo(hashedId, "ipfs://synthesis-genesis-v2-logic");
            await initTx.wait();
            console.log("✅ SILO ANCHORED ON BASE.");
        }

        // --- 🛡️ STAGE 2: SETTLEMENT PREP ---
        const allowance = await token.allowance(wallet.address, REGISTRY_ADDRESS);
        if (allowance < ethers.parseEther("1")) {
            console.log(">>> [SETTLEMENT] AUTHORIZING $SYNL...");
            await (await token.approve(REGISTRY_ADDRESS, ethers.parseUnits("1000", 18))).wait();
            console.log("✅ ALLOWANCE AUTHORIZED.");
        }

        // --- 🧠 STAGE 3: REASONING ---
        const logicPath = 'C:/synthesis-ledger/genesis_onchain.json';
        const genesisData = JSON.parse(fs.readFileSync(logicPath));
        const logic = genesisData.find(item => item.outcome === id);
        
        const inputContent = fs.existsSync(dataInput) ? fs.readFileSync(dataInput, 'utf8') : dataInput;

        console.log(">>> [BRAIN] PROCESSING MATH AND LOGIC...");
        const brainRes = await callBridge([{ role: "user", content: `Audit: ${inputContent}. Logic: ${logic.details}` }], "grok-4-1-fast-reasoning");
        const mathOutput = brainRes.choices[0].message.content;
        console.log(`\x1b[36m[BRAIN] CHATTER:\x1b[0m\n${mathOutput}\n`);

        // --- 🛡️ STAGE 4: AUDIT PARITY ---
        console.log(">>> [AUDITOR] VALIDATING PARITY...");
        const auditorRes = await callBridge([{ role: "system", content: "Extract the BPS equivalent as a decimal number (0.0 to 1.0) only." }, { role: "user", content: mathOutput }], "grok-code-fast-1");
        
        const bpsDecimal = parseFloat(auditorRes.choices[0].message.content.match(/[\d.]+/)[0]) || 0;
        const bpsInteger = Math.round(bpsDecimal * 10000); 
        const certHash = ethers.keccak256(ethers.toUtf8Bytes(mathOutput));

        console.log(`📊 BPS SCALING: ${bpsDecimal} -> ${bpsInteger} units`);

        // --- ⚓ STAGE 5: ANCHOR ---
        console.log(`>>> [ANCHOR] SETTLING 1 $SYNL ON BASE...`);
        const tx = await engine.recordPulse(hashedId, bpsInteger, certHash, { gasLimit: 500000 });
        console.log(`\x1b[33m[PENDING] Pulse Sent: ${tx.hash}\x1b[0m`);
        await tx.wait();

        console.log(`\x1b[32m✅ SUCCESS: https://basescan.org/tx/${tx.hash}\x1b[0m`);

    } catch (err) { console.error(`\x1b[31mCRITICAL ERROR: ${err.message}\x1b[0m`); }
  });

program.parse();