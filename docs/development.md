# 开发说明

## 源码结构

这个插件的实际 Zotero 源码只有两个文件：

- `manifest.json`
- `bootstrap.js`

这也是最终 `.xpi` 打包时必须位于 zip 根目录的两个文件。

## 本地测试

仓库中的 `tests/` 目录保存了当前使用的轻量回归脚本。

可执行命令：

```powershell
node .\tests\menu-retry.test.js
node .\tests\collection-export.test.js
node .\tests\selected-items-export.test.js
node --check .\bootstrap.js
```

## 打包流程

在仓库根目录执行：

```powershell
Compress-Archive -LiteralPath .\manifest.json,.\bootstrap.js -DestinationPath .\note-batch-exporter.zip -CompressionLevel Optimal -Force
Copy-Item .\note-batch-exporter.zip .\note-batch-exporter.xpi -Force
```

注意：

- `manifest.json` 和 `bootstrap.js` 不能位于子目录
- `.xpi` 本质上是改后缀名后的 zip
- 打包后建议手动安装到 Zotero 验证菜单入口和导出功能

## 发布建议

发布到 GitHub 时建议：

1. 在仓库中保留最新的 `dist/*.xpi`
2. 创建 GitHub Release 并上传 `.xpi`
3. 维护 `CHANGELOG.md`
4. 如果需要 Zotero 自动更新：
   - 更新 `manifest.json` 中的 `update_url`
   - 更新 `updates.json` 中的下载地址和版本信息

## 自动更新清单

Zotero 7/8 支持 JSON 更新清单。官方说明：

- https://www.zotero.org/support/dev/zotero_7_for_developers
- https://gist.github.com/EwoutH/04c8df5a97963b5b46cec9f392ceb103

当前仓库附带了一个 `updates.json` 样例，发布前请改成你自己的 GitHub Releases 地址并补上真实哈希值。
