#!/usr/bin/env node
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_BASE_RPC_URL);
const REGISTRY_ADDRESS = "0x3fB0a9a5755f43A044ff0A9E9aC4B55f96220ECa";
const SYNL_TOKEN = "0x1eDf1DFa5489023dE2fd83252af741139766FEDD";

const V42_ABI = [
    "function registry(string) view returns (string cid, address creator, uint256 bps, uint256 strikes, bool isObsolete)",
    "function idToName(uint256) view returns (string)"
];

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

async function interrogate() {
    console.log("\n" + "=".repeat(60));
    console.log(`🔍 INTERROGATING SOVEREIGN STATE`);
    console.log("=".repeat(60));

    try {
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const engine = new ethers.Contract(REGISTRY_ADDRESS, V42_ABI, provider);
        const token = new ethers.Contract(SYNL_TOKEN, ERC20_ABI, provider);

        console.log(`[SDK_WALLET] Address: ${wallet.address}`);
        
        const balance = await token.balanceOf(wallet.address);
        console.log(`[FUEL_CHECK] Balance: ${ethers.formatUnits(balance, 18)} SYNL`);

        const name = await engine.idToName(93);
        const data = await engine.registry(name);

        console.log(`\n[ID_93_STATE] Identifier: ${name}`);
        console.log(`    - Arweave CID: ${data.cid}`);
        console.log(`    - Current BPS: ${data.bps}`);
        console.log(`    - Strike Count: ${data.strikes}`);
        console.log(`    - Status:      ${data.isObsolete ? "OBSOLETE" : "ACTIVE"}`);

    } catch (err) {
        console.error(`\x1b[31m[!] INTERROGATION FAILED: ${err.message}\x1b[0m`);
    }
    console.log("=".repeat(60) + "\n");
}

interrogate();
