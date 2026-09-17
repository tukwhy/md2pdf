# md2pdf - Markdown 转 PDF 工具与 VS Code 插件

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-007ACC.svg)](https://marketplace.visualstudio.com/)
[![Pandoc](https://img.shields.io/badge/Pandoc-3.0+-orange.svg)](https://pandoc.org/)
[![Engine: XeLaTeX](https://img.shields.io/badge/Engine-XeLaTeX-red.svg)](https://tug.org/texlive/)

专为中文技术报告、论文、学习笔记打造的 **Markdown 转出版级 PDF 工具与 VS Code 扩展插件**。

底层基于 **Pandoc + XeLaTeX + ctexart** 构建，彻底解决 Markdown 导出 PDF 时的 **中文不显示/乱码**、**复杂 LaTeX 公式错位**、**相对路径图片丢失**、**代码长行超出页面截断** 等问题。

---

## 🌟 核心特性

- 🧩 **VS Code 原生插件**：支持直接在 VS Code 中安装使用，提供编辑器右上角快捷图标、右键菜单、命令面板与状态栏一键导出。
- 👁️ **双模预览渲染功能**：
  - **⚡ 即时渲染预览**：分屏实时渲染 Markdown、KaTeX LaTeX 数学公式、相对路径图片与代码块，输入即反馈；
  - **📄 真机 PDF 视图**：在分屏中一键调用后台 XeLaTeX 进行真实渲染并即时展示编译后的排版。
- ⚙️ **丰富的图形化配置项**：在 VS Code 设置界面中直观修改中文字体、代码字体、边距、语法高亮配色主题、目录等。
- 🀄 **出版级中文排版**：内置 `ctexart` 权威中文宏包，标题分级、段落行距、中文标点避头尾、中英文间距均符合专业出版规范。
- 📐 **LaTeX 公式完美支持**：支持行内公式 `$E=mc^2$` 与多行矩阵公式 `$$ \begin{aligned}...\end{aligned} $$`。
- 🖼️ **图片相对路径解析**：自动绑定资源路径（`--resource-path`），不管图片在当前目录还是子文件夹均能定位，强制就地排版。
- 💻 **长代码自动折行**：引入 `fvextra` 宏包，超长代码自动折行，绝不溢出页面边界；搭配 `Consolas` 等宽字体与语法高亮。
- 🚀 **双轨使用模式**：既可在 VS Code 内部作为插件使用，也可脱离 VS Code 直接使用独立脚本/双击批处理。

---

## 📋 系统前置环境

在运行本工具（无论是插件还是脚本）前，请确保系统已安装：

1. **[Pandoc](https://pandoc.org/installing.html)** (3.0+)
2. **TeX Live / MacTeX / MiKTeX**（包含 `xelatex` 引擎）
   - Windows 推荐安装完整的 [TeX Live](https://tug.org/texlive/) 或 [MiKTeX](https://miktex.org/)。

> 💡 验证安装：在终端输入 `pandoc --version` 和 `xelatex --version` 能正常返回版本号即可。

---

## 🔌 VS Code 插件使用指南

### 1. 安装插件
可以直接运行打包好的 `.vsix` 文件进行安装：
```bash
code --install-extension md2pdf-0.1.0.vsix
```
或者在 VS Code 扩展面板（`Ctrl+Shift+X`）中，点击右上角 `...` -> **“从 VSIX 安装...” (Install from VSIX...)**，选择本目录下的 `md2pdf-0.1.0.vsix` 即可完成安装。

### 2. 核心功能入口
在 VS Code 中打开任意 Markdown 文件：
1. **编辑器右上角快捷图标**：
   - ⚡ 点击 `打开分屏渲染预览` 图标，在右侧分屏打开即时渲染与真机对比面板；
   - 💾 点击 `导出为 PDF` 图标，立即生成 PDF 并弹出提示。
2. **右键菜单**：
   - 编辑器内右键或资源管理器中的 `.md` 文件右键，均有 **“MD2PDF: 导出为 PDF”**。
3. **快捷键与命令面板**：
   - 按 `Ctrl+Shift+P` 输入 `MD2PDF`，即可选择导出、预览或进入设置。
4. **状态栏按钮**：
   - 编辑 Markdown 文档时，VS Code 右下角状态栏会显示 `$(file-pdf) MD2PDF 导出`。

### 3. 在 VS Code 中修改配置
打开 VS Code 设置（`Ctrl+,`），搜索 `md2pdf`，即可图形化配置：
- **CJK Font**：中文字体（默认 `Microsoft YaHei`，可选 `SimSun`, `SimHei`, `KaiTi` 等）
- **Mono Font**：代码等宽字体（默认 `Consolas`）
- **Margin**：页面边距（默认 `2.2cm`）
- **Highlight Style**：代码高亮主题（默认 `tango`，可选 `monokai`, `pygments`, `kate` 等）
- **Toc**：是否在文档最前自动生成目录（默认 `false`）
- **Custom Header**：自定义 LaTeX 模板路径（默认使用自带的 `template/header.tex`）
- **Open After Export**：导出完成后是否自动打开 PDF（默认 `true`）

---

## 🖥️ 独立脚本 / 命令行使用

若不启动 VS Code，依然可以使用附带的独立脚本：

### 1. 双击即用
- Windows 下直接双击 **`一键转PDF.bat`**，自动扫描当前目录 md 并转换。
- 也可直接将 `.md` 文件拖到 `一键转PDF.bat` 图标上。

### 2. 命令行
```bash
# 转换当前目录下全部 md
python md2pdf.py

# 转换指定文件
python md2pdf.py your_document.md -o output.pdf

# 生成目录
python md2pdf.py your_document.md --toc
```

---

## 🛠️ 项目源码与开发

```text
md2pdf/
├── src/                    # VS Code 插件 TypeScript 源码
│   ├── extension.ts        # 插件入口与命令注册
│   ├── exporter.ts         # 核心 PDF 导出调度逻辑
│   └── previewPanel.ts     # 分屏渲染预览面板（KaTeX + 实时渲染 + 真机 PDF）
├── template/
│   └── header.tex          # LaTeX 宏包与排版配置模板
├── package.json            # 插件配置与元数据定义
├── tsconfig.json           # TypeScript 编译配置
├── md2pdf-0.1.0.vsix       # 打包好的 VS Code 插件离线安装包
├── 一键转PDF.bat           # Windows 独立双击脚本
└── md2pdf.py               # 独立 Python 转换脚本
```

### 编译与重新打包插件
```bash
# 编译 TypeScript
npm run compile

# 打包生成 .vsix 安装包
npm run package
```

---

## 📄 License

本项目基于 [MIT License](LICENSE) 开源。