import Ajv from "ajv";
import addFormats from "ajv-formats";
import chalk from 'chalk';

// --- V42 HARDENING ---
// Initialize AJV with full error reporting and strict format support
const ajv = new Ajv({ 
    allErrors: true, 
    strict: false,
    useDefaults: true 
});

// Add support for date-time, uuid, uri, email, etc.
addFormats(ajv);

/**
 * [V42] SiloValidator: Enforces schema integrity for Atomic blueprints.
 */
export class SiloValidator {
    /**
     * [STORAGE] Extracts the JSON Schema block from technical markdown.
     */
    static extractSchema(markdown) {
        // Targeted Regex for Section 3 (V42 Technical Block)
        const regex = /## 3\. JSON Schema for Input Validation[\s\S]*?```json\s+([\s\S]*?)\n```/;
        const match = markdown.match(regex);
        
        if (!match) {
            console.log(chalk.yellow(`[!] NOTICE: Section 3 Schema block not found. Defaulting to SOVEREIGN mode.`));
            return null;
        }
        
        try {
            return JSON.parse(match[1]);
        } catch (e) {
            console.warn(chalk.red(`[!] WARNING: Section 3 JSON Schema is malformed. Path: /${e.message}`));
            return null;
        }
    }

    /**
     * [PROCESS] Validates input data against the extracted blueprint schema.
     */
    static validate(schema, data) {
        // Fallback for missing/malformed schemas
        if (!schema) {
            return { 
                success: true, 
                mode: "SOVEREIGN",
                details: "No technical schema present in blueprint." 
            };
        }
        
        try {
            const validate = ajv.compile(schema);
            const valid = validate(data);
            
            if (!valid) {
                return {
                    success: false,
                    mode: "FAILED",
                    errors: validate.errors.map(err => `[${err.instancePath}] ${err.message}`)
                };
            }
            
            return { 
                success: true, 
                mode: "VALIDATED" 
            };
        } catch (err) {
            return {
                success: false,
                mode: "SCHEMA_ERROR",
                errors: [err.message]
            };
        }
    }
}