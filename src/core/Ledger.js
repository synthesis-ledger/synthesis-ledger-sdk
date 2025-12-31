import { ethers } from 'ethers';

export class Ledger {
    constructor(config) {
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl || "https://mainnet.base.org");
        this.contractAddress = config.contractAddress;
        // ABI only for the registry function to keep it light
        this.abi = [
            "function registry(string atomicId) view returns (string cid, address creator, uint256 bps, uint256 strikes, bool isObsolete)"
        ];
    }

    /**
     * Retrieves the Arweave CID for a specific Atomic
     */
    async getCID(atomicId) {
        const contract = new ethers.Contract(this.contractAddress, this.abi, this.provider);
        try {
            const entry = await contract.registry(atomicId);
            if (entry.isObsolete) throw new Error("This logic is obsolete (3 strikes).");
            return entry.cid;
        } catch (error) {
            throw new Error(`Ledger lookup failed: ${error.message}`);
        }
    }
}