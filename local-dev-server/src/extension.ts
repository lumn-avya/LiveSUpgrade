import * as vscode from "vscode";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { LoggingDebugSession, InitializedEvent } from "@vscode/debugadapter";
import { createProxyMiddleware } from "http-proxy-middleware";

let httpServer: http.Server | null = null;
let wss: WebSocketServer | null = null;
export let clients: Set<WebSocket> = new Set();
export let fileWatcher: vscode.FileSystemWatcher | null = null;
let statusBarItem: vscode.StatusBarItem | null = null;
let sessionToken: string = "";

const MIME_TYPES: { [key: string]: string } = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

const apiProxy: any = createProxyMiddleware({
  target: "http://127.0.0.1:3000",
  changeOrigin: true,
});

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.command = "local-dev-server.stop";
  context.subscriptions.push(statusBarItem);

  let startCommand = vscode.commands.registerCommand(
    "local-dev-server.start",
    () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage("Please open a folder first!");
        return;
      }
      const rootPath = workspaceFolders[0].uri.fsPath;
      sessionToken = crypto.randomBytes(16).toString("hex");
      startServerWithPortHandling(rootPath, 5500);
    },
  );

  let stopCommand = vscode.commands.registerCommand(
    "local-dev-server.stop",
    () => {
      deactivateServerInstances();
      vscode.window.showInformationMessage("Local Dev Server stopped.");
    },
  );

  context.subscriptions.push(startCommand, stopCommand);
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider(
      "local-dev-debugger",
      new LocalDevDebugConfigurationProvider(),
    ),
  );
  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory(
      "local-dev-debugger",
      new LocalDevDebugAdapterFactory(),
    ),
  );
}

class LocalDevDebugConfigurationProvider
  implements vscode.DebugConfigurationProvider
{
  resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    if (!config.type && !config.request && !config.name) {
      config.type = "local-dev-debugger";
      config.name = "Live Server Debug Session";
      config.request = "launch";
    }
    return config;
  }
}

class LocalDevDebugAdapterFactory
  implements vscode.DebugAdapterDescriptorFactory
{
  createDebugAdapterDescriptor(
    _session: vscode.DebugSession,
  ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    return new vscode.DebugAdapterInlineImplementation(
      new LocalDevDebugSession(),
    );
  }
}

class LocalDevDebugSession extends LoggingDebugSession {
  protected initializeRequest(response: any, args: any): void {
    response.body = response.body || {};
    response.body.supportsConfigurationDoneRequest = true;
    this.sendResponse(response);
    this.sendEvent(new InitializedEvent());
  }
  protected launchRequest(response: any, args: any): void {
    vscode.commands.executeCommand("local-dev-server.start");
    this.sendResponse(response);
  }
}

function startServerWithPortHandling(rootPath: string, port: number) {
  const WS_PORT = port + 1;

  httpServer = http.createServer((req, res) => {
    let decodedUrl = decodeURIComponent(req.url || "");

    // 1. HIGH PRIORITY: Intercept proxy routes first
    if (decodedUrl.startsWith("/api/")) {
      console.log("[Proxy] Forwarding API request: " + decodedUrl);
      return apiProxy(req as any, res as any, () => {});
    }

    // 2. LOW PRIORITY: Only look for files if it wasn't an API call
    let safeUrl = decodedUrl === "/" ? "index.html" : decodedUrl;

    // ... (keep the rest of your file reading logic here)

    if (safeUrl.includes("..")) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("403 Forbidden");
      return;
    }

    let filePath = path.join(rootPath, safeUrl);

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("404 File Not Found");
        return;
      }

      let ext = path.extname(filePath).toLowerCase();
      let contentType = MIME_TYPES[ext] || "application/octet-stream";
      let responseHeaders: Record<string, string> = {
        "Content-Type": contentType,
      };

      if (
        contentType.startsWith("text/") ||
        contentType === "application/javascript"
      ) {
        responseHeaders["Content-Type"] = contentType + "; charset=utf-8";
      }

      if (ext === ".html") {
        let htmlString = content.toString("utf-8");
        const injectedScript =
          `
                    <script>
                        const ws = new WebSocket('ws://127.0.0.1:` +
          WS_PORT +
          `?token=` +
          sessionToken +
          `');
                        
                        const savedScroll = sessionStorage.getItem('live_server_scroll');
                        if (savedScroll) {
                            try {
                                const { x, y } = JSON.parse(savedScroll);
                                window.scrollTo(x, y);
                            } catch (e) {}
                            sessionStorage.removeItem('live_server_scroll');
                        }

                        ws.onmessage = (msg) => {
                            const data = JSON.parse(msg.data);
                            if (data.type === 'css-update') {
                                const links = document.querySelectorAll('link[rel="stylesheet"]');
                                for (let link of links) {
                                    const url = new URL(link.href, window.location.href);
                                    url.searchParams.set('hmr_bust', Date.now().toString());
                                    link.href = url.href;
                                }
                            } else if (data.type === 'reload') {
                                sessionStorage.setItem('live_server_scroll', JSON.stringify({ x: window.scrollX, y: window.scrollY }));
                                window.location.reload();
                            }
                        };
                        console.log('Secure Smart Live Server Active (Phase 5 Proxy Ready).');
                    </script>
                `;
        htmlString = htmlString.replace("</body>", injectedScript + "</body>");
        res.writeHead(200, responseHeaders);
        res.end(htmlString);
      } else {
        res.writeHead(200, responseHeaders);
        res.end(content);
      }
    });
  });

  httpServer.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      startServerWithPortHandling(rootPath, port + 2);
    }
  });

  httpServer.listen(port, "127.0.0.1", () => {
    updateStatusBar(port);
    vscode.window.showInformationMessage(
      "Live Server active at http://127.0.0.1:" + port,
    );
    startSecureWebSocketServer(WS_PORT);
    startFileWatcher(rootPath);
  });
}

function startSecureWebSocketServer(port: number) {
  wss = new WebSocketServer({
    port: port,
    host: "127.0.0.1",
    verifyClient: (info: any, callback: any) => {
      const reqUrl = info.req.url
        ? new URL(info.req.url, "http://127.0.0.1")
        : null;
      const tokenReceived = reqUrl ? reqUrl.searchParams.get("token") : "";
      callback(tokenReceived === sessionToken);
    },
  });

  wss.on("connection", (ws: WebSocket) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });
}

function updateStatusBar(port: number) {
  if (statusBarItem) {
    statusBarItem.text = "$(bug) Debug Port: " + port;
    statusBarItem.tooltip = "Click to shut down live debug server";
    statusBarItem.show();
  }
}

function deactivateServerInstances() {
  if (httpServer) httpServer.close();
  if (wss) wss.close();
  if (fileWatcher) fileWatcher.dispose();
  if (statusBarItem) statusBarItem.hide();
  httpServer = null;
  wss = null;
  fileWatcher = null;
}

export function deactivate() {
  deactivateServerInstances();
}
