import * as vscode from 'vscode';
import { ApiPreviewPanel } from './ApiPreviewPanel';

export function activate(context: vscode.ExtensionContext) {
  const command = vscode.commands.registerCommand(
    'apiPreview.open',
    () => {
      ApiPreviewPanel.createOrShow(context.extensionUri);
    }
  );

  context.subscriptions.push(command);
}

export function deactivate() {}
