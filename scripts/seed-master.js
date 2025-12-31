import { ethers } from 'ethers';
import Irys from '@irys/sdk';
import fs from 'fs';
import 'dotenv/config';

async function seedMasterLogic() {
    console.log("--- ANCHORING SOVEREIGN ENGINE & SEEDING LOGIC ---");

    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_BASE_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const irys = new Irys({ 
        url: "https://node2.irys.xyz", 
        token: "base-eth", 
        key: process.env.PRIVATE_KEY 
    });

    const registryAddress = ethers.getAddress(process.env.NEXT_PUBLIC_REGISTRY_ADDRESS.toLowerCase());
    const LEDGER_ABI = ["function upgradeEternalLogic(string _engineId, string _sweepId) external"];
    const ledger = new ethers.Contract(registryAddress, LEDGER_ABI, wallet);

    // EXACT PATHS PROVIDED
    const enginePath = 'C:/synthesis-ledger/scripts/Sovereign_Engine_Master_V42.ps1'; 
    const sweepPath = 'C:/synthesis-ledger/script/V42_Arweave_Seeding_Logic.ps1';

    console.log("📦 Uploading Sovereign Master Engine...");
    if (!fs.existsSync(enginePath)) throw new Error(`Engine file not found: ${enginePath}`);
    const engineScript = fs.readFileSync(enginePath, 'utf8');
    const engineReceipt = await irys.upload(engineScript, {
        tags: [{ name: "Content-Type", value: "text/plain" }, { name: "Type", value: "Master-Engine" }]
    });
    const engineCID = engineReceipt.id;
    console.log(`✅ Engine CID: ar://${engineCID}`);

    console.log("📦 Uploading Seeding/Sweep Logic...");
    if (!fs.existsSync(sweepPath)) throw new Error(`Sweep file not found: ${sweepPath}`);
    const sweepScript = fs.readFileSync(sweepPath, 'utf8');
    const sweepReceipt = await irys.upload(sweepScript, {
        tags: [{ name: "Content-Type", value: "text/plain" }, { name: "Type", value: "Audit-Sweep" }]
    });
    const sweepCID = sweepReceipt.id;
    console.log(`✅ Sweep CID: ar://${sweepCID}`);

    console.log("🔗 Anchoring to Base Ledger...");
    const tx = await ledger.upgradeEternalLogic(engineCID, sweepCID, {
        gasLimit: 500000 // Forced limit to prevent simulation errors
    });
    
    console.log(`⏳ Waiting for final confirmation...`);
    await tx.wait();

    console.log(`🏛️ PROTOCOL TRUTH ANCHORED. Hash: ${tx.hash}`);
}

seedMasterLogic().catch(console.error);