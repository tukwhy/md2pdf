# -*- coding: utf-8 -*-
"""
Markdown to PDF One-Click Tool (Pandoc + XeLaTeX + ctex)
- 完美支持：中文排版、LaTeX 多行公式、相对路径图片嵌入、代码高亮与长行自动折行
- 零第三方 Python 依赖，仅使用标准库
"""

import os
import sys
import shutil
import argparse
import subprocess
from pathlib import Path

# 控制台 UTF-8 输出兼容
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

DEFAULT_HEADER = r'''% ==========================================
% Pandoc PDF 增强排版模板 (LaTeX Header)
% ==========================================

% 1. 代码块长行自动折行支持
\usepackage{fvextra}
\DefineVerbatimEnvironment{Highlighting}{Verbatim}{breaklines,breakanywhere=true,commandchars=\\\{\}}

% 2. 图片浮动控制（尽量就地显示，不乱跑）
\usepackage{float}
\makeatletter
\def\fps@figure{H}
\makeatother

% 3. 段落间距与首行微调
\setlength{\parskip}{0.45em}

% 4. 表格美化增强
\usepackage{booktabs}
\usepackage{array}

% 5. 数学宏包增强
\usepackage{amsmath}
\usepackage{amssymb}
'''

def check_dependencies():
    """检查系统环境依赖"""
    pandoc_path = shutil.which("pandoc")
    xelatex_path = shutil.which("xelatex")
    
    missing = []
    if not pandoc_path:
        missing.append("pandoc (请先安装 Pandoc: https://pandoc.org/installing.html)")
    if not xelatex_path:
        missing.append("xelatex (请先安装 TeX Live 或 MiKTeX)")
        
    if missing:
        print("[ERROR] 缺少必要的系统依赖：")
        for m in missing:
            print(f"  - {m}")
        return False
    return True

def get_header_path():
    """查找或创建 header.tex 模板"""
    script_dir = Path(__file__).resolve().parent
    candidates = [
        script_dir / "template" / "header.tex",
        script_dir / "header.tex",
        Path.cwd() / "template" / "header.tex",
        Path.cwd() / "header.tex"
    ]
    for c in candidates:
        if c.exists():
            return c
            
    default_target = script_dir / "template" / "header.tex"
    default_target.parent.mkdir(parents=True, exist_ok=True)
    try:
        default_target.write_text(DEFAULT_HEADER, encoding="utf-8")
        print(f"[INFO] 已自动生成排版配置文件: {default_target}")
        return default_target
    except Exception as e:
        print(f"[WARN] 无法自动创建排版配置文件: {e}")
        return None

def convert_md_to_pdf(md_file: Path, output_file: Path = None, options: dict = None) -> bool:
    """调用 Pandoc 将单个 Markdown 转换为 PDF"""
    if not md_file.exists():
        print(f"[ERROR] 文件不存在: {md_file}")
        return False
        
    if output_file is None:
        output_file = md_file.with_suffix(".pdf")
        
    opts = options or {}
    header_file = get_header_path()
    
    font = opts.get("font", "Microsoft YaHei")
    monofont = opts.get("monofont", "Consolas")
    margin = opts.get("margin", "2.2cm")
    highlight_style = opts.get("highlight", "tango")
    toc = opts.get("toc", False)
    
    # 资源搜索路径：md 所在目录置顶，确保相对路径图片正确解析
    resource_paths = [str(md_file.parent.resolve()), str(Path.cwd().resolve())]
    resource_path_arg = os.pathsep.join(list(dict.fromkeys(resource_paths)))

    cmd = [
        "pandoc",
        str(md_file.resolve()),
        "-o", str(output_file.resolve()),
        "--pdf-engine=xelatex",
        "--resource-path", resource_path_arg,
        "-V", "documentclass=ctexart",
        "-V", f"geometry:margin={margin}",
        "-V", f"CJKmainfont={font}",
        "-V", f"monofont={monofont}",
        "-V", "colorlinks=true",
        "-V", "linkcolor=blue",
        "-V", "urlcolor=blue",
        f"--highlight-style={highlight_style}",
    ]
    
    if header_file and header_file.exists():
        cmd.extend(["-H", str(header_file.resolve())])
        
    if toc:
        cmd.append("--toc")
        
    print(f"\n[RUNNING] 正在渲染: {md_file.name} -> {output_file.name}")
    print(f"  引擎: XeLaTeX | 中文字体: {font} | 等宽字体: {monofont}")

    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace"
        )
        if result.returncode != 0:
            print("[ERROR] 渲染失败，Pandoc 报错输出：")
            print(result.stderr)
            return False
            
        print(f"[SUCCESS] PDF 生成成功: {output_file.name}")
        if opts.get("open_after", False):
            try:
                if sys.platform == "win32":
                    os.startfile(output_file)
                elif sys.platform == "darwin":
                    subprocess.Popen(["open", str(output_file)])
                else:
                    subprocess.Popen(["xdg-open", str(output_file)])
            except Exception:
                pass
        return True
    except Exception as ex:
        print(f"[EXCEPTION] 执行异常: {ex}")
        return False

