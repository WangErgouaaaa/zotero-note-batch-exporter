# 批量导出分类笔记

一个面向 Zotero 8 的轻量插件，用于将笔记批量导出为 Markdown 文件。

## 功能

- 从当前选中分类导出该分类下的全部笔记
- 可选是否递归包含子分类
- 从当前中间条目列表中，仅导出选中条目关联的笔记
- 同时支持独立笔记和文献条目的子笔记
- 将笔记 HTML 内容转换为 Markdown
- 自动处理非法文件名与重名文件

## 适用环境

- Zotero `8.0.4`
- 基于 Firefox `140`
- Windows 已验证

## 使用方法

安装插件后，在 Zotero 主窗口顶部菜单中打开：

`工具 -> 批量导出分类笔记`

或：

`工具 -> 导出选中条目笔记`

### 1. 批量导出分类笔记

- 先在左侧选中一个分类
- 插件会检查是否存在子分类
- 如存在，会提示是否一并导出
- 然后选择导出目录
- 最终将该分类内的笔记导出为 `.md` 文件

### 2. 导出选中条目笔记

- 先在中间条目列表中选择若干条目
- 如果选中的是笔记，直接导出该笔记
- 如果选中的是普通文献条目，导出其子笔记
- 然后选择导出目录
- 最终只导出这些选中条目关联到的笔记

## 仓库结构

```text
.
├─ manifest.json
├─ bootstrap.js
├─ updates.json
├─ README.md
├─ INSTALL.md
├─ CHANGELOG.md
├─ LICENSE
├─ .gitignore
├─ dist/
│  └─ note-batch-exporter-v3.0.2.xpi
├─ tests/
│  ├─ collection-export.test.js
│  ├─ menu-retry.test.js
│  └─ selected-items-export.test.js
└─ docs/
   └─ development.md
```

## 开发与打包

插件源码只包含两个核心文件：

- `manifest.json`
- `bootstrap.js`

打包方式：

1. 将这两个文件直接压缩到 zip 根目录
2. 将 `.zip` 后缀改为 `.xpi`
3. 在 Zotero 中通过“从文件安装附加组件”安装

更详细的开发说明见 [docs/development.md](docs/development.md)。

## 测试

当前仓库附带了 3 个基于 Node 的轻量回归测试：

- `tests/menu-retry.test.js`
- `tests/collection-export.test.js`
- `tests/selected-items-export.test.js`

用于验证：

- 工具菜单延迟注入
- 分类批量导出
- 选中条目导出

## 自动更新说明

`manifest.json` 中的 `update_url` 已保留为当前开发用地址。正式发布到你的 GitHub 仓库前，请同步修改：

- `manifest.json` 中的 `applications.zotero.update_url`
- `updates.json` 中的下载地址和哈希值

Zotero 7/8 使用 JSON 更新清单，相关说明见官方文档：

- Zotero 开发文档：https://www.zotero.org/support/dev/zotero_7_for_developers
- Zotero 8 插件开发参考：https://gist.github.com/EwoutH/04c8df5a97963b5b46cec9f392ceb103

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE)。
