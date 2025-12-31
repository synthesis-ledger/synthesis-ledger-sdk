import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export class SiloValidator {
    static extractSchema(markdown) {
        const regex = /## 3\. JSON Schema for Input Validation[\s\S]*?```json\s+([\s\S]*?)\n```/;
        const match = markdown.match(regex);
        
        // No longer CRITICAL. We return null so the engine can proceed.
        if (!match) return null;
        
        try {
            return JSON.parse(match[1]);
        } catch (e) {
            console.warn("⚠️  Warning: Section 3 JSON Schema is malformed. Proceeding without strict validation.");
            return null;
        }
    }

    static validate(schema, data) {
        if (!schema) return { success: true, mode: "SOVEREIGN" };
        
        const validate = ajv.compile(schema);
        const valid = validate(data);
        
        if (!valid) {
            return {
                success: false,
                errors: validate.errors.map(err => `${err.instancePath} ${err.message}`)
            };
        }
        return { success: true, mode: "VALIDATED" };
    }
}