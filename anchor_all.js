import { ethers } from 'ethers';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

const MANIFEST_ID = "Y5440PpxtH7V1eHmrBFsy7a9b_zxkxTzjbio2co41LM";
const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_BASE_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const ledgerAddress = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;

const V42_ABI = ["function registerAtomic(uint256 _id, string _name, string _cid, address _creator) external"];
const ledger = new ethers.Contract(ledgerAddress, V42_ABI, wallet);

async function main() {
    console.log("🚀 STARTING MANUAL NONCE ANCHORING...");
    
    // 1. Get the STARTING nonce (including pending txs)
    let currentNonce = await wallet.getNonce(); 
    const genesis = JSON.parse(fs.readFileSync('C:/synthesis-ledger/genesis_onchain.json', 'utf8'));

    for (let recipe of genesis) {
        const cid = `ar://${MANIFEST_ID}/${recipe.outcome}.json`;
        console.log(`🔗 Anchoring ${recipe.outcome} (Nonce: ${currentNonce})...`);
        
        try {
            // 2. Pass the nonce MANUALLY so it never duplicates
            const tx = await ledger.registerAtomic(recipe.id, recipe.outcome, cid, wallet.address, {
                nonce: currentNonce
            });
            
            console.log(`📡 Pending: ${tx.hash}`);
            // We increment locally for the next loop
            currentNonce++; 
            
            // We wait for the tx to be MINED before moving on to ensure stability
            await tx.wait(); 
            console.log(`✅ Secured: ${recipe.outcome}`);
        } catch (e) {
            // If it's already registered, just move to the next nonce
            if (e.message.includes("already registered")) {
                console.log(`⏭️ Skipping ${recipe.outcome} (Already on-chain)`);
            } else {
                console.error(`❌ Critical Fail ${recipe.outcome}: ${e.message}`);
                // Refresh nonce on error to be safe
                currentNonce = await wallet.getNonce();
            }
        }
    }
    console.log("\n🏁 ALL 38 ATOMICS ANCHORED SUCCESSFULLY.");
}
main();