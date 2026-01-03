import { ethers } from 'ethers';
import Arweave from 'arweave';
import 'dotenv/config';
import chalk from 'chalk';

const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });

/**
 * [V42] SiloController: Manages logic resolution and health monitoring.
 */
export class SiloController {
    constructor(provider, ledgerContract) {
        this.provider = provider;
        this.ledger = ledgerContract;
    }

    /**
     * [BLOCKCHAIN] Resolves and validates Atomic manifest state.
     */
    async getSiloManifest(atomicId) {
        console.log(chalk.gray(`[BLOCKCHAIN] Querying Ledger for: ${atomicId}`));
        const data = await this.ledger.registry(atomicId);
        
        if (data.creator === ethers.ZeroAddress) {
            throw new Error(`[ERROR] Atomic ID ${atomicId} not found in Registry.`);
        }

        // Hard-block decommissioned logic
        if (data.isObsolete) {
            throw new Error(`[CRITICAL] Atomic ${atomicId} is OBSOLETE (3 strikes). Execution halted.`);
        }

        const bps = Number(data.bps);
        const integrity = (bps / 100).toFixed(2);
        
        // Flipped Health Logic: Lower BPS = Higher Risk
        if (bps < 7800) {
            console.warn(chalk.red.bold(`[!] CRITICAL HEALTH: ${atomicId} is at ${integrity}%. Failure imminent.`));
        } else if (bps < 9500) {
            console.warn(chalk.yellow(`[!] DEGRADED HEALTH: ${atomicId} is at ${integrity}%.`));
        } else {
            console.log(chalk.green(`[VERDICT] Integrity Verified: ${integrity}%`));
        }

        // Standardize Arweave CID
        const arweaveId = data.cid.replace('ar://', '').split('/')[0];
        console.log(chalk.gray(`[STORAGE] Pulling Logic Specs from Arweave: ${arweaveId}`));
        
        try {
            const response = await fetch(`https://arweave.net/${arweaveId}`).then(res => res.json());
            return {
                onChainData: data,
                spec: response 
            };
        } catch (err) {
            throw new Error(`[ERROR] Failed to fetch Arweave payload: ${err.message}`);
        }
    }

    /**
     * [V42] Lists and audits global registry status.
     */
    async listSilos(genesisJson) {
        console.log(chalk.bold.cyan("\n--- SYNTHESIS PROTOCOL REGISTRY (V42 GRANITE) ---"));
        console.log(chalk.dim("ID".padEnd(25) + " | " + "INTEGRITY".padEnd(10) + " | " + "STATUS"));
        console.log(chalk.dim("-".repeat(55)));

        for (const silo of genesisJson) {
            let success = false;
            let attempts = 0;

            while (!success && attempts < 3) {
                try {
                    const data = await this.ledger.registry(silo.outcome);
                    const bps = Number(data.bps);
                    const percentage = (bps / 100).toFixed(2) + "%";
                    
                    // V42 Status Mapping
                    let statusTag = chalk.green("🟢 STABLE");
                    if (data.isObsolete) statusTag = chalk.red("💀 OBSOLETE");
                    else if (bps < 7800) statusTag = chalk.red("💀 CRITICAL");
                    else if (bps < 9500) statusTag = chalk.yellow("🟡 DEGRADED");

                    console.log(`${silo.outcome.padEnd(25)} | ${percentage.padEnd(10)} | ${statusTag}`);
                    success = true;
                    await new Promise(r => setTimeout(r, 800)); // Optimized RPC delay
                } catch (e) {
                    attempts++;
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
        }
    }
}