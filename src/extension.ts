import * as vscode from 'vscode';
import { ApiPreviewPanel } from './ApiPreviewPanel';
import { HistoryProvider } from './HistoryProvider';
import { ApiRequest, ApiFolder, ApiItem } from './types';

export function activate(context: vscode.ExtensionContext) {
    
    const historyProvider = new HistoryProvider(context);
    vscode.window.registerTreeDataProvider('apiPreviewSidebar', historyProvider);

    // 1. Open New Request
    context.subscriptions.push(
        vscode.commands.registerCommand('apiPreview.open', () => {
            if (ApiPreviewPanel.currentPanel) {
                ApiPreviewPanel.reset();
                ApiPreviewPanel.createOrShow(context.extensionUri);
            } else {
                ApiPreviewPanel.createOrShow(context.extensionUri);
            }
        })
    );

    // 2. Create Folder Command
    context.subscriptions.push(
        vscode.commands.registerCommand('apiPreview.createFolder', async () => {
            const name = await vscode.window.showInputBox({ placeHolder: 'Folder Name' });
            if (name) {
                historyProvider.createFolder(name);
            }
        })
    );

    // 3. Load Request
    context.subscriptions.push(
        vscode.commands.registerCommand('apiPreview.loadRequest', async (item: ApiItem) => {
            if (item.type === 'request') {
                ApiPreviewPanel.createOrShow(context.extensionUri);
                ApiPreviewPanel.loadRequest(item);
            }
        })
    );

    // 4. Delete Item (Folder or Request)
    context.subscriptions.push(
        vscode.commands.registerCommand('apiPreview.deleteItem', (item: ApiItem) => {
            historyProvider.deleteItem(item);
        })
    );

    // 5. Enhanced Save Logic
    ApiPreviewPanel.onSaveRequest = async (requestData) => {
        // Step 1: Ask for Name
        const label = await vscode.window.showInputBox({
            prompt: 'Enter a name for this request',
            placeHolder: 'e.g., Get Users',
            value: requestData.label === 'Untitled Request' ? '' : requestData.label
        });
        if (!label) return;

        // Step 2: Ask for Location (Folder or Root)
        const folders = historyProvider.getAllFolders();
        const folderOptions = [
            { label: '$(root-folder) Root', id: undefined }, // Option for Root
            ...folders
        ];

        const selectedFolder = await vscode.window.showQuickPick(folderOptions, {
            placeHolder: 'Select a location to save'
        });

        // If user cancelled selection, stop
        if (!selectedFolder && folders.length > 0) return; 

        const newRequest: ApiRequest = {
            ...requestData,
            type: 'request',
            label: label,
            id: requestData.id || Date.now().toString()
        };

        await historyProvider.addRequest(newRequest, selectedFolder?.id);
        vscode.window.showInformationMessage(`Saved "${label}" to ${selectedFolder?.label || 'Root'}`);
    };
}

export function deactivate() {}