import * as vscode from 'vscode';
import { ApiRequest } from './types';

export class ApiPreviewPanel {
  static currentPanel: ApiPreviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  // Callback to save request back to sidebar
  public static onSaveRequest: ((req: ApiRequest) => void) | undefined;

  static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ApiPreviewPanel.currentPanel) {
      ApiPreviewPanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'apiPreview',
      'API Preview',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
      }
    );

    ApiPreviewPanel.currentPanel = new ApiPreviewPanel(panel, extensionUri);
  }

  // Load a specific request into the webview
  static loadRequest(request: ApiRequest) {
      if (!ApiPreviewPanel.currentPanel) {
          // If panel is closed, create it first
          // Note: In a real app you might need to pass extensionUri here via a singleton manager
          // For now, we assume the user has opened it once or we rely on the command
          return; 
      }
      ApiPreviewPanel.currentPanel.panel.reveal();
      ApiPreviewPanel.currentPanel.panel.webview.postMessage({
          type: 'load',
          data: request
      });
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    this.panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
            case 'fetch':
                this.handleFetch(message);
                break;
            case 'save':
                if (ApiPreviewPanel.onSaveRequest) {
                    ApiPreviewPanel.onSaveRequest(message.data);
                    vscode.window.showInformationMessage(`Request saved: ${message.data.label}`);
                }
                break;
            case 'info':
                vscode.window.showInformationMessage(message.message);
                break;
            case 'error':
                vscode.window.showErrorMessage(message.message);
                break;
        }
      },
      null,
      this._disposables
    );

    this.panel.webview.html = this.getHtml();
  }

  private async handleFetch(message: any) {
    try {
        const startTime = Date.now();
        const response = await fetch(message.url, {
            method: message.method || 'GET',
            headers: message.headers || {},
            body: ['GET', 'HEAD'].includes(message.method) ? undefined : JSON.stringify(message.body)
        });
        const endTime = Date.now();

        const text = await response.text();
        let data;
        let isJson = false;

        try {
            data = JSON.parse(text);
            isJson = true;
        } catch {
            data = text;
        }

        this.panel.webview.postMessage({
            type: 'response',
            status: response.status,
            time: endTime - startTime,
            size: new TextEncoder().encode(text).length,
            data,
            isJson
        });

    } catch (error: any) {
        this.panel.webview.postMessage({
            type: 'error',
            message: error.message
        });
    }
  }

  public dispose() {
    ApiPreviewPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>API Preview</title>
<style>
  :root {
    --bg-color: var(--vscode-editor-background);
    --panel-bg: var(--vscode-sideBar-background);
    --input-bg: var(--vscode-input-background);
    --input-fg: var(--vscode-input-foreground);
    --border-color: var(--vscode-panel-border);
    --text-primary: var(--vscode-editor-foreground);
    --accent-color: var(--vscode-button-background);
    --accent-hover: var(--vscode-button-hoverBackground);
    --font-mono: var(--vscode-editor-font-family);
  }
  body { background: var(--bg-color); color: var(--text-primary); margin: 0; display: flex; flex-direction: column; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, sans-serif; overflow: hidden; }
  
  /* Layout */
  .top-bar { display: flex; gap: 8px; padding: 10px; background: var(--panel-bg); border-bottom: 1px solid var(--border-color); align-items: center; }
  .container { display: flex; flex: 1; flex-direction: column; overflow: hidden; }
  .split { display: flex; flex: 1; overflow: hidden; }
  .pane { flex: 1; display: flex; flex-direction: column; border-right: 1px solid var(--border-color); min-width: 200px; }
  .pane:last-child { border-right: none; }

  /* Inputs */
  select, input { background: var(--input-bg); color: var(--input-fg); border: 1px solid var(--border-color); padding: 6px; border-radius: 2px; outline: none; }
  input { flex: 1; }
  button { background: var(--accent-color); color: white; border: none; padding: 6px 14px; border-radius: 2px; cursor: pointer; }
  button:hover { background: var(--accent-hover); }
  button.secondary { background: transparent; border: 1px solid var(--border-color); }

  /* Tabs */
  .tabs { display: flex; background: var(--panel-bg); border-bottom: 1px solid var(--border-color); }
  .tab { padding: 8px 16px; cursor: pointer; opacity: 0.7; font-size: 12px; }
  .tab:hover { opacity: 1; background: rgba(255,255,255,0.05); }
  .tab.active { opacity: 1; border-bottom: 2px solid var(--accent-color); font-weight: 600; }

  /* Editors */
  .editor-wrapper { flex: 1; display: none; position: relative; }
  .editor-wrapper.active { display: flex; }
  textarea { width: 100%; height: 100%; background: var(--bg-color); color: #CE9178; border: none; resize: none; padding: 10px; font-family: var(--font-mono); outline: none; }

  /* Response */
  .meta-bar { padding: 6px 10px; background: var(--panel-bg); font-size: 11px; display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); }
  .status { font-weight: bold; }
  .status.s-2 { color: #4caf50; }
  .status.s-4, .status.s-5 { color: #f44336; }
  
  /* JSON Tree Viewer CSS */
  .json-viewer { padding: 10px; overflow: auto; font-family: var(--font-mono); font-size: 13px; line-height: 1.5; }
  details > summary { cursor: pointer; list-style: none; outline: none; }
  details > summary::-webkit-details-marker { display: none; } /* Hide default triangle */
  details > summary::before { content: '▶'; display: inline-block; font-size: 10px; margin-right: 5px; transform: rotate(0deg); transition: 0.1s; opacity: 0.7; }
  details[open] > summary::before { transform: rotate(90deg); }
  
  .key { color: #9cdcfe; } /* Blue */
  .string { color: #ce9178; } /* Orange */
  .number { color: #b5cea8; } /* Green */
  .boolean { color: #569cd6; } /* Dark Blue */
  .null { color: #569cd6; }
</style>
</head>
<body>

  <div class="top-bar">
    <select id="method">
      <option value="GET">GET</option>
      <option value="POST">POST</option>
      <option value="PUT">PUT</option>
      <option value="DELETE">DELETE</option>
      <option value="PATCH">PATCH</option>
    </select>
    <input id="url" type="text" placeholder="https://api.example.com/users" />
    <button onclick="send()" id="send-btn">Send</button>
    <button class="secondary" onclick="save()" title="Save Request">💾</button>
  </div>

  <div class="split">
    <div class="pane" style="max-width: 40%;">
       <div class="tabs">
         <div class="tab active" onclick="switchTab('body')">Body</div>
         <div class="tab" onclick="switchTab('headers')">Headers</div>
       </div>
       <div id="tab-body" class="editor-wrapper active">
         <textarea id="body" placeholder='{ "key": "value" }'></textarea>
       </div>
       <div id="tab-headers" class="editor-wrapper">
         <textarea id="headers" placeholder='{ "Content-Type": "application/json" }'></textarea>
       </div>
    </div>

    <div class="pane">
      <div class="meta-bar">
        <span>Status: <span id="status">--</span></span>
        <span>Time: <span id="time">0ms</span> | Size: <span id="size">0B</span></span>
      </div>
      <div id="output" class="json-viewer"></div>
    </div>
  </div>

<script>
  const vscode = acquireVsCodeApi();
  let currentRequestId = null;

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.editor-wrapper').forEach(e => e.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('tab-' + name).classList.add('active');
  }

  // --- JSON Tree Renderer ---
  function createJsonTree(data) {
    if (data === null) return '<span class="null">null</span>';
    if (typeof data === 'boolean') return '<span class="boolean">' + data + '</span>';
    if (typeof data === 'number') return '<span class="number">' + data + '</span>';
    if (typeof data === 'string') return '<span class="string">"' + data + '"</span>';

    if (Array.isArray(data)) {
        if (data.length === 0) return '[]';
        let html = '<details open><summary>Array [' + data.length + ']</summary><div style="padding-left: 20px;">';
        data.forEach(item => {
            html += '<div>' + createJsonTree(item) + ',</div>';
        });
        html += '</div></details>';
        return html;
    }

    if (typeof data === 'object') {
        if (Object.keys(data).length === 0) return '{}';
        let html = '<details open><summary>Object</summary><div style="padding-left: 20px;">';
        for (const key in data) {
            html += '<div><span class="key">"' + key + '"</span>: ' + createJsonTree(data[key]) + ',</div>';
        }
        html += '</div></details>';
        return html;
    }
  }

  // --- Logic ---
  window.addEventListener('message', event => {
    const msg = event.data;
    
    // LOAD Request
    if (msg.type === 'load') {
        const req = msg.data;
        currentRequestId = req.id;
        document.getElementById('method').value = req.method;
        document.getElementById('url').value = req.url;
        document.getElementById('headers').value = req.headers || '';
        document.getElementById('body').value = req.body || '';
        // Auto trigger? Optional. Let's not auto-trigger, just fill.
    }

    // Response
    if (msg.type === 'response') {
        document.getElementById('send-btn').textContent = 'Send';
        const st = document.getElementById('status');
        st.textContent = msg.status;
        st.className = 'status s-' + Math.floor(msg.status / 100);
        
        document.getElementById('time').textContent = msg.time + 'ms';
        document.getElementById('size').textContent = msg.size + 'B';

        const out = document.getElementById('output');
        if (msg.isJson) {
            out.innerHTML = createJsonTree(msg.data);
        } else {
            out.textContent = msg.data;
        }
    }
    
    if (msg.type === 'error') {
        document.getElementById('send-btn').textContent = 'Send';
        document.getElementById('output').innerHTML = '<span style="color:var(--vscode-errorForeground)">' + msg.message + '</span>';
    }
  });

  function send() {
    document.getElementById('send-btn').textContent = '...';
    
    let headers = {}, body = null;
    try {
        const hVal = document.getElementById('headers').value;
        if(hVal) headers = JSON.parse(hVal);
    } catch(e) { vscode.postMessage({type: 'error', message: 'Invalid Headers JSON'}); return; }

    try {
        const bVal = document.getElementById('body').value;
        if(bVal) body = JSON.parse(bVal);
    } catch(e) { vscode.postMessage({type: 'error', message: 'Invalid Body JSON'}); return; }

    vscode.postMessage({
        type: 'fetch',
        method: document.getElementById('method').value,
        url: document.getElementById('url').value,
        headers,
        body
    });
  }

  function save() {
    const name = prompt("Enter a name for this request:"); // Note: Prompt doesn't work in VS Code webview easily. 
    // We will send 'save' to extension, extension will open InputBox, then save.
    
    vscode.postMessage({
        type: 'save',
        data: {
            id: currentRequestId || Date.now().toString(),
            label: name || 'Untitled Request', // Extension will ask properly
            method: document.getElementById('method').value,
            url: document.getElementById('url').value,
            headers: document.getElementById('headers').value,
            body: document.getElementById('body').value
        }
    });
  }
</script>
</body>
</html>`;
  }
}