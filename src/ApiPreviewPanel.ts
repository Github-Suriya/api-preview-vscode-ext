import * as vscode from 'vscode';
import { ApiRequest } from './types';
import { VariableProcessor } from './VariableProcessor';

export class ApiPreviewPanel {
  static currentPanel: ApiPreviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

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
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
        retainContextWhenHidden: true
      }
    );

    ApiPreviewPanel.currentPanel = new ApiPreviewPanel(panel, extensionUri);
  }

  static reset() {
    if (ApiPreviewPanel.currentPanel) {
        ApiPreviewPanel.currentPanel.panel.webview.postMessage({ type: 'clear' });
    }
  }

  static loadRequest(request: ApiRequest) {
      if (!ApiPreviewPanel.currentPanel) { return; }
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
                }
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
        const finalUrl = VariableProcessor.process(message.url);
        const finalHeaders = VariableProcessor.processObject(message.headers || {});
        
        let finalBody = message.body;
        if (message.body && typeof message.body === 'object') {
            const bodyStr = JSON.stringify(message.body);
            const processedBodyStr = VariableProcessor.process(bodyStr);
            finalBody = JSON.parse(processedBodyStr);
        }

        const startTime = Date.now();
        const response = await fetch(finalUrl, {
            method: message.method || 'GET',
            headers: finalHeaders,
            body: ['GET', 'HEAD'].includes(message.method) ? undefined : JSON.stringify(finalBody)
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
      if (x) x.dispose();
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
    --text-muted: var(--vscode-descriptionForeground);
    --accent-color: var(--vscode-button-background);
    --accent-hover: var(--vscode-button-hoverBackground);
    --font-mono: var(--vscode-editor-font-family);
    --resizer-bg: var(--vscode-scrollbarSlider-background);
    --resizer-hover: var(--vscode-scrollbarSlider-hoverBackground);
    --focus-border: var(--vscode-focusBorder);
    --badge-bg: var(--vscode-badge-background);
    --badge-fg: var(--vscode-badge-foreground);
  }
  
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body { 
    background: var(--bg-color); 
    color: var(--text-primary); 
    display: flex; 
    flex-direction: column; 
    height: 100vh; 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
    overflow: hidden;
    font-size: 13px;
  }
  
  /* Top Bar - Hero Section */
  .top-bar { 
    display: flex; 
    gap: 10px; 
    padding: 16px 20px; 
    background: linear-gradient(180deg, var(--panel-bg) 0%, var(--bg-color) 100%);
    border-bottom: 1px solid var(--border-color); 
    align-items: center; 
    flex-shrink: 0;
  }

  /* Method Selector with Colors */
  .method-wrapper {
    position: relative;
  }

  select#method { 
    background: var(--input-bg); 
    color: var(--input-fg); 
    border: 1px solid var(--border-color); 
    padding: 10px 32px 10px 14px;
    border-radius: 8px; 
    outline: none; 
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.5px;
    cursor: pointer;
    appearance: none;
    min-width: 100px;
    transition: all 0.2s ease;
  }

  select#method:hover {
    border-color: var(--focus-border);
  }

  select#method:focus {
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px rgba(var(--accent-color), 0.15);
  }

  .method-wrapper::after {
    content: '▼';
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 8px;
    opacity: 0.6;
    pointer-events: none;
  }

  /* URL Input */
  .url-input-wrapper {
    flex: 1;
    position: relative;
  }

  input#url { 
    width: 100%;
    background: var(--input-bg); 
    color: var(--input-fg); 
    border: 1px solid var(--border-color); 
    padding: 10px 16px;
    border-radius: 8px; 
    outline: none;
    font-family: var(--font-mono);
    font-size: 13px;
    transition: all 0.2s ease;
  }

  input#url::placeholder {
    color: var(--text-muted);
    opacity: 0.7;
  }

  input#url:hover {
    border-color: var(--focus-border);
  }

  input#url:focus {
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.1);
  }

  /* Send Button - Primary CTA */
  .btn-send { 
    background: linear-gradient(135deg, var(--accent-color) 0%, var(--accent-hover) 100%);
    color: white; 
    border: none; 
    padding: 10px 24px;
    border-radius: 8px; 
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.3px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .btn-send:hover { 
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .btn-send:active {
    transform: translateY(0);
  }

  .btn-send.loading {
    opacity: 0.8;
    pointer-events: none;
  }

  .btn-send .icon {
    font-size: 14px;
  }

  /* Save Button */
  .btn-save { 
    background: transparent;
    border: 1px solid var(--border-color); 
    width: 40px;
    height: 40px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 16px;
  }

  .btn-save:hover {
    background: var(--input-bg);
    border-color: var(--focus-border);
    transform: scale(1.05);
  }

  /* Main Container */
  .container { 
    display: flex; 
    flex-direction: column; 
    flex: 1; 
    overflow: hidden; 
  }

  /* Panes */
  .pane-top { 
    display: flex; 
    flex-direction: column; 
    min-height: 120px;
    height: 45%;
    overflow: hidden;
    background: var(--bg-color);
  }

  .pane-bottom { 
    display: flex; 
    flex-direction: column; 
    flex: 1; 
    min-height: 120px;
    overflow: hidden;
    background: var(--bg-color);
  }

  /* Resizer */
  .resizer {
    height: 6px;
    background: transparent;
    cursor: row-resize;
    transition: all 0.2s ease;
    position: relative;
    flex-shrink: 0;
    z-index: 10;
  }

  .resizer::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 4px;
    background: var(--border-color);
    border-radius: 2px;
    transition: all 0.2s ease;
  }

  .resizer:hover::before, 
  .resizer.dragging::before {
    background: var(--accent-color);
    width: 60px;
  }

  /* Tabs */
  .tabs { 
    display: flex; 
    background: var(--panel-bg);
    padding: 0 16px;
    gap: 4px;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .tab { 
    padding: 12px 20px;
    cursor: pointer; 
    opacity: 0.6;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.3px;
    text-transform: uppercase;
    position: relative;
    transition: all 0.2s ease;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }

  .tab:hover {
    opacity: 0.85;
    background: rgba(255,255,255,0.03);
  }

  .tab.active { 
    opacity: 1;
    border-bottom-color: var(--accent-color);
    color: var(--accent-color);
  }

  /* Editor Area */
  .editor-wrapper { 
    flex: 1; 
    display: none; 
    position: relative;
    overflow: hidden;
  }

  .editor-wrapper.active { 
    display: flex; 
  }

  textarea { 
    width: 100%; 
    height: 100%; 
    background: var(--bg-color); 
    color: var(--input-fg);
    border: none; 
    resize: none; 
    padding: 16px 20px;
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.6;
    outline: none;
    tab-size: 2;
  }

  textarea::placeholder {
    color: var(--text-muted);
    opacity: 0.5;
  }

  /* Response Section */
  .response-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: linear-gradient(180deg, var(--panel-bg) 0%, var(--bg-color) 100%);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .response-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    opacity: 0.7;
  }

  .response-meta {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }

  .meta-label {
    opacity: 0.6;
    font-size: 11px;
  }

  .meta-value {
    font-family: var(--font-mono);
    font-weight: 600;
  }

  /* Status Badge */
  .status-badge {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.3px;
  }

  .status-badge.s-2 { 
    background: rgba(76, 175, 80, 0.15);
    color: #4caf50;
  }

  .status-badge.s-3 { 
    background: rgba(255, 193, 7, 0.15);
    color: #ffc107;
  }

  .status-badge.s-4, 
  .status-badge.s-5 { 
    background: rgba(244, 67, 54, 0.15);
    color: #f44336;
  }

  .status-badge.s-0 {
    background: var(--input-bg);
    color: var(--text-muted);
  }

  /* Time/Size Pills */
  .pill {
    background: var(--input-bg);
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-family: var(--font-mono);
  }

  .pill.fast { color: #4caf50; }
  .pill.medium { color: #ffc107; }
  .pill.slow { color: #f44336; }
  
  /* JSON Viewer */
  .json-viewer { 
    flex: 1; 
    padding: 16px 20px;
    overflow: auto; 
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.7;
  }

  .json-viewer:empty::before {
    content: 'Response will appear here...';
    color: var(--text-muted);
    opacity: 0.5;
    font-style: italic;
  }

  /* JSON Tree Styling */
  .json-node {
    margin: 2px 0;
  }

  details { 
    margin-left: 0;
  }

  details > summary { 
    cursor: pointer; 
    outline: none; 
    list-style: none;
    padding: 2px 0;
    border-radius: 4px;
    transition: background 0.15s ease;
  }

  details > summary:hover {
    background: rgba(255,255,255,0.03);
  }

  details > summary::-webkit-details-marker { display: none; }

  details > summary::before { 
    content: '▸'; 
    display: inline-block; 
    font-size: 11px;
    margin-right: 6px;
    opacity: 0.5;
    transition: transform 0.15s ease;
    color: var(--accent-color);
  }

  details[open] > summary::before { 
    transform: rotate(90deg);
  }

  .json-content {
    padding-left: 20px;
    border-left: 1px solid var(--border-color);
    margin-left: 6px;
  }

  .bracket {
    color: var(--text-muted);
    opacity: 0.7;
  }

  .array-length, .object-hint {
    color: var(--text-muted);
    font-size: 11px;
    opacity: 0.6;
    margin-left: 4px;
  }

  .key { 
    color: #9cdcfe;
  }

  .colon {
    color: var(--text-muted);
    margin: 0 4px;
  }

  .string { 
    color: #ce9178;
  }

  .number { 
    color: #b5cea8;
  }

  .boolean { 
    color: #569cd6;
    font-weight: 600;
  }

  .null { 
    color: #569cd6;
    font-style: italic;
    opacity: 0.8;
  }

  .comma {
    color: var(--text-muted);
    opacity: 0.5;
  }

  /* Error Display */
  .error-message {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    background: rgba(244, 67, 54, 0.08);
    border: 1px solid rgba(244, 67, 54, 0.2);
    border-radius: 8px;
    margin: 16px;
  }

  .error-icon {
    font-size: 18px;
  }

  .error-text {
    color: #f44336;
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.5;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    opacity: 0.4;
    gap: 12px;
  }

  .empty-state-icon {
    font-size: 32px;
  }

  .empty-state-text {
    font-size: 13px;
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar { 
    width: 8px; 
    height: 8px; 
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb { 
    background: var(--vscode-scrollbarSlider-background);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover { 
    background: var(--vscode-scrollbarSlider-hoverBackground);
  }

  ::-webkit-scrollbar-corner {
    background: transparent;
  }

  /* Loading Animation */
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .loading-dots::after {
    content: '';
    animation: dots 1.5s infinite;
  }

  @keyframes dots {
    0% { content: ''; }
    25% { content: '.'; }
    50% { content: '..'; }
    75% { content: '...'; }
  }

  /* Method Colors */
  .method-get { color: #61affe; }
  .method-post { color: #49cc90; }
  .method-put { color: #fca130; }
  .method-delete { color: #f93e3e; }
  .method-patch { color: #50e3c2; }
</style>
</head>
<body>

  <div class="top-bar">
    <div class="method-wrapper">
      <select id="method" onchange="updateMethodColor()">
        <option value="GET">GET</option>
        <option value="POST">POST</option>
        <option value="PUT">PUT</option>
        <option value="DELETE">DELETE</option>
        <option value="PATCH">PATCH</option>
      </select>
    </div>
    <div class="url-input-wrapper">
      <input id="url" type="text" placeholder="Enter request URL  •  Use {{variable}} for dynamic values" />
    </div>
    <button class="btn-send" onclick="send()" id="send-btn">
      <span class="icon">▶</span>
      <span class="text">Send</span>
    </button>
    <button class="btn-save" onclick="save()" title="Save Request">💾</button>
  </div>

  <div class="container" id="container">
    
    <div class="pane-top" id="pane-top">
       <div class="tabs">
         <div class="tab active" onclick="switchTab('body')">Body</div>
         <div class="tab" onclick="switchTab('headers')">Headers</div>
       </div>
       <div id="tab-body" class="editor-wrapper active">
         <textarea id="body" placeholder='{\n  "key": "value",\n  "token": "{{variable}}"\n}' spellcheck="false"></textarea>
       </div>
       <div id="tab-headers" class="editor-wrapper">
         <textarea id="headers" placeholder='{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer {{token}}"\n}' spellcheck="false"></textarea>
       </div>
    </div>

    <div class="resizer" id="resizer"></div>

    <div class="pane-bottom" id="pane-bottom">
      <div class="response-header">
        <span class="response-title">Response</span>
        <div class="response-meta">
          <div class="meta-item">
            <span id="status" class="status-badge s-0">---</span>
          </div>
          <div class="meta-item">
            <span id="time" class="pill">0 ms</span>
          </div>
          <div class="meta-item">
            <span id="size" class="pill">0 B</span>
          </div>
        </div>
      </div>
      <div id="output" class="json-viewer"></div>
    </div>

  </div>

<script>
  const vscode = acquireVsCodeApi();
  let currentRequestId = null;

  // --- Method Color Update ---
  function updateMethodColor() {
    const select = document.getElementById('method');
    const method = select.value.toLowerCase();
    select.className = 'method-' + method;
  }
  updateMethodColor();

  // --- Resizer Logic ---
  const resizer = document.getElementById('resizer');
  const paneTop = document.getElementById('pane-top');
  const container = document.getElementById('container');
  let isResizing = false;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const containerTop = container.getBoundingClientRect().top;
    const newHeight = e.clientY - containerTop;
    const containerHeight = container.clientHeight;
    const percentage = (newHeight / containerHeight) * 100;
    if (percentage > 15 && percentage < 85) {
      paneTop.style.height = percentage + '%';
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      resizer.classList.remove('dragging');
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }
  });

  // --- Tabs Logic ---
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.editor-wrapper').forEach(e => e.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('tab-' + name).classList.add('active');
  }

  // --- Enhanced JSON Renderer ---
  function createJsonTree(data, isLast = true) {
    if (data === null) return '<span class="null">null</span>' + (isLast ? '' : '<span class="comma">,</span>');
    if (typeof data === 'boolean') return '<span class="boolean">' + data + '</span>' + (isLast ? '' : '<span class="comma">,</span>');
    if (typeof data === 'number') return '<span class="number">' + data + '</span>' + (isLast ? '' : '<span class="comma">,</span>');
    if (typeof data === 'string') return '<span class="string">"' + escapeHtml(data) + '"</span>' + (isLast ? '' : '<span class="comma">,</span>');
    
    if (Array.isArray(data)) {
      if (data.length === 0) return '<span class="bracket">[]</span>' + (isLast ? '' : '<span class="comma">,</span>');
      let html = '<details open><summary><span class="bracket">[</span><span class="array-length">' + data.length + ' items</span></summary><div class="json-content">';
      data.forEach((item, i) => {
        html += '<div class="json-node">' + createJsonTree(item, i === data.length - 1) + '</div>';
      });
      html += '</div><span class="bracket">]</span>' + (isLast ? '' : '<span class="comma">,</span>') + '</details>';
      return html;
    }
    
    if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length === 0) return '<span class="bracket">{}</span>' + (isLast ? '' : '<span class="comma">,</span>');
      let html = '<details open><summary><span class="bracket">{</span><span class="object-hint">' + keys.length + ' keys</span></summary><div class="json-content">';
      keys.forEach((key, i) => {
        html += '<div class="json-node"><span class="key">"' + escapeHtml(key) + '"</span><span class="colon">:</span> ' + createJsonTree(data[key], i === keys.length - 1) + '</div>';
      });
      html += '</div><span class="bracket">}</span>' + (isLast ? '' : '<span class="comma">,</span>') + '</details>';
      return html;
    }
    return String(data);
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function getTimeClass(ms) {
    if (ms < 200) return 'fast';
    if (ms < 1000) return 'medium';
    return 'slow';
  }

  // --- Message Handling ---
  window.addEventListener('message', event => {
    const msg = event.data;
    
    if (msg.type === 'clear') {
      currentRequestId = null;
      document.getElementById('method').value = 'GET';
      updateMethodColor();
      document.getElementById('url').value = '';
      document.getElementById('headers').value = '';
      document.getElementById('body').value = '';
      document.getElementById('output').innerHTML = '';
      document.getElementById('status').textContent = '---';
      document.getElementById('status').className = 'status-badge s-0';
      document.getElementById('time').textContent = '0 ms';
      document.getElementById('time').className = 'pill';
      document.getElementById('size').textContent = '0 B';
    }

    if (msg.type === 'load') {
      const req = msg.data;
      currentRequestId = req.id;
      document.getElementById('method').value = req.method;
      updateMethodColor();
      document.getElementById('url').value = req.url;
      document.getElementById('headers').value = req.headers || '';
      document.getElementById('body').value = req.body || '';
    }

    if (msg.type === 'response') {
      const sendBtn = document.getElementById('send-btn');
      sendBtn.classList.remove('loading');
      sendBtn.innerHTML = '<span class="icon">▶</span><span class="text">Send</span>';
      
      const st = document.getElementById('status');
      st.textContent = msg.status;
      st.className = 'status-badge s-' + Math.floor(msg.status / 100);
      
      const timeEl = document.getElementById('time');
      timeEl.textContent = msg.time + ' ms';
      timeEl.className = 'pill ' + getTimeClass(msg.time);
      
      document.getElementById('size').textContent = formatSize(msg.size);
      
      const out = document.getElementById('output');
      out.innerHTML = msg.isJson ? createJsonTree(msg.data) : '<pre>' + escapeHtml(msg.data) + '</pre>';
    }
    
    if (msg.type === 'error') {
      const sendBtn = document.getElementById('send-btn');
      sendBtn.classList.remove('loading');
      sendBtn.innerHTML = '<span class="icon">▶</span><span class="text">Send</span>';
      
      document.getElementById('output').innerHTML = '<div class="error-message"><span class="error-icon">⚠️</span><span class="error-text">' + escapeHtml(msg.message) + '</span></div>';
    }
  });

  function send() {
    const sendBtn = document.getElementById('send-btn');
    sendBtn.classList.add('loading');
    sendBtn.innerHTML = '<span class="icon">◌</span><span class="text loading-dots">Sending</span>';
    
    let headers = {}, body = null;
    try {
      const hVal = document.getElementById('headers').value.trim();
      if(hVal) headers = JSON.parse(hVal);
    } catch(e) { 
      vscode.postMessage({type: 'error', message: 'Invalid Headers JSON: ' + e.message}); 
      return; 
    }

    try {
      const bVal = document.getElementById('body').value.trim();
      if(bVal) body = JSON.parse(bVal);
    } catch(e) { 
      vscode.postMessage({type: 'error', message: 'Invalid Body JSON: ' + e.message}); 
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

  function save() {
    vscode.postMessage({
      type: 'save',
      data: {
        id: currentRequestId || Date.now().toString(),
        label: 'Untitled Request', 
        method: document.getElementById('method').value,
        url: document.getElementById('url').value,
        headers: document.getElementById('headers').value,
        body: document.getElementById('body').value
      }
    });
  }

  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      send();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      save();
    }
  });
</script>
</body>
</html>`;
  }
}