def find_md_files(target_dir: Path):
    """查找目录下的 Markdown 文件（排除 README 说明文档）"""
    mds = list(target_dir.glob("*.md"))
    return [p for p in mds if "readme" not in p.name.lower()]

def main():
    parser = argparse.ArgumentParser(
        description="Markdown 转 PDF 一键渲染工具 (Pandoc + XeLaTeX)",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("files", nargs="*", help="要转换的 Markdown 文件路径（留空则自动扫描当前目录）")
    parser.add_argument("-o", "--output", help="输出 PDF 路径（仅在单个输入文件时有效）")
    parser.add_argument("--font", default="Microsoft YaHei", help="中文字体名称 (默认: Microsoft YaHei)")
    parser.add_argument("--monofont", default="Consolas", help="代码等宽字体名称 (默认: Consolas)")
    parser.add_argument("--margin", default="2.2cm", help="页边距 (默认: 2.2cm)")
    parser.add_argument("--highlight", default="tango", help="代码高亮主题 (默认: tango)")
    parser.add_argument("--toc", action="store_true", help="是否在正文前生成目录")
    parser.add_argument("--no-open", action="store_true", help="转换完成后不自动打开 PDF")
    
    args = parser.parse_args()
    
    if not check_dependencies():
        input("\n按回车键退出...")
        sys.exit(1)
        
    options = {
        "font": args.font,
        "monofont": args.monofont,
        "margin": args.margin,
        "highlight": args.highlight,
        "toc": args.toc,
        "open_after": not args.no_open
    }
    
    targets = []
    if args.files:
        for f in args.files:
            p = Path(f)
            if p.is_file():
                targets.append(p)
            elif p.is_dir():
                targets.extend(find_md_files(p))
            else:
                print(f"[WARN] 找不到路径: {f}")
    else:
        candidates = find_md_files(Path.cwd())
        if not candidates:
            candidates = find_md_files(Path(__file__).resolve().parent)
        targets = candidates

    if not targets:
        print("[INFO] 当前目录下未发现 Markdown 文件。")
        print("  提示: 可将需要转换的 .md 文件放入此目录，或直接拖拽 .md 文件到脚本图标上。")
        input("\n按回车键退出...")
        return
        
    print(f"==================================================")
    print(f"  Markdown -> PDF 一键转换工具")
    print(f"  共检测到 {len(targets)} 个 Markdown 文件待转换")
    print(f"==================================================")
    
    success_count = 0
    for idx, target in enumerate(targets, 1):
        out = Path(args.output) if (args.output and len(targets) == 1) else None
        print(f"[{idx}/{len(targets)}] 开始处理: {target.name}")
        if convert_md_to_pdf(target, output_file=out, options=options):
            success_count += 1
            
    print(f"\n[DONE] 转换结束！成功完成: {success_count}/{len(targets)} 个文件。")

if __name__ == "__main__":
    main()