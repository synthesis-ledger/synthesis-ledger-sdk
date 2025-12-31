import { ethers } from 'ethers';
import fetch from 'node-fetch';

export class Synapse {
    constructor(config) {
        this.apiKey = config.apiKey || process.env.XAI_API_KEY;
        this.model = config.model || "grok-4.1-fast-reasoning";
    }

    /**
     * Executes the V42 3-Phase Pipeline
     * @param {string} atomicId - The ID of the logic to run
     * @param {Object} inputData - The data to process
     */
    async run(atomicId, inputData) {
        console.log(`\n[SYNAPSE] Initiating V42 Pipeline for: ${atomicId}`);
        
        // STAGE 1: THE BRAIN (Raw Execution)
        const brainOutput = await this._callAI(
            "Stage 1: Execute core logic. Reasoning first, then deterministic outcome.", 
            inputData
        );
        
        // STAGE 2: THE AUDITOR (Adversarial Check)
        const auditVerdict = await this._callAI(
            "Stage 2: Audit the previous output. Look for hallucinations or logic drift.", 
            brainOutput
        );
        
        // STAGE 3: THE RECONCILER (JSON Finalization)
        const finalLedgerRaw = await this._callAI(
            "Stage 4: Assemble a final JSON object. Fields: {verdict: string, confidence: float, timestamp: string}", 
            { brainOutput, auditVerdict }
        );

        // CLEANUP: Extract JSON from markdown if necessary
        const jsonMatch = finalLedgerRaw.match(/\{[\s\S]*\}/);
        const finalLedger = jsonMatch ? jsonMatch[0] : finalLedgerRaw;

        // GENERATE POI (Proof of Integrity)
        const dataHash = ethers.keccak256(ethers.toUtf8Bytes(finalLedger));

        return {
            ledger: JSON.parse(finalLedger),
            poi: dataHash,
            timestamp: new Date().toISOString()
        };
    }

    async _callAI(systemPrompt, data) {
        const response = await fetch("https://api.x.ai/v1/chat/completions", {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: JSON.stringify(data) }
                ],
                temperature: 0 // NO STOCHASTIC VARIANCE
            })
        });
        const result = await response.json();
        return result.choices[0].message.content;
    }
}