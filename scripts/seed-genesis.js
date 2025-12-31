import { ethers } from 'ethers';
import Irys from '@irys/sdk';
import fs from 'fs';
import 'dotenv/config';

async function seedProtocol() {
    console.log("--- INITIALIZING TRUE-FORCE SEEDER V42 ---");

    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_BASE_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const irys = new Irys({ url: "https://node2.irys.xyz", token: "base-eth", key: process.env.PRIVATE_KEY });

    const vaultAddress = ethers.getAddress("0x7ccd9095a505d9ad0ca104c7feb981d08c05bfa4".toLowerCase());
    const registryAddress = ethers.getAddress(process.env.NEXT_PUBLIC_REGISTRY_ADDRESS.toLowerCase());
    
    const LEDGER_ABI = [
        "function registerAtomic(string id, string cid, address creator) external",
        "function registry(string id) view returns (string cid, address creator, uint256 bps, uint256 strikes, bool isObsolete)"
    ];
    const ledger = new ethers.Contract(registryAddress, LEDGER_ABI, wallet);
    const genesisData = JSON.parse(fs.readFileSync('C:/synthesis-ledger/genesis_onchain.json'));

    let currentNonce = await provider.getTransactionCount(wallet.address, "pending");
    console.log(`📡 Starting Nonce: ${currentNonce}`);

    for (const silo of genesisData) {
        const atomicId = silo.outcome; 
        
        try {
            const existing = await ledger.registry(atomicId);
            if (existing.creator !== ethers.ZeroAddress) {
                console.log(`⏩ ${atomicId} already exists. Skipping.`);
                continue;
            }

            console.log(`📦 Uploading ${atomicId} to Arweave...`);
            const receipt = await irys.upload(silo.details, {
                tags: [{ name: "Content-Type", value: "text/markdown" }, { name: "Atomic-ID", value: atomicId }]
            });
            const arweaveCID = `ar://${receipt.id}`;

            console.log(`🔗 Force-Broadcasting ${atomicId} (Nonce: ${currentNonce})...`);
            
            const feeData = await provider.getFeeData();

            // MANUALLY PREPARE THE RAW TRANSACTION TO BYPASS ALL SIMULATION
            const txData = await ledger.registerAtomic.populateTransaction(atomicId, arweaveCID, vaultAddress);
            
            const txResponse = await wallet.sendTransaction({
                ...txData,
                nonce: currentNonce,
                gasLimit: 800000, // Explicitly high for safety
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
                type: 2
            });

            currentNonce++; 

            console.log(`⏳ Pending: ${txResponse.hash}`);
            await txResponse.wait();
            console.log(`🏛️ SUCCESS: ${atomicId}\n`);

            await new Promise(r => setTimeout(r, 3000)); // 3s breath

        } catch (error) {
            console.error(`❌ FAILED ${atomicId}:`, error.message);
            // Refresh nonce on actual failure
            currentNonce = await provider.getTransactionCount(wallet.address, "pending");
        }
    }
}

seedProtocol().catch(console.error);