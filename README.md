# md2pdf - Markdown 转 PDF 一键渲染工具

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python: 3.7+](https://img.shields.io/badge/Python-3.7+-green.svg)](https://www.python.org/)
[![Pandoc](https://img.shields.io/badge/Pandoc-3.0+-orange.svg)](https://pandoc.org/)
[![Engine: XeLaTeX](https://img.shields.io/badge/Engine-XeLaTeX-red.svg)](https://tug.org/texlive/)

专为中文技术报告、论文、学习笔记打造的 **Markdown 转高质量 PDF 一键渲染工具**。

基于 **Pandoc + XeLaTeX + ctexart** 构建，解决原生 Pandoc 导出 PDF 时的 **中文不显示/乱码**、**复杂 LaTeX 公式排版**、**相对路径图片嵌入**、**长代码截断** 等问题。

---

## 🌟 核心特性

- 🀄 **出版级中文排版**：内置 `ctexart` 宏包，标题分级、段落行距、中文标点避头尾、中英文间距均符合专业排版规范。
- 📐 **LaTeX 公式完整支持**：原生支持行内公式 `$E=mc^2$` 与多行矩阵公式 `$$ \begin{aligned}...\end{aligned} $$`。
- 🖼️ **图片相对路径解析**：自动绑定资源路径（`--resource-path`），引用同级或子文件夹中的图片均能精确定位，强制就地排版（防止图片漂移）。
- 💻 **长代码自动折行**：引入 `fvextra` 宏包，超长代码自动折行，绝不溢出页面边界；默认搭配 `Consolas` 等宽字体与语法高亮。
- ⚡ **零额外依赖**：纯 Python 标准库编写，无需执行 `pip install` 安装第三方包。

---

## 📋 环境依赖

在运行本工具前，请确保系统已安装以下 CLI 工具并添加至环境变量：

1. **[Python](https://www.python.org/downloads/)** (3.7+)
2. **[Pandoc](https://pandoc.org/installing.html)** (3.0+)
3. **TeX Live / MacTeX / MiKTeX**（包含 `xelatex` 引擎）

> 💡 验证安装：终端输入 `python --version`、`pandoc --version`、`xelatex --version` 均能正常返回版本号即可。

---

## 🚀 使用方法

### 1. Windows 一键双击（最简）
直接双击运行 **`一键转PDF.bat`**：
- 自动扫描转换当前目录下的 Markdown 文件。
- 渲染完成后自动调用系统默认 PDF 阅读器打开。

### 2. 鼠标拖拽转换
将任意 `.md` 文件直接**拖拽到 `一键转PDF.bat` 图标上**松开即可。

### 3. 命令行调用
```bash
# 转换当前目录下全部 md
python md2pdf.py

# 转换指定文件
python md2pdf.py your_document.md

# 自定义输出文件名
python md2pdf.py your_document.md -o output.pdf

# 自动生成文档目录
python md2pdf.py your_document.md --toc
```

---

## 📦 项目结构

```text
md2pdf/
├── .gitignore              # Git 忽略配置
├── LICENSE                 # MIT 开源协议
├── README.md               # 项目说明文档
├── 一键转PDF.bat           # Windows 双击 / 拖拽一键入口
├── md2pdf.bat              # 命令行快捷脚本（Windows）
├── md2pdf.py               # 核心转换脚本
└── template/
    └── header.tex          # LaTeX 样式与宏包配置文件
```

---

## 💡 关于 Release 说明

- **不需要上传 Release 二进制包**：
  本工具为轻量级 Python 脚本（零 pip 第三方库），真正的体积依赖是系统级的 Pandoc 与 TeX 环境，无法脱离独立运行。源码分发即是最佳实践。
- 若需发布版本，直接在 GitHub 上打 `git tag`（如 `v1.0.0`）即可自动生成源码归档。

---

## ⚙️ 常用进阶参数

| 参数 | 说明 | 默认值 |
| :--- | :--- | :--- |
| `-o, --output` | 指定输出 PDF 路径 | `同名.pdf` |
| `--font` | 中文字体名称 | `Microsoft YaHei` |
| `--monofont` | 等宽代码字体 | `Consolas` |
| `--margin` | 页边距 | `2.2cm` |
| `--highlight` | 语法高亮配色主题 | `tango` |
| `--toc` | 在文首自动生成目录 | 关闭 |
| `--no-open` | 转换完成后不自动打开 PDF | 自动打开 |

---

## 📄 License

本项目基于 [MIT License](LICENSE) 开源。