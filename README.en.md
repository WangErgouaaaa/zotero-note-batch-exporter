[English](./README.en.md) | [简体中文](./README.zh-CN.md)

# Zotero Note Batch Exporter

A lightweight Zotero 8 plugin for exporting notes to Markdown files.

## Features

- Export all notes under the currently selected collection
- Optionally include subcollections
- Export only the notes related to currently selected items
- Support both standalone notes and child notes under regular items
- Convert Zotero note HTML into Markdown
- Automatically handle invalid filenames and duplicate filenames

## Environment

- Zotero `8.0.4`
- Based on Firefox `140`
- Verified on Windows

## Usage

After installing the plugin, open one of these commands from the Zotero top menu:

`Tools -> 批量导出分类笔记`

or:

`Tools -> 导出选中条目笔记`

### 1. Export Notes from the Selected Collection

- Select a collection in the left pane
- The plugin checks whether subcollections exist
- If subcollections exist, it asks whether to include them
- Choose an export folder
- The notes in that collection are exported as `.md` files

### 2. Export Notes from Selected Items

- Select one or more items in the center item list
- If a selected item is a note, that note is exported directly
- If a selected item is a regular item, its child notes are exported
- Choose an export folder
- Only notes related to the selected items are exported

## Repository Structure

```text
.
├─ manifest.json
├─ bootstrap.js
├─ updates.json
├─ README.md
├─ README.en.md
├─ README.zh-CN.md
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

## Development and Packaging

The actual Zotero plugin source contains only two core files:

- `manifest.json`
- `bootstrap.js`

Packaging steps:

1. Compress these two files directly into the root of a zip file
2. Rename the `.zip` file to `.xpi`
3. Install it in Zotero via “Install Add-on From File”

For more details, see [docs/development.md](docs/development.md).

## Tests

This repository includes 3 lightweight Node-based regression tests:

- `tests/menu-retry.test.js`
- `tests/collection-export.test.js`
- `tests/selected-items-export.test.js`

They verify:

- delayed Tools menu injection
- collection-wide export
- selected-item export

## Auto Update

`manifest.json` and `updates.json` now point to this GitHub repository. When publishing a new version, update the version number, release download link, and SHA-256 hash accordingly.

Official references:

- Zotero developer docs: https://www.zotero.org/support/dev/zotero_7_for_developers
- Zotero 8 plugin reference: https://gist.github.com/EwoutH/04c8df5a97963b5b46cec9f392ceb103

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
