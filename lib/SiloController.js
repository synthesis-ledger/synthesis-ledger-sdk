import { ethers } from 'ethers';
import Arweave from 'arweave';
import 'dotenv/config';

const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });

export class SiloController {
    constructor(provider, ledgerContract) {
        this.provider = provider;
        this.ledger = ledgerContract;
    }

    async getSiloManifest(atomicId) {
        console.log(`🔍 Resolving ${atomicId} on Ledger...`);
        const data = await this.ledger.registry(atomicId);
        
        if (data.creator === ethers.ZeroAddress) {
            throw new Error(`Atomic ID ${atomicId} not found in Registry.`);
        }

        const bps = Number(data.bps);
        const integrity = (bps / 100).toFixed(2);
        
        if (bps < 9000) {
            console.warn(`⚠️  INTEGRITY WARNING: ${atomicId} is at ${integrity}%. Logic may be degraded.`);
        } else {
            console.log(`🛡️  Integrity Verified: ${integrity}%`);
        }

        const arweaveId = data.cid.replace('ar://', '');
        console.log(`📦 Fetching Logic Specs from Arweave: ${arweaveId}`);
        
        try {
            const response = await arweave.transactions.getData(arweaveId, { decode: true, string: true });
            return {
                onChainData: data,
                spec: response 
            };
        } catch (err) {
            throw new Error(`Failed to fetch Arweave data: ${err.message}`);
        }
    }

    async listSilos(genesisJson) {
        console.log("\n--- SYNTHESIS PROTOCOL REGISTRY (V42 GRANITE) ---");
        console.log("ID".padEnd(25) + " | " + "INTEGRITY".padEnd(10) + " | " + "STATUS");
        console.log("-".repeat(55));

        for (const silo of genesisJson) {
            let success = false;
            let attempts = 0;

            while (!success && attempts < 3) {
                try {
                    const data = await this.ledger.registry(silo.outcome);
                    const bps = Number(data.bps);
                    const percentage = (bps / 100).toFixed(2) + "%";
                    
                    // Flipped Logic: High BPS = Stable
                    let status = "🟢 STABLE";
                    if (data.isObsolete) status = "🔴 OBSOLETE";
                    else if (bps < 7000) status = "💀 CRITICAL";
                    else if (bps < 9500) status = "🟡 DEGRADED";

                    console.log(`${silo.outcome.padEnd(25)} | ${percentage.padEnd(10)} | ${status}`);
                    success = true;
                    // Breath for RPC
                    await new Promise(r => setTimeout(r, 1200)); 
                } catch (e) {
                    attempts++;
                    await new Promise(r => setTimeout(r, 3000));
                }
            }
        }
    }
}