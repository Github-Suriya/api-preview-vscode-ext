import * as vscode from 'vscode';

export class ApiPreviewPanel {
  static currentPanel: ApiPreviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;

  static createOrShow(extensionUri: vscode.Uri) {
    if (ApiPreviewPanel.currentPanel) {
      ApiPreviewPanel.currentPanel.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'apiPreview',
      'API Preview',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
      }
    );

    ApiPreviewPanel.currentPanel = new ApiPreviewPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;

    this.panel.onDidDispose(() => {
      ApiPreviewPanel.currentPanel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message.type === 'fetch') {
          try {
            const response = await fetch(message.url, {
              method: message.method || 'GET',
              headers: message.headers || {},
              body: message.body ? JSON.stringify(message.body) : undefined
            });

            const text = await response.text();
            let data;

            try {
              data = JSON.parse(text);
            } catch {
              data = text;
            }

            this.panel.webview.postMessage({
              type: 'response',
              status: response.status,
              data
            });

          } catch (error: any) {
            this.panel.webview.postMessage({
              type: 'error',
              message: error.message
            });
          }
        }
      }
    );

    this.panel.webview.html = this.getHtml();
  }
  
  private getHtml(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  :root {
    --bg-color: #1e1e1e;
    --panel-bg: #252526;
    --input-bg: #3c3c3c;
    --border-color: #444;
    --text-primary: #e0e0e0;
    --text-secondary: #a0a0a0;
    --accent-color: #0078d4; /* VS Code Blue / Postman-ish Blue */
    --accent-hover: #026ec1;
    --success-color: #4caf50;
    --error-color: #f44336;
    --font-mono: 'Menlo', 'Monaco', 'Courier New', monospace;
    --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  * { box-sizing: border-box; }

  body {
    background-color: var(--bg-color);
    color: var(--text-primary);
    font-family: var(--font-sans);
    margin: 0;
    padding: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* --- Top Bar (Method, URL, Send) --- */
  .top-bar {
    display: flex;
    padding: 10px;
    background-color: var(--panel-bg);
    border-bottom: 1px solid var(--border-color);
    gap: 8px;
    align-items: center;
  }

  .method-select {
    background-color: var(--input-bg);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    padding: 8px 12px;
    border-radius: 4px;
    font-weight: bold;
    font-family: var(--font-mono);
    cursor: pointer;
    width: 100px;
  }

  .url-input {
    flex-grow: 1;
    background-color: var(--input-bg);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    padding: 8px 12px;
    border-radius: 4px;
    font-family: var(--font-mono);
  }

  .url-input:focus, .method-select:focus {
    outline: 1px solid var(--accent-color);
    border-color: var(--accent-color);
  }

  .send-btn {
    background-color: var(--accent-color);
    color: white;
    border: none;
    padding: 8px 24px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    transition: background 0.2s;
  }

  .send-btn:hover { background-color: var(--accent-hover); }

  /* --- Main Split Area --- */
  .container {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  /* --- Tabs --- */
  .tabs {
    display: flex;
    background-color: var(--panel-bg);
    border-bottom: 1px solid var(--border-color);
  }

  .tab {
    padding: 10px 20px;
    cursor: pointer;
    color: var(--text-secondary);
    font-size: 0.9em;
    border-bottom: 2px solid transparent;
  }

  .tab:hover { color: var(--text-primary); }
  
  .tab.active {
    color: var(--text-primary);
    border-bottom: 2px solid var(--accent-color);
  }

  /* --- Input Area --- */
  .input-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 10px;
    min-height: 150px;
    border-bottom: 1px solid var(--border-color);
  }

  .editor-wrapper {
    display: none; /* Hidden by default */
    flex-direction: column;
    height: 100%;
  }

  .editor-wrapper.active { display: flex; }

  textarea.code-editor {
    flex: 1;
    background-color: #1e1e1e; /* Darker than panel */
    color: #ce9178; /* JSON string color */
    border: 1px solid var(--border-color);
    padding: 10px;
    font-family: var(--font-mono);
    font-size: 13px;
    resize: none;
    outline: none;
  }

  textarea.code-editor:focus { border-color: #555; }

  /* --- Response Area --- */
  .response-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-color);
    overflow: hidden;
  }

  .response-header {
    padding: 8px 15px;
    background-color: var(--panel-bg);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85em;
    color: var(--text-secondary);
  }

  .status-badge {
    font-weight: bold;
    color: var(--text-primary);
  }
  .status-badge.success { color: var(--success-color); }
  .status-badge.error { color: var(--error-color); }

  .response-body {
    flex: 1;
    padding: 10px;
    overflow: auto;
    margin: 0;
    color: #9cdcfe; /* VS Code Variable Blue */
    font-family: var(--font-mono);
    font-size: 13px;
  }
</style>
</head>
<body>

  <div class="top-bar">
    <select id="method" class="method-select">
      <option value="GET">GET</option>
      <option value="POST">POST</option>
      <option value="PUT">PUT</option>
      <option value="DELETE">DELETE</option>
      <option value="PATCH">PATCH</option>
    </select>
    <input id="url" class="url-input" type="text" placeholder="Enter request URL" />
    <button onclick="send()" class="send-btn">Send</button>
  </div>

  <div class="container">
    
    <div class="tabs">
      <div class="tab active" onclick="switchTab('body')">Body</div>
      <div class="tab" onclick="switchTab('headers')">Headers</div>
    </div>

    <div class="input-section">
      
      <div id="tab-body" class="editor-wrapper active">
        <textarea id="body" class="code-editor" placeholder='{\n  "key": "value"\n}' spellcheck="false"></textarea>
      </div>

      <div id="tab-headers" class="editor-wrapper">
        <textarea id="headers" class="code-editor" placeholder='{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer token"\n}' spellcheck="false"></textarea>
      </div>

    </div>

    <div class="response-section">
      <div class="response-header">
        <span>Response</span>
        <span id="status-display" class="status-badge"></span>
      </div>
      <pre id="output" class="response-body">Hit 'Send' to see the response...</pre>
    </div>

  </div>

<script>
  const vscode = acquireVsCodeApi();

  // Handle Tab Switching
  function switchTab(tabName) {
    // Update Tab UI
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    // Show/Hide Content
    document.querySelectorAll('.editor-wrapper').forEach(w => w.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
  }

  // Handle Messages from Extension
  window.addEventListener('message', event => {
    const msg = event.data;
    const output = document.getElementById('output');
    const statusDisplay = document.getElementById('status-display');

    if (msg.type === 'response') {
      // Status formatting
      statusDisplay.textContent = 'Status: ' + msg.status;
      statusDisplay.className = 'status-badge ' + (msg.status >= 200 && msg.status < 300 ? 'success' : 'error');

      // Body formatting
      output.textContent = JSON.stringify(msg.data, null, 2);
    }

    if (msg.type === 'error') {
      statusDisplay.textContent = 'Error';
      statusDisplay.className = 'status-badge error';
      output.textContent = msg.message;
    }
  });

  // Send Logic
  function send() {
    let headers = {};
    let body = null;
    const output = document.getElementById('output');
    
    output.textContent = 'Loading...';
    document.getElementById('status-display').textContent = '';

    try {
      const headersText = document.getElementById('headers').value.trim();
      if(headersText) headers = JSON.parse(headersText);
    } catch (e) {
      alert('Invalid JSON in Headers');
      return;
    }

    try {
      const bodyText = document.getElementById('body').value.trim();
      if(bodyText) body = JSON.parse(bodyText);
    } catch (e) {
      alert('Invalid JSON in Body');
      return;
    }

    vscode.postMessage({
      type: 'fetch',
      method: document.getElementById('method').value,
      url: document.getElementById('url').value,
      headers,
      body
    });
  }
</script>

</body>
</html>`;
  }
}
