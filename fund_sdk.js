const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_BASE_RPC_URL);
    // ⚠️ USE THE PRIVATE KEY OF THE DEPLOYER (The one that has the tokens)
    const deployer = new ethers.Wallet("YOUR_DEPLOYER_PRIVATE_KEY", provider);
    
    const SYNL_TOKEN = "0x1eDf1DFa5489023dE2fd83252af741139766FEDD";
    const SDK_WALLET = "0xc753360Bc56C6538aa6cDd513066B75D9f75E523";

    const abi = ["function transfer(address to, uint256 amount) public returns (bool)"];
    const token = new ethers.Contract(SYNL_TOKEN, abi, deployer);

    console.log("🚀 Funding SDK Wallet with 500 $SYNL...");
    const tx = await token.transfer(SDK_WALLET, ethers.parseUnits("500", 18));
    await tx.wait();
    console.log("✅ Funding Complete! Hash:", tx.hash);
}

main();