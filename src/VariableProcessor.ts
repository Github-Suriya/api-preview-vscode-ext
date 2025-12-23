import * as vscode from 'vscode';

export class VariableProcessor {
    /**
     * Replaces {{key}} patterns in a string with values from VS Code settings.
     */
    static process(text: string): string {
        if (!text) return text;
        
        const config = vscode.workspace.getConfiguration('apiPreview');
        const variables = config.get<{[key: string]: string}>('variables') || {};

        // Regex to find {{variable}}
        return text.replace(/\{\{(.*?)\}\}/g, (match, key) => {
            const varName = key.trim();
            if (variables.hasOwnProperty(varName)) {
                return variables[varName];
            }
            // Return original if not found (or could show a warning)
            return match;
        });
    }

    /**
     * Process an object (headers)
     */
    static processObject(obj: any): any {
        if (typeof obj !== 'object' || obj === null) return obj;
        
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                result[key] = this.process(value);
            } else {
                result[key] = value;
            }
        }
        return result;
    }
}