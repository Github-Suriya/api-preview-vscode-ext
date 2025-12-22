import * as vscode from 'vscode';
import { ApiPreviewPanel } from './ApiPreviewPanel';
import { HistoryProvider } from './HistoryProvider';
import { ApiRequest } from './types';

export function activate(context: vscode.ExtensionContext) {
    
    // 1. Initialize History Provider
    const historyProvider = new HistoryProvider(context);
    vscode.window.registerTreeDataProvider('apiPreviewSidebar', historyProvider);

    // 2. Open Panel Command
    context.subscriptions.push(
        vscode.commands.registerCommand('apiPreview.open', () => {
            ApiPreviewPanel.createOrShow(context.extensionUri);
        })
    );

    // 3. Load Request Command (from Sidebar Click)
    context.subscriptions.push(
        vscode.commands.registerCommand('apiPreview.loadRequest', async (request: ApiRequest) => {
            // Ensure panel is open
            ApiPreviewPanel.createOrShow(context.extensionUri);
            // Send data to panel
            if (ApiPreviewPanel.currentPanel) {
                ApiPreviewPanel.loadRequest(request);
            }
        })
    );

    // 4. Delete Request Command (from Context Menu)
    context.subscriptions.push(
        vscode.commands.registerCommand('apiPreview.deleteRequest', (request: ApiRequest) => {
            historyProvider.deleteRequest(request);
        })
    );

    // 5. Handle "Save" event from Webview
    ApiPreviewPanel.onSaveRequest = async (requestData) => {
        // Ask user for a name
        const label = await vscode.window.showInputBox({
            prompt: 'Enter a name for this request',
            placeHolder: 'e.g., Get All Users',
            value: requestData.label === 'Untitled Request' ? '' : requestData.label
        });

        if (label) {
            const newRequest: ApiRequest = {
                ...requestData,
                label: label,
                // Ensure unique ID if saving as new
                id: requestData.id || Date.now().toString()
            };
            historyProvider.addRequest(newRequest);
        }
    };
}

export function deactivate() {}