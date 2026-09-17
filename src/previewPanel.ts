import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Exporter } from './exporter';

export class PreviewPanel {
    public static currentPanel: PreviewPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _documentUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _currentMode: 'interactive' | 'pdf' = 'interactive';
    private _lastPdfPath: string | null = null;

    public static createOrShow(extensionUri: vscode.Uri, docUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.ViewColumn.Beside
            : vscode.ViewColumn.One;

        if (PreviewPanel.currentPanel) {
            PreviewPanel.currentPanel._documentUri = docUri;
            PreviewPanel.currentPanel._panel.reveal(column);
            PreviewPanel.currentPanel.update();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'md2pdfPreview',
            `MD2PDF 预览: ${path.basename(docUri.fsPath)}`,
            column,
            {
                enableScripts: true,
                localResourceRoots: [
                    extensionUri,
                    vscode.Uri.file(path.dirname(docUri.fsPath)),
                    ...(vscode.workspace.workspaceFolders?.map(f => f.uri) || [])
                ]
            }
        );

        PreviewPanel.currentPanel = new PreviewPanel(panel, extensionUri, docUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, docUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._documentUri = docUri;

        this.update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // 监听 Webview 发来的交互消息
        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'exportPdf':
                    await Exporter.exportPdf(this._documentUri, true);
                    break;
                case 'compileAndShowPdf':
                    this._panel.webview.postMessage({ type: 'status', text: '正在编译 PDF...' });
                    const pdfPath = await Exporter.exportPdf(this._documentUri, false);
                    if (pdfPath && fs.existsSync(pdfPath)) {
                        this._lastPdfPath = pdfPath;
                        this._currentMode = 'pdf';
                        this.update();
                    }
                    break;
                case 'switchMode':
                    this._currentMode = message.mode;
                    this.update();
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'md2pdf');
                    break;
            }
        }, null, this._disposables);

        // 监听文档修改实时刷新即时预览
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.uri.fsPath === this._documentUri.fsPath && this._currentMode === 'interactive') {
                this.update();
            }
        }, null, this._disposables);

        // 监听活动编辑器变更
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && editor.document.languageId === 'markdown') {
                this._documentUri = editor.document.uri;
                this._panel.title = `MD2PDF 预览: ${path.basename(this._documentUri.fsPath)}`;
                this.update();
            }
        }, null, this._disposables);
    }

    public update() {
        this._panel.webview.html = this.getHtmlForWebview();
    }

    private getHtmlForWebview(): string {
        const docDir = path.dirname(this._documentUri.fsPath);
        let rawContent = '';
        try {
            const openDoc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === this._documentUri.fsPath);
            rawContent = openDoc ? openDoc.getText() : fs.readFileSync(this._documentUri.fsPath, 'utf-8');
        } catch (e) {
            rawContent = '# 读取文件出错\n请确保文件存在。';
        }

        const safeTitle = path.basename(this._documentUri.fsPath);

        // 图片路径处理：将相对路径图片转为 webview 协议地址
        const processedMd = rawContent.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, imgPath) => {
            let cleanPath = imgPath.trim();
            if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://') || cleanPath.startsWith('data:')) {
                return match;
            }
            try {
                const absPath = path.isAbsolute(cleanPath) ? cleanPath : path.resolve(docDir, cleanPath);
                if (fs.existsSync(absPath)) {
                    const webviewUri = this._panel.webview.asWebviewUri(vscode.Uri.file(absPath));
                    return `![${alt}](${webviewUri.toString()})`;
                }
            } catch (e) {
                // 忽略转换失败
            }
            return match;
        });

        // 准备 pdf 视图数据
        let pdfWebviewUriStr = '';
        if (this._lastPdfPath && fs.existsSync(this._lastPdfPath)) {
            pdfWebviewUriStr = this._panel.webview.asWebviewUri(vscode.Uri.file(this._lastPdfPath)).toString();
        } else {
            const autoPdf = path.join(docDir, `${path.parse(this._documentUri.fsPath).name}.pdf`);
            if (fs.existsSync(autoPdf)) {
                this._lastPdfPath = autoPdf;
                pdfWebviewUriStr = this._panel.webview.asWebviewUri(vscode.Uri.file(autoPdf)).toString();
            }
        }

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MD2PDF 预览</title>
    <!-- KaTeX 支持 LaTeX 公式渲染 -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>
    <!-- Marked 支持 Markdown 快速解析 -->
    <script src="https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js"></script>
    <style>
        :root {
            --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        }
        body {
            font-family: var(--font-family);
            padding: 0;
            margin: 0;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
        }
        .toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 16px;
            background-color: var(--vscode-editorGroupHeader-tabsBackground, #252526);
            border-bottom: 1px solid var(--vscode-panel-border, #333);
            font-size: 12px;
            user-select: none;
        }
        .btn-group {
            display: flex;
            gap: 8px;
        }
        button {
            background-color: var(--vscode-button-secondaryBackground, #3a3d41);
            color: var(--vscode-button-secondaryForeground, #fff);
            border: 1px solid var(--vscode-button-border, transparent);
            padding: 4px 10px;
            font-size: 12px;
            cursor: pointer;
            border-radius: 3px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground, #45494e);
        }
        button.primary {
            background-color: var(--vscode-button-background, #007acc);
            color: var(--vscode-button-foreground, #fff);
        }
        button.primary:hover {
            background-color: var(--vscode-button-hoverBackground, #0062a3);
        }
        button.active {
            outline: 2px solid var(--vscode-focusBorder, #007fd4);
            font-weight: bold;
        }
        .status-msg {
            color: var(--vscode-descriptionForeground, #aaa);
            font-style: italic;
        }
        .content-container {
            flex: 1;
            overflow-y: auto;
            padding: 24px 36px;
            box-sizing: border-box;
            line-height: 1.68;
        }
        .pdf-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        iframe {
            width: 100%;
            height: 100%;
            border: none;
        }
        /* Markdown 美化排版 */
        h1, h2, h3, h4, h5, h6 {
            color: var(--vscode-editor-foreground);
            margin-top: 1.2em;
            margin-bottom: 0.6em;
            font-weight: 600;
        }
        h1 { font-size: 1.8em; border-bottom: 1px solid var(--vscode-panel-border, #444); padding-bottom: 0.3em; }
        h2 { font-size: 1.4em; border-bottom: 1px solid var(--vscode-panel-border, #333); padding-bottom: 0.2em; }
        code {
            font-family: Consolas, "Courier New", monospace;
            background-color: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.15));
            padding: 2px 5px;
            border-radius: 3px;
            font-size: 0.9em;
        }
        pre {
            background-color: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.12));
            padding: 12px 16px;
            border-radius: 6px;
            overflow-x: auto;
            border: 1px solid var(--vscode-panel-border, #333);
        }
        pre code {
            padding: 0;
            background: none;
            white-space: pre-wrap;
            word-break: break-all;
        }
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 16px auto;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        blockquote {
            border-left: 4px solid var(--vscode-button-background, #007acc);
            margin: 1em 0;
            padding: 0.5em 1em;
            color: var(--vscode-descriptionForeground, #888);
            background-color: rgba(127,127,127,0.08);
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 16px 0;
        }
        th, td {
            border: 1px solid var(--vscode-panel-border, #444);
            padding: 8px 12px;
            text-align: left;
        }
        th {
            background-color: rgba(127,127,127,0.15);
        }
        .empty-pdf-tip {
            margin: 40px auto;
            text-align: center;
            color: var(--vscode-descriptionForeground, #888);
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <div class="btn-group">
            <button id="btnInteractive" class="${this._currentMode === 'interactive' ? 'active' : ''}" onclick="switchMode('interactive')">⚡ 即时渲染预览</button>
            <button id="btnPdf" class="${this._currentMode === 'pdf' ? 'active' : ''}" onclick="switchMode('pdf')">📄 真机 PDF 视图</button>
        </div>
        <span id="statusSpan" class="status-msg">${safeTitle}</span>
        <div class="btn-group">
            <button onclick="compilePdf()">🔄 编译真机 PDF</button>
            <button class="primary" onclick="exportPdf()">💾 导出 PDF</button>
            <button onclick="openSettings()">⚙️ 设置</button>
        </div>
    </div>

    ${this._currentMode === 'interactive' ? `
        <div class="content-container" id="markdownContainer"></div>
    ` : `
        <div class="pdf-container">
            ${pdfWebviewUriStr ? `
                <iframe src="${pdfWebviewUriStr}#toolbar=0&navpanes=0"></iframe>
            ` : `
                <div class="empty-pdf-tip">
                    <p>尚未生成当前文档的 PDF 编译文件。</p>
                    <button class="primary" onclick="compilePdf()">立即调用 Pandoc + XeLaTeX 编译</button>
                </div>
            `}
        </div>
    `}

    <script>
        const vscode = acquireVsCodeApi();
        const rawMarkdown = ${JSON.stringify(processedMd)};

        function switchMode(mode) {
            vscode.postMessage({ command: 'switchMode', mode: mode });
        }

        function exportPdf() {
            vscode.postMessage({ command: 'exportPdf' });
        }

        function compilePdf() {
            const span = document.getElementById('statusSpan');
            if (span) span.innerText = '正在调用 Pandoc 编译真实 PDF...';
            vscode.postMessage({ command: 'compileAndShowPdf' });
        }

        function openSettings() {
            vscode.postMessage({ command: 'openSettings' });
        }

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'status') {
                const span = document.getElementById('statusSpan');
                if (span) span.innerText = message.text;
            }
        });

        // 渲染 Markdown
        const container = document.getElementById('markdownContainer');
        if (container && typeof marked !== 'undefined') {
            container.innerHTML = marked.parse(rawMarkdown);

            // 渲染 LaTeX 公式 (KaTeX)
            if (typeof renderMathInElement !== 'undefined') {
                renderMathInElement(container, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\(', right: '\\)', display: false},
                        {left: '\\[', right: '\\]', display: true}
                    ],
                    throwOnError: false
                });
            }
        }
    </script>
</body>
</html>`;
    }

    public dispose() {
        PreviewPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}