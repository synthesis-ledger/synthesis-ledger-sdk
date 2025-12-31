import { Synapse, Ledger } from '../src/index.js';

const ledger = new Ledger({
    contractAddress: "0x030A8e0eC9f584484088a4cea8D0159F32438613"
});

const synapse = new Synapse({
    apiKey: process.env.XAI_API_KEY
});

async function start() {
    // 1. Get the latest logic pointer from the blockchain
    const cid = await ledger.getCID("A-HC-PathValidator");
    
    // 2. Execute with the "Horpestad Standard" pipeline
    const result = await synapse.run("A-HC-PathValidator", {
        path: ["Node-A", "Node-B"],
        health: 0.95
    });

    console.log("Execution POI:", result.poi);
    console.log("Final Verdict:", result.ledger.verdict);
}

start().catch(console.error);