import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

const DEFAULT_HEADER = `% ==========================================
% Pandoc PDF 增强排版模板 (LaTeX Header)
% ==========================================

% 1. 代码块长行自动折行支持
\\usepackage{fvextra}
\\DefineVerbatimEnvironment{Highlighting}{Verbatim}{breaklines,breakanywhere=true,commandchars=\\\\\\{\\}}

% 2. 图片浮动控制（尽量就地显示，不乱跑）
\\usepackage{float}
\\makeatletter
\\def\\fps@figure{H}
\\makeatother

% 3. 段落间距与首行微调
\\setlength{\\parskip}{0.45em}

% 4. 表格美化增强
\\usepackage{booktabs}
\\usepackage{array}

% 5. 数学宏包增强
\\usepackage{amsmath}
\\usepackage{amssymb}
`;

export class Exporter {
    private static outputChannel: vscode.OutputChannel | undefined;
    public static extensionPath: string = '';

    public static getOutputChannel(): vscode.OutputChannel {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('MD2PDF');
        }
        return this.outputChannel;
    }

    public static async exportPdf(targetUri?: vscode.Uri, openAfterOverride?: boolean): Promise<string | null> {
        let uri = targetUri;
        if (!uri) {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
                vscode.window.showWarningMessage('请先打开一个 Markdown (.md) 文件再执行导出。');
                return null;
            }
            uri = activeEditor.document.uri;
        }

        const inputPath = uri.fsPath;
        if (!fs.existsSync(inputPath)) {
            vscode.window.showErrorMessage(`文件不存在: ${inputPath}`);
            return null;
        }

        // 确保文件已保存
        const openDoc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === inputPath);
        if (openDoc && openDoc.isDirty) {
            await openDoc.save();
        }

        const parsedPath = path.parse(inputPath);
        const outputPath = path.join(parsedPath.dir, `${parsedPath.name}.pdf`);

        const config = vscode.workspace.getConfiguration('md2pdf');
        const cjkFont = config.get<string>('cjkFont', 'Microsoft YaHei');
        const monoFont = config.get<string>('monoFont', 'Consolas');
        const margin = config.get<string>('margin', '2.2cm');
        const highlightStyle = config.get<string>('highlightStyle', 'tango');
        const toc = config.get<boolean>('toc', false);
        const customHeader = config.get<string>('customHeader', '');
        const pandocPath = config.get<string>('pandocPath', 'pandoc');
        const pdfEngine = config.get<string>('pdfEngine', 'xelatex');
        const openAfterExport = openAfterOverride !== undefined ? openAfterOverride : config.get<boolean>('openAfterExport', true);

        // 确定 header.tex 路径
        const headerPath = this.resolveHeaderPath(parsedPath.dir, customHeader);

        const channel = this.getOutputChannel();
        channel.appendLine(`\n[${new Date().toLocaleTimeString()}] 开始导出 PDF: ${parsedPath.base} -> ${parsedPath.name}.pdf`);

        // 构建参数列表（注意：每个命令行选项与值必须是独立的元素，不能用 shell 拼串，防止空格切分问题）
        const args: string[] = [
            inputPath,
            '-o', outputPath,
            `--pdf-engine=${pdfEngine}`,
            '--resource-path', `${parsedPath.dir}${path.delimiter}.`,
            '-V', 'documentclass=ctexart',
            '-V', `geometry:margin=${margin}`,
            '-V', `CJKmainfont=${cjkFont}`,
            '-V', `monofont=${monoFont}`,
            '-V', 'colorlinks=true',
            '-V', 'linkcolor=blue',
            '-V', 'urlcolor=blue',
            `--syntax-highlighting=${highlightStyle}`
        ];

        if (headerPath && fs.existsSync(headerPath)) {
            args.push('-H', headerPath);
        }

        if (toc) {
            args.push('--toc');
        }

        channel.appendLine(`执行程序: ${pandocPath}`);
        channel.appendLine(`参数列表:\n  ${args.join('\n  ')}`);

        // 在 Windows 上，无 shell 运行时若没有 .exe 后缀则补齐
        let execCmd = pandocPath;
        if (process.platform === 'win32' && !path.extname(execCmd)) {
            execCmd = `${execCmd}.exe`;
        }

        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `MD2PDF: 正在渲染 ${parsedPath.name}.pdf ...`,
            cancellable: false
        }, async () => {
            return new Promise<string | null>((resolve) => {
                // 使用 shell: false，杜绝 Windows cmd.exe 拆分空格参数（例如 Microsoft YaHei）
                const proc = spawn(execCmd, args, {
                    cwd: parsedPath.dir,
                    shell: false
                });

                let stdoutData = '';
                let stderrData = '';

                proc.stdout?.on('data', (data: Buffer | string) => {
                    const text = data.toString();
                    stdoutData += text;
                    channel.append(text);
                });

                proc.stderr?.on('data', (data: Buffer | string) => {
                    const text = data.toString();
                    stderrData += text;
                    channel.append(text);
                });

                proc.on('error', (err: Error) => {
                    channel.appendLine(`[进程错误]: ${err.message}`);
                    vscode.window.showErrorMessage(`无法启动 Pandoc (${execCmd}): ${err.message}。请确保已安装 Pandoc 并配置好环境变量。`, '查看日志')
                        .then(choice => {
                            if (choice === '查看日志') {
                                channel.show();
                            }
                        });
                    resolve(null);
                });

                proc.on('close', async (code: number | null) => {
                    if (code === 0 && fs.existsSync(outputPath)) {
                        channel.appendLine(`[SUCCESS] 成功生成: ${outputPath}`);
                        vscode.window.showInformationMessage(`PDF 导出成功: ${path.basename(outputPath)}`, '打开 PDF', '在文件夹中显示')
                            .then(async (selection) => {
                                if (selection === '打开 PDF') {
                                    vscode.env.openExternal(vscode.Uri.file(outputPath));
                                } else if (selection === '在文件夹中显示') {
                                    vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outputPath));
                                }
                            });

                        if (openAfterExport) {
                            try {
                                vscode.env.openExternal(vscode.Uri.file(outputPath));
                            } catch (e) {
                                // 忽略
                            }
                        }
                        resolve(outputPath);
                    } else {
                        channel.appendLine(`[FAILED] 进程退出码: ${code}`);
                        channel.show();
                        vscode.window.showErrorMessage(
                            `PDF 渲染失败 (退出码 ${code})。可能是 LaTeX 语法、缺少宏包或字体问题，请查看输出窗口排查。`,
                            '查看日志'
                        ).then(choice => {
                            if (choice === '查看日志') {
                                channel.show();
                            }
                        });
                        resolve(null);
                    }
                });
            });
        });
    }

    private static resolveHeaderPath(docDir: string, customHeader?: string): string | null {
        // 1. 用户显式设置
        if (customHeader && customHeader.trim()) {
            const resolved = path.isAbsolute(customHeader) ? customHeader : path.join(docDir, customHeader);
            if (fs.existsSync(resolved)) {
                return resolved;
            }
        }

        // 2. 当前工作区根目录
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            for (const folder of workspaceFolders) {
                const wsTpl = path.join(folder.uri.fsPath, 'template', 'header.tex');
                if (fs.existsSync(wsTpl)) {
                    return wsTpl;
                }
                const wsHdr = path.join(folder.uri.fsPath, 'header.tex');
                if (fs.existsSync(wsHdr)) {
                    return wsHdr;
                }
            }
        }

        // 3. 插件自身安装目录（永远存在官方最新默认模板）
        if (this.extensionPath) {
            const extTpl = path.join(this.extensionPath, 'template', 'header.tex');
            if (fs.existsSync(extTpl)) {
                return extTpl;
            }
        }

        // 4. 当前文档所在目录
        const docTpl = path.join(docDir, 'template', 'header.tex');
        if (fs.existsSync(docTpl)) {
            return docTpl;
        }

        // 5. 兜底自动生成
        const fallbackTarget = path.join(docDir, 'template', 'header.tex');
        try {
            fs.mkdirSync(path.dirname(fallbackTarget), { recursive: true });
            fs.writeFileSync(fallbackTarget, DEFAULT_HEADER, 'utf-8');
            return fallbackTarget;
        } catch (e) {
            return null;
        }
    }
}