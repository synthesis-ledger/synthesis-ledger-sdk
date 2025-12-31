import { Synapse } from './core/Synapse.js';
import { Ledger } from './core/Ledger.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * synthesis-ledger-sdk
 * The entry point for the Horpestad Standard.
 */
export default {
    Synapse,
    Ledger
};

export { Synapse, Ledger };