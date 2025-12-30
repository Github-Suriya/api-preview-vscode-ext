import * as vscode from 'vscode';
import { ApiItem, ApiFolder, ApiRequest } from './types';

export class HistoryProvider implements vscode.TreeDataProvider<ApiItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ApiItem | undefined | null | void> = new vscode.EventEmitter<ApiItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ApiItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private context: vscode.ExtensionContext) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ApiItem): vscode.TreeItem {
        if (element.type === 'folder') {
            const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
            item.contextValue = 'folder';
            item.iconPath = new vscode.ThemeIcon('folder');
            return item;
        } else {
            const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
            item.contextValue = 'request';
            item.description = element.method;
            item.tooltip = `${element.method} ${element.url}`;
            item.iconPath = new vscode.ThemeIcon(this.getIconForMethod(element.method));
            item.command = {
                command: 'apiPreview.loadRequest',
                title: 'Load Request',
                arguments: [element]
            };
            return item;
        }
    }

    getChildren(element?: ApiItem): Thenable<ApiItem[]> {
        if (element) {
            // If element is a folder, return its children
            if (element.type === 'folder') {
                return Promise.resolve(element.children || []);
            }
            return Promise.resolve([]);
        } else {
            // Root: Get from storage
            const items = this.context.workspaceState.get<ApiItem[]>('savedItems') || [];
            return Promise.resolve(items);
        }
    }

    // --- Data Management ---

    async createFolder(name: string) {
        const items = this.getItems();
        const newFolder: ApiFolder = {
            id: Date.now().toString(),
            type: 'folder',
            label: name,
            children: []
        };
        items.push(newFolder);
        await this.saveItems(items);
    }

    async addRequest(request: ApiRequest, folderId?: string) {
        const items = this.getItems();

        if (folderId) {
            // Add to specific folder
            const folder = this.findFolder(items, folderId);
            if (folder) {
                // Remove existing if updating same ID in same folder
                folder.children = folder.children.filter(c => c.id !== request.id);
                folder.children.push(request);
            }
        } else {
            // Add to Root
            // Remove if exists
            const filtered = items.filter(i => i.id !== request.id);
            filtered.push(request);
            await this.saveItems(filtered);
            return;
        }
        await this.saveItems(items);
    }

    async deleteItem(item: ApiItem) {
        let items = this.getItems();
        
        if (this.isRootItem(items, item.id)) {
            items = items.filter(i => i.id !== item.id);
        } else {
            // It's inside a folder, we need to find parent and remove
            this.removeFromParent(items, item.id);
        }
        
        await this.saveItems(items);
    }

    // --- Helpers ---

    private getItems(): ApiItem[] {
        return this.context.workspaceState.get<ApiItem[]>('savedItems') || [];
    }

    private async saveItems(items: ApiItem[]) {
        await this.context.workspaceState.update('savedItems', items);
        this.refresh();
    }

    private findFolder(items: ApiItem[], folderId: string): ApiFolder | undefined {
        for (const item of items) {
            if (item.type === 'folder') {
                if (item.id === folderId) return item;
                const found = this.findFolder(item.children, folderId);
                if (found) return found;
            }
        }
        return undefined;
    }

    private isRootItem(items: ApiItem[], id: string): boolean {
        return items.some(i => i.id === id);
    }

    private removeFromParent(items: ApiItem[], id: string) {
        for (const item of items) {
            if (item.type === 'folder') {
                const index = item.children.findIndex(c => c.id === id);
                if (index > -1) {
                    item.children.splice(index, 1);
                    return;
                }
                this.removeFromParent(item.children, id);
            }
        }
    }

    // Helper to list all folders for QuickPick
    public getAllFolders(): { label: string, id: string }[] {
        const folders: { label: string, id: string }[] = [];
        const traverse = (items: ApiItem[]) => {
            for (const item of items) {
                if (item.type === 'folder') {
                    folders.push({ label: `$(folder) ${item.label}`, id: item.id });
                    traverse(item.children);
                }
            }
        };
        traverse(this.getItems());
        return folders;
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