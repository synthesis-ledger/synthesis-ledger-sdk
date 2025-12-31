#!/usr/bin/env node
import { Command } from 'commander';
import { ethers } from 'ethers';
import fs from 'fs';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load the local environment file specifically
dotenv.config({ path: '.env.local' });

const program = new Command();
const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_BASE_RPC_URL);

// --- 🏛️ ADRESS ANCHORS FROM .ENV.LOCAL ---
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
const SYNL_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_SYNL_TOKEN_ADDRESS;

const LEDGER_ABI = [
    "function recordPulse(string id, uint256 bps, bytes32 certHash) external returns (bool)",
    "function registry(string id) view returns (string cid, address creator, uint256 bps, uint256 strikes, bool isObsolete)"
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
  .version('2.0.0')
  .command('run')
  .argument('<id>', 'Atomic ID')
  .argument('<data>', 'Input Path')
  .action(async (id, dataPath) => {
    try {
        // PRE-FLIGHT: Wallet & Address Validation
        if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing in .env.local.");
        
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const engine = new ethers.Contract(REGISTRY_ADDRESS, LEDGER_ABI, wallet);
        const token = new ethers.Contract(SYNL_TOKEN_ADDRESS, ERC20_ABI, wallet);

        console.log(`[$] LOGIC_CLOCK: ${new Date().toISOString()}`);

        // 🛡️ SETTLEMENT: SYNL ALLOWANCE
        console.log(">>> [SETTLEMENT] VERIFYING $SYNL RESOURCES...");
        const allowance = await token.allowance(wallet.address, REGISTRY_ADDRESS);
        if (allowance < ethers.parseEther("1")) {
            console.log("⚠️  ALLOWANCE NOT FOUND. AUTHORIZING $SYNL...");
            await (await token.approve(REGISTRY_ADDRESS, ethers.parseEther("100"))).wait();
            console.log("✅ ALLOWANCE ANCHORED.");
        }

        // 🧠 REASONING
        console.log(`>>> [BRAIN] PROCESSING: ${id}`);
        const brainRes = await callBridge([{ role: "user", content: `Audit: ${fs.readFileSync(dataPath, 'utf8')}` }], "grok-4-1-fast-reasoning");
        const mathOutput = brainRes.choices[0].message.content;
        
        console.log(">>> [AUDITOR] VALIDATING PARITY...");
        const auditorRes = await callBridge([{ role: "system", content: "Extract numeric BPS integer." }, { role: "user", content: mathOutput }], "grok-code-fast-1");
        const finalBps = parseInt(auditorRes.choices[0].message.content.match(/\d+/)[0]) || 0;
        const certHash = ethers.keccak256(ethers.toUtf8Bytes(mathOutput));

        // ⚓ ANCHOR
        console.log(`>>> [ANCHOR] SETTLING 1 $SYNL ON BASE...`);
        const tx = await engine.recordPulse(id, finalBps, certHash, { gasLimit: 500000 });
        console.log(`[PENDING] Pulse Sent: ${tx.hash}`);
        await tx.wait();

        console.log(`\x1b[32m✅ SUCCESS: https://basescan.org/tx/${tx.hash}\x1b[0m`);

    } catch (err) { console.error(`\x1b[31mCRITICAL ERROR: ${err.message}\x1b[0m`); }
  });

program.parse();