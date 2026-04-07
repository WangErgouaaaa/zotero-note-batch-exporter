# Changelog

All notable changes to this project will be documented in this file.

## 3.0.2 - 2026-04-07

- 新增 `工具 -> 导出选中条目笔记`
- 保留并继续支持 `工具 -> 批量导出分类笔记`
- 将分类导出与选中条目导出统一到共享导出管线
- 保留 HTML 到 Markdown 转换、非法字符处理和重名文件避让
- 补充本地 Node 回归测试

## 3.0.1 - 2026-04-07

- 修复工具菜单在窗口初始化较慢时可能不显示的问题
- 新增工具菜单注入重试机制

## 3.0.0 - 2026-04-07

- 基于 Zotero 8 的 bootstrap 插件实现批量导出分类笔记
- 支持导出独立笔记和文献子笔记
