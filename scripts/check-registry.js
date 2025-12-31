import { ethers } from 'ethers';
import fs from 'fs';
import 'dotenv/config';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function auditRegistry() {
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_BASE_RPC_URL);
    const registryAddress = ethers.getAddress(process.env.NEXT_PUBLIC_REGISTRY_ADDRESS.toLowerCase());
    
    const LEDGER_ABI = ["function registry(string id) view returns (string cid, address creator, uint256 bps, uint256 strikes, bool isObsolete)"];
    const ledger = new ethers.Contract(registryAddress, LEDGER_ABI, provider);
    const genesisData = JSON.parse(fs.readFileSync('C:/synthesis-ledger/genesis_onchain.json'));

    console.log(`--- AUDITING GRANITE REGISTRY ---`);
    
    let liveCount = 0;
    let missingList = [];

    for (const silo of genesisData) {
        const id = silo.outcome;
        let success = false;
        let attempts = 0;

        while (!success && attempts < 3) {
            try {
                const data = await ledger.registry(id);
                if (data.creator !== ethers.ZeroAddress) {
                    console.log(`✅ [LIVE] ${id.padEnd(25)} | BPS: ${data.bps.toString().padEnd(6)} | CID: ${data.cid.substring(0, 15)}...`);
                    liveCount++;
                } else {
                    console.log(`❌ [MISSING] ${id}`);
                    missingList.push(id);
                }
                success = true;
                await sleep(1500); // 1.5s delay to prevent rate limits
            } catch (e) {
                attempts++;
                console.log(`⚠️ Throttled on ${id}. Attempt ${attempts}/3. Resting 5s...`);
                await sleep(5000);
            }
        }
    }

    console.log(`\n--- AUDIT COMPLETE ---`);
    console.log(`TOTAL LIVE: ${liveCount} / ${genesisData.length}`);
    if (missingList.length > 0) console.log("Missing:", missingList.join(", "));
}

auditRegistry().catch(console.error);