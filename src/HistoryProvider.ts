import * as vscode from 'vscode';
import { ApiRequest } from './types';
import { ApiPreviewPanel } from './ApiPreviewPanel';

export class HistoryProvider implements vscode.TreeDataProvider<ApiRequest> {
    private _onDidChangeTreeData: vscode.EventEmitter<ApiRequest | undefined | null | void> = new vscode.EventEmitter<ApiRequest | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ApiRequest | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private context: vscode.ExtensionContext) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ApiRequest): vscode.TreeItem {
        const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
        item.description = element.method;
        item.tooltip = `${element.method} ${element.url}`;
        item.iconPath = new vscode.ThemeIcon(this.getIconForMethod(element.method));
        
        // Command to run when clicking the item
        item.command = {
            command: 'apiPreview.loadRequest',
            title: 'Load Request',
            arguments: [element]
        };

        return item;
    }

    getChildren(element?: ApiRequest): Thenable<ApiRequest[]> {
        if (element) {
            return Promise.resolve([]);
        }
        const requests = this.context.workspaceState.get<ApiRequest[]>('savedRequests') || [];
        return Promise.resolve(requests.reverse()); // Show newest first
    }

    async addRequest(request: ApiRequest) {
        const requests = this.context.workspaceState.get<ApiRequest[]>('savedRequests') || [];
        // Remove if exists to update it (move to top)
        const filtered = requests.filter(r => r.id !== request.id);
        filtered.push(request);
        await this.context.workspaceState.update('savedRequests', filtered);
        this.refresh();
    }

    async deleteRequest(request: ApiRequest) {
        const requests = this.context.workspaceState.get<ApiRequest[]>('savedRequests') || [];
        const filtered = requests.filter(r => r.id !== request.id);
        await this.context.workspaceState.update('savedRequests', filtered);
        this.refresh();
    }

    private getIconForMethod(method: string): string {
        switch (method) {
            case 'GET': return 'arrow-down';
            case 'POST': return 'arrow-up';
            case 'PUT': return 'edit';
            case 'DELETE': return 'trash';
            default: return 'globe';
        }
    }
}