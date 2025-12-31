#!/usr/bin/env node
import { Command } from 'commander';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const program = new Command();
const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_BASE_RPC_URL);

// --- SOVEREIGN COORDINATES ---
const REGISTRY_ADDRESS = "0x3fB0a9a5755f43A044ff0A9E9aC4B55f96220ECa";
const SYNL_TOKEN = "0x1eDf1DFa5489023dE2fd83252af741139766FEDD";

const V42_ABI = [
    "function recordPulse(uint256 id, uint256 bps, bytes32 certHash) external returns (bool)",
    "function idToName(uint256) view returns (string)",
    "function registry(string) view returns (string cid, address creator, uint256 bps, uint256 strikes, bool isObsolete)"
];

const ERC20_ABI = [
    "function balanceof(address) view returns (uint256)",
    "function approve(address, uint256) public returns (bool)",
    "function allowance(address, address) view returns (uint256)"
];

program.name('synthesis-v42').version('3.0.0');

program
  .command('run')
  .argument('<outcome_name>', 'Identifier')
  .argument('<data_file>', 'Path to pulse data')
  .action(async (outcomeName, dataFile) => {
    console.log("\n" + "█".repeat(60));
    console.log(`█  SYNL_V42_DRIVE: STARTING PRODUCTION ANCHOR`);
    console.log("█".repeat(60));

    try {
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const engine = new ethers.Contract(REGISTRY_ADDRESS, V42_ABI, wallet);
        const token = new ethers.Contract(SYNL_TOKEN, ERC20_ABI, wallet);

        // 1. DATA LOAD
        const dataPath = path.resolve(process.cwd(), dataFile);
        const rawContent = fs.readFileSync(dataPath, 'utf8').replace(/^\uFEFF/, '').trim();
        const pulseData = JSON.parse(rawContent);

        // 2. FUEL CHECK (SYNL)
        const balance = await token.balanceof(wallet.address);
        const allowance = await token.allowance(wallet.address, REGISTRY_ADDRESS);
        console.log(`[FUEL] Wallet Balance: ${ethers.formatUnits(balance, 18)} SYNL`);

        if (allowance === 0n) {
            console.log(">>> [FUEL] AUTHORIZING SYNL LINE...");
            await (await token.approve(REGISTRY_ADDRESS, ethers.MaxUint256)).wait();
        }

        // 3. REGISTRY SYNC
        const atomicData = await engine.registry(outcomeName);
        if (!atomicData.cid) throw new Error(`Outcome "${outcomeName}" unregistered.`);

        // 4. ANCHOR
        const numericId = 93; // PulseHarvester
        const certHash = ethers.id(`${outcomeName}-${Date.now()}`);

        console.log(`\n>>> [V42] EXECUTING ANCHOR ON ID ${numericId}...`);
        const tx = await engine.recordPulse(numericId, pulseData.bps || 9950, certHash, { gasLimit: 800000 });
        
        console.log(`\x1b[33m[TX_SENT] ${tx.hash}\x1b[0m`);
        const receipt = await tx.wait();

        console.log("\n" + "█".repeat(60));
        console.log(`\x1b[32m█  ANCHOR SUCCESSFUL | GAS: ${receipt.gasUsed}\x1b[0m`);
        console.log(`█  EXPLORER: https://basescan.org/tx/${tx.hash}`);
        console.log("█".repeat(60) + "\n");

    } catch (err) {
        console.error(`\x1b[31m\n[!] ERROR: ${err.message}\x1b[0m`);
    }
  });

program.parse();