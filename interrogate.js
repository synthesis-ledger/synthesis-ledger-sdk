#!/usr/bin/env node
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
import chalk from 'chalk';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// --- V42 INFRASTRUCTURE ---
const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_BASE_RPC_URL);
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
const SYNL_TOKEN = process.env.NEXT_PUBLIC_SYNL_TOKEN_ADDRESS;

const V42_ABI = [
    "function registry(string) view returns (string cid, address creator, uint256 bps, uint256 strikes, bool isObsolete)",
    "function idToName(uint256) view returns (string)"
];

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

async function interrogate() {
    console.log(chalk.bold.cyan("\n[INIT] INTERROGATING SOVEREIGN V42 STATE"));
    console.log(chalk.dim("=".repeat(60)));

    try {
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const engine = new ethers.Contract(REGISTRY_ADDRESS, V42_ABI, provider);
        const token = new ethers.Contract(SYNL_TOKEN, ERC20_ABI, provider);

        // 1. [FUEL_CHECK] Verify SYNL Balance
        const balance = await token.balanceOf(wallet.address);
        console.log(chalk.white(`[FUEL_CHECK] Wallet: ${wallet.address}`));
        console.log(chalk.white(`[FUEL_CHECK] Balance: ${ethers.formatUnits(balance, 18)} SYNL`));

        // 2. [BLOCKCHAIN] Query ID 93 (PulseHarvester)
        const name = await engine.idToName(93);
        const data = await engine.registry(name);

        const bps = Number(data.bps);
        let statusTag = chalk.green("🟢 STABLE");
        
        if (data.isObsolete) statusTag = chalk.red("💀 OBSOLETE");
        else if (bps < 7800) statusTag = chalk.red("💀 CRITICAL");
        else if (bps < 9500) statusTag = chalk.yellow("🟡 DEGRADED");

        console.log(chalk.cyan(`\n[BLOCKCHAIN] Atomic Identifier: ${name}`));
        console.log(chalk.white(`    - Arweave CID:  ${data.cid}`));
        console.log(chalk.white(`    - Current BPS:  ${bps}`));
        console.log(chalk.white(`    - Strike Count: ${data.strikes}`));
        console.log(chalk.white(`    - Health State: ${statusTag}`));

        if (data.isObsolete) {
            console.log(chalk.bgRed.white.bold("\n[!] WARNING: Logic has failed immune audit and is decommissioned."));
        }

    } catch (err) {
        console.error(chalk.red(`\n[ERROR] Interrogation Failed: ${err.message}`));
    }
    console.log(chalk.dim("=".repeat(60)) + "\n");
}

interrogate();