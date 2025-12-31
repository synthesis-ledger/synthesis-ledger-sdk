const { ethers } = require("ethers");
require('dotenv').config({ path: '.env.local' });

async function checkRegistry() {
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_BASE_RPC_URL);
    const id = "A-CMO-PulseHarvester";
    const idHash = ethers.id(id);
    
    // The Registry Contract
    const registry = new ethers.Contract(
        process.env.NEXT_PUBLIC_REGISTRY_ADDRESS,
        ["function registry(bytes32) view returns (string, address, uint256, uint256, bool)"],
        provider
    );

    console.log(`🔍 Checking Registry for Hashed ID: ${idHash}`);
    try {
        const data = await registry.registry(idHash);
        console.log("📊 Registry State:", data);
        if (data[1] === ethers.ZeroAddress) {
            console.log("❌ ERROR: Silo is NOT initialized (Owner is 0x0).");
            console.log("💡 SOLUTION: You must call initializeSilo() first.");
        } else {
            console.log("✅ Silo is active. The issue is likely the $SYNL fee logic.");
        }
    } catch (e) {
        console.log("❌ Registry call failed. ABI mismatch or ID not found.");
    }
}
checkRegistry();