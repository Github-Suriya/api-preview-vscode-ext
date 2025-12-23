import * as vscode from 'vscode';
import { ApiPreviewPanel } from './ApiPreviewPanel';
import { HistoryProvider } from './HistoryProvider';
import { ApiRequest } from './types';

export function activate(context: vscode.ExtensionContext) {
    
    const historyProvider = new HistoryProvider(context);
    vscode.window.registerTreeDataProvider('apiPreviewSidebar', historyProvider);

    // 1. OPEN / NEW REQUEST Command
    context.subscriptions.push(
        vscode.commands.registerCommand('apiPreview.open', () => {
            // If panel exists, just reset it to blank (Like clicking "+" tab)
            if (ApiPreviewPanel.currentPanel) {
                ApiPreviewPanel.reset();
                // We also reveal it in case it was hidden
                ApiPreviewPanel.createOrShow(context.extensionUri);
            } else {
                // Otherwise create new
                ApiPreviewPanel.createOrShow(context.extensionUri);
            }
        })
    );

    // 2. Load Request
    context.subscriptions.push(
        vscode.commands.registerCommand('apiPreview.loadRequest', async (request: ApiRequest) => {
            ApiPreviewPanel.createOrShow(context.extensionUri);
            ApiPreviewPanel.loadRequest(request);
        })
    );

    // 3. Delete Request
    context.subscriptions.push(
        vscode.commands.registerCommand('apiPreview.deleteRequest', (request: ApiRequest) => {
            historyProvider.deleteRequest(request);
        })
    );

    // 4. Save Logic
    ApiPreviewPanel.onSaveRequest = async (requestData) => {
        const label = await vscode.window.showInputBox({
            prompt: 'Enter a name for this request',
            placeHolder: 'e.g., Get All Users',
            value: requestData.label === 'Untitled Request' ? '' : requestData.label
        });

        if (label) {
            const newRequest: ApiRequest = {
                ...requestData,
                label: label,
                id: requestData.id || Date.now().toString()
            };
            historyProvider.addRequest(newRequest);
            vscode.window.showInformationMessage(`Request saved: ${label}`);
        }
    };
}

export function deactivate() {}