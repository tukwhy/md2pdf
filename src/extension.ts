import * as vscode from 'vscode';
import { Exporter } from './exporter';
import { PreviewPanel } from './previewPanel';

export function activate(context: vscode.ExtensionContext) {
    // 注入插件安装路径，方便查找内置模板
    Exporter.extensionPath = context.extensionPath;

    // 注册导出 PDF 命令
    const exportCmd = vscode.commands.registerCommand('md2pdf.export', async (uri?: vscode.Uri) => {
        await Exporter.exportPdf(uri);
    });

    // 注册分屏预览命令
    const previewCmd = vscode.commands.registerCommand('md2pdf.openPreview', async (uri?: vscode.Uri) => {
        let targetUri = uri;
        if (!targetUri) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'markdown') {
                targetUri = editor.document.uri;
            }
        }
        if (targetUri) {
            PreviewPanel.createOrShow(context.extensionUri, targetUri);
        } else {
            vscode.window.showWarningMessage('请先打开一个 Markdown (.md) 文件以开启分屏预览。');
        }
    });

    // 注册打开设置命令
    const settingsCmd = vscode.commands.registerCommand('md2pdf.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'md2pdf');
    });

    // 状态栏快速导出按钮
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'md2pdf.export';
    statusBarItem.text = '$(file-pdf) MD2PDF 导出';
    statusBarItem.tooltip = '一键渲染当前 Markdown 为出版级 PDF';

    function updateStatusBar() {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'markdown') {
            statusBarItem.show();
        } else {
            statusBarItem.hide();
        }
    }

    vscode.window.onDidChangeActiveTextEditor(updateStatusBar, null, context.subscriptions);
    updateStatusBar();

    context.subscriptions.push(exportCmd, previewCmd, settingsCmd, statusBarItem);
}

export function deactivate() {
    // 清理资源
}