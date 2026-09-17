import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
const MarkdownIt = require('markdown-it');
const markdownItKatex = require('@iktakahiro/markdown-it-katex');
import hljs from 'highlight.js';
import { Exporter } from './exporter';

export class PreviewPanel {
    public static currentPanel: PreviewPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _documentUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

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
                retainContextWhenHidden: true,
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

        // 监听 Webview 消息交互
        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'render':
                    this.update();
                    break;
                case 'exportPdf':
                    await Exporter.exportPdf(this._documentUri, true);
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'md2pdf');
                    break;
            }
        }, null, this._disposables);

        // 监听文档编辑实时刷新
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.uri.fsPath === this._documentUri.fsPath) {
                this.update();
            }
        }, null, this._disposables);

        // 监听活动文档切换
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
            rawContent = '# 读取文件失败\n请确认文件存在。';
        }

        const safeTitle = path.basename(this._documentUri.fsPath);

        // 初始化 Markdown 渲染器（采用微软官方 VS Code 同款底层 markdown-it-katex）
        const md: any = new MarkdownIt({
            html: true,
            linkify: true,
            typographer: true,
            breaks: true,
            highlight: (str: string, lang: string): string => {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
                    } catch (__) {}
                }
                try {
                    return `<pre class="hljs"><code>${hljs.highlightAuto(str).value}</code></pre>`;
                } catch (__) {}
                return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
            }
        });

        // 加载微软官方同款 KaTeX 数学插件
        md.use(markdownItKatex, {
            throwOnError: false,
            errorColor: '#cc0000'
        });

        // 拦截并重写图片相对路径为安全 Webview URI
        const defaultImageRenderer = md.renderer.rules.image || function (tokens: any[], idx: number, options: any, env: any, self: any): string {
            return self.renderToken(tokens, idx, options);
        };
        md.renderer.rules.image = (tokens: any[], idx: number, options: any, env: any, self: any): string => {
            const token = tokens[idx];
            const srcIdx = token.attrIndex('src');
            if (srcIdx >= 0) {
                const src = token.attrs[srcIdx][1];
                if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
                    try {
                        const absPath = path.isAbsolute(src) ? src : path.resolve(docDir, src);
                        if (fs.existsSync(absPath)) {
                            token.attrs[srcIdx][1] = this._panel.webview.asWebviewUri(vscode.Uri.file(absPath)).toString();
                        }
                    } catch (e) {}
                }
            }
            return defaultImageRenderer(tokens, idx, options, env, self);
        };

        // 在 Node.js 宿主直接编译 Markdown 为 HTML
        const renderedBodyHtml = md.render(rawContent);

        // 本地静态 CSS 路径转换（确保相对路径的 fonts/* 字体能被 Webview 安全加载）
        const katexCssUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'katex', 'katex.min.css')
        );
        const hljsCssUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'highlight', 'atom-one-dark.min.css')
        );

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MD2PDF 预览</title>
    <!-- 本地 KaTeX 官方完整样式与字体关联 -->
    <link rel="stylesheet" href="${katexCssUri}">
    <!-- 本地代码高亮样式 -->
    <link rel="stylesheet" href="${hljsCssUri}">
    <style>
        :root {
            --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
            --code-font: Consolas, "Cascadia Code", "Fira Code", Menlo, Monaco, "Courier New", monospace;
        }
        body {
            font-family: var(--font-family);
            padding: 0;
            margin: 0;
            background-color: var(--vscode-editor-background, #1e1e1e);
            color: var(--vscode-editor-foreground, #d4d4d4);
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
            font-size: 13px;
            user-select: none;
            flex-shrink: 0;
        }
        .btn-group {
            display: flex;
            gap: 10px;
        }
        button {
            background-color: var(--vscode-button-secondaryBackground, #3a3d41);
            color: var(--vscode-button-secondaryForeground, #fff);
            border: 1px solid var(--vscode-button-border, transparent);
            padding: 5px 14px;
            font-size: 12px;
            cursor: pointer;
            border-radius: 3px;
            display: inline-flex;
            align-items: center;
            font-weight: 500;
            transition: all 0.15s ease;
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
        .status-msg {
            color: var(--vscode-descriptionForeground, #aaa);
            font-size: 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 320px;
        }
        .content-container {
            flex: 1;
            overflow-y: auto;
            padding: 24px 36px;
            box-sizing: border-box;
            line-height: 1.72;
        }
        h1, h2, h3, h4, h5, h6 {
            color: var(--vscode-editor-foreground, #f0f0f0);
            margin-top: 1.3em;
            margin-bottom: 0.6em;
            font-weight: 600;
        }
        h1 { font-size: 1.8em; border-bottom: 1px solid var(--vscode-panel-border, #444); padding-bottom: 0.3em; }
        h2 { font-size: 1.4em; border-bottom: 1px solid var(--vscode-panel-border, #333); padding-bottom: 0.2em; }
        
        p code, li code, td code {
            font-family: var(--code-font);
            background-color: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.18));
            color: #e06c75;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.9em;
        }
        pre.hljs {
            background-color: #282c34 !important;
            border-radius: 6px;
            padding: 14px 18px;
            overflow-x: auto;
            border: 1px solid var(--vscode-panel-border, #3e4451);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            margin: 1.2em 0;
        }
        pre.hljs code {
            background: transparent !important;
            padding: 0 !important;
            font-family: var(--code-font);
            font-size: 13.5px;
            line-height: 1.55;
            white-space: pre;
            word-break: normal;
        }
        .katex-display {
            margin: 1.6em 0 !important;
            overflow-x: auto;
            overflow-y: hidden;
            padding: 10px 0;
        }
        .katex {
            font-size: 1.18em;
        }
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 18px auto;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            border: 1px solid var(--vscode-panel-border, #333);
        }
        blockquote {
            border-left: 4px solid var(--vscode-button-background, #007acc);
            margin: 1em 0;
            padding: 0.5em 1em;
            color: var(--vscode-descriptionForeground, #888);
            background-color: rgba(127,127,127,0.08);
            border-radius: 0 4px 4px 0;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 18px 0;
        }
        th, td {
            border: 1px solid var(--vscode-panel-border, #444);
            padding: 8px 12px;
            text-align: left;
        }
        th {
            background-color: rgba(127,127,127,0.15);
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <div class="btn-group">
            <button class="primary" id="btnRender">实时渲染</button>
            <button id="btnExport">导出PDF</button>
            <button id="btnSettings">设置</button>
        </div>
        <span class="status-msg">${safeTitle}</span>
    </div>

    <div class="content-container">
        ${renderedBodyHtml}
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        document.getElementById('btnRender').addEventListener('click', () => {
            vscode.postMessage({ command: 'render' });
        });

        document.getElementById('btnExport').addEventListener('click', () => {
            vscode.postMessage({ command: 'exportPdf' });
        });

        document.getElementById('btnSettings').addEventListener('click', () => {
            vscode.postMessage({ command: 'openSettings' });
        });
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