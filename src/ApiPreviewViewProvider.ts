import * as vscode from 'vscode';

type SavedRequest = {
  method: string;
  url: string;
  headers?: any;
  body?: any;
  savedAt: string;
};

export class ApiPreviewViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'apiPreview.sidebar';
  private _view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  focus() {
    this._view?.show?.(true);
  }

  resolveWebviewView(view: vscode.WebviewView) {
    this._view = view;

    view.webview.options = { enableScripts: true };

    view.webview.onDidReceiveMessage(async (message) => {

      /* ---------- FETCH API ---------- */
      if (message.type === 'fetch') {
        try {
          const res = await fetch(message.url, {
            method: message.method,
            headers: message.headers,
            body: message.body ? JSON.stringify(message.body) : undefined
          });

          const text = await res.text();
          let data: any;
          try { data = JSON.parse(text); } catch { data = text; }

          this.saveRequest(message);

          view.webview.postMessage({
            type: 'response',
            status: res.status,
            data
          });
        } catch (err: any) {
          view.webview.postMessage({
            type: 'error',
            message: err.message
          });
        }
      }

      /* ---------- LOAD SAVED ---------- */
      if (message.type === 'loadSaved') {
        view.webview.postMessage({
          type: 'savedRequests',
          data: this.getSavedRequests()
        });
      }

      /* ---------- LOAD ONE ---------- */
      if (message.type === 'loadRequest') {
        view.webview.postMessage({
          type: 'loadRequest',
          data: message.data
        });
      }
    });

    view.webview.html = this.getHtml();

    // Load saved requests on open
    setTimeout(() => {
      view.webview.postMessage({
        type: 'savedRequests',
        data: this.getSavedRequests()
      });
    }, 300);
  }

  /* ---------- STORAGE ---------- */

  private getSavedRequests(): SavedRequest[] {
    return this.context.workspaceState.get<SavedRequest[]>('apiRequests', []);
  }

  private saveRequest(req: any) {
    const existing = this.getSavedRequests();

    // Prevent exact duplicates
    if (existing.some(e => e.method === req.method && e.url === req.url)) {
      return;
    }

    const updated: SavedRequest[] = [
      {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        savedAt: new Date().toISOString()
      },
      ...existing
    ].slice(0, 20);

    this.context.workspaceState.update('apiRequests', updated);
  }

  /* ---------- HTML ---------- */

  private getHtml(): string {
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  body { background:#1e1e1e; color:#e0e0e0; margin:0; font-family:sans-serif; }
  .top-bar { display:flex; gap:8px; padding:8px; border-bottom:1px solid #444; }
  select,input,textarea,button { background:#3c3c3c; color:#fff; border:1px solid #444; padding:6px; }
  button { cursor:pointer; background:#0078d4; border:none; }
  .tabs { display:flex; border-bottom:1px solid #444; }
  .tab { padding:8px 16px; cursor:pointer; }
  .tab.active { border-bottom:2px solid #0078d4; }
  .editor { display:none; }
  .editor.active { display:block; }
  .response { padding:10px; overflow:auto; height:40vh; }
  #saved-list li { cursor:pointer; padding:4px; }
  #saved-list li:hover { background:#333; }
</style>
</head>
<body>

<div class="top-bar">
  <select id="method">
    <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
  </select>
  <input id="url" placeholder="Request URL" style="flex:1" />
  <button onclick="send()">Send</button>
</div>

<div style="padding:6px;border-bottom:1px solid #444">
  <strong>Saved Requests</strong>
  <ul id="saved-list"></ul>
</div>

<div class="tabs">
  <div class="tab active" onclick="switchTab('body', this)">Body</div>
  <div class="tab" onclick="switchTab('headers', this)">Headers</div>
</div>

<textarea id="body" class="editor active" placeholder="JSON body"></textarea>
<textarea id="headers" class="editor" placeholder="JSON headers"></textarea>

<div class="response">
  <pre id="output">Send a request…</pre>
</div>

<script>
const vscode = acquireVsCodeApi();

function switchTab(name, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.editor').forEach(e => e.classList.remove('active'));
  document.getElementById(name).classList.add('active');
}

function send() {
  let headers={}, body=null;
  try { headers = JSON.parse(headers.value || '{}'); } catch { alert('Invalid headers'); return; }
  try { body = JSON.parse(body.value || 'null'); } catch { alert('Invalid body'); return; }

  vscode.postMessage({
    type:'fetch',
    method:method.value,
    url:url.value,
    headers, body
  });
}

window.addEventListener('message', e => {
  const msg = e.data;

  if (msg.type === 'response') {
    renderTree(msg.data, output);
  }

  if (msg.type === 'savedRequests') {
    savedList.innerHTML='';
    msg.data.forEach(r => {
      const li=document.createElement('li');
      li.textContent = r.method+' '+r.url;
      li.onclick=()=>vscode.postMessage({type:'loadRequest',data:r});
      savedList.appendChild(li);
    });
  }

  if (msg.type === 'loadRequest') {
    method.value = msg.data.method;
    url.value = msg.data.url;
    headers.value = JSON.stringify(msg.data.headers||{},null,2);
    body.value = JSON.stringify(msg.data.body||{},null,2);
  }
});

/* ---------- JSON TREE ---------- */
function renderTree(data, container){
  container.innerHTML='';
  container.appendChild(node(data));
}
function node(v){
  if(v===null||typeof v!=='object'){const s=document.createElement('span');s.textContent=JSON.stringify(v);return s;}
  const w=document.createElement('div');
  const t=document.createElement('span');
  const c=document.createElement('div');
  c.style.display='none';
  t.textContent=Array.isArray(v)?'[+]':'{+}';
  t.onclick=()=>{const o=c.style.display==='none';c.style.display=o?'block':'none';t.textContent=o?(Array.isArray(v)?'[-]':'{-}'):(Array.isArray(v)?'[+]':'{+}')};
  Object.entries(v).forEach(([k,val])=>{const r=document.createElement('div');r.innerHTML='<b>'+k+':</b> ';r.appendChild(node(val));c.appendChild(r);});
  w.appendChild(t);w.appendChild(c);return w;
}

vscode.postMessage({type:'loadSaved'});
</script>
</body>
</html>`;
  }
}