"use strict";

const MENU_ITEM_ID = "note-batch-exporter-menuitem";
const SELECTED_MENU_ITEM_ID = "note-batch-exporter-selected-menuitem";
const MENU_SEPARATOR_ID = "note-batch-exporter-separator";
const LOG_PREFIX = "[批量导出分类笔记] ";
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;
const MENU_RETRY_DELAY = 250;
const MENU_RETRY_LIMIT = 20;

const menuRetryTimers = new WeakMap();

function logDebug(message, error) {
  try {
    const suffix = error ? ` ${error}` : "";
    Zotero.debug(`${LOG_PREFIX}${message}${suffix}`);
  } catch (_error) {}
}

function normalizeWhitespace(text) {
  return (text || "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t\r\n]+/g, " ");
}

function collapseMarkdown(markdown) {
  return (markdown || "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderInline(node, state) {
  if (!node) {
    return "";
  }

  if (node.nodeType === TEXT_NODE) {
    return normalizeWhitespace(node.textContent);
  }

  if (node.nodeType !== ELEMENT_NODE) {
    return "";
  }

  const tag = node.tagName.toLowerCase();
  const content = renderChildren(node, state).trim();

  switch (tag) {
    case "strong":
    case "b":
      return content ? `**${content}**` : "";
    case "em":
    case "i":
      return content ? `*${content}*` : "";
    case "a": {
      const href = node.getAttribute("href") || "";
      if (!href) {
        return content;
      }
      return `[${content || href}](${href})`;
    }
    case "br":
      return "\n";
    default:
      return renderChildren(node, state);
  }
}

function renderList(node, state) {
  const lines = [];
  for (const child of node.childNodes) {
    if (child.nodeType === ELEMENT_NODE && child.tagName.toLowerCase() === "li") {
      const value = collapseMarkdown(renderChildren(child, state));
      if (value) {
        lines.push(`- ${value}`);
      }
      continue;
    }

    const extra = collapseMarkdown(renderNode(child, state));
    if (extra) {
      lines.push(extra);
    }
  }
  return lines.length ? `${lines.join("\n")}\n\n` : "";
}

function renderBlock(tag, content) {
  const value = collapseMarkdown(content);
  if (!value) {
    return "";
  }

  switch (tag) {
    case "h1":
      return `# ${value}\n\n`;
    case "h2":
      return `## ${value}\n\n`;
    case "h3":
      return `### ${value}\n\n`;
    case "h4":
      return `#### ${value}\n\n`;
    case "blockquote":
      return `${value.split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
    case "pre":
      return `\`\`\`\n${content.trim()}\n\`\`\`\n\n`;
    default:
      return `${value}\n\n`;
  }
}

function renderNode(node, state) {
  if (!node) {
    return "";
  }

  if (node.nodeType === TEXT_NODE) {
    return normalizeWhitespace(node.textContent);
  }

  if (node.nodeType !== ELEMENT_NODE) {
    return "";
  }

  const tag = node.tagName.toLowerCase();

  switch (tag) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "p":
    case "div":
    case "blockquote":
    case "pre":
      return renderBlock(tag, renderChildren(node, state));
    case "ul":
    case "ol":
      return renderList(node, state);
    case "li":
      return renderBlock("div", renderChildren(node, state));
    case "strong":
    case "b":
    case "em":
    case "i":
    case "a":
    case "br":
      return renderInline(node, state);
    default:
      return renderChildren(node, state);
  }
}

function renderChildren(node, state) {
  const parts = [];
  for (const child of node.childNodes) {
    parts.push(renderNode(child, state));
  }
  return parts.join("");
}

function htmlToMarkdown(win, html) {
  try {
    const parser = new win.DOMParser();
    const doc = parser.parseFromString(`<div>${html || ""}</div>`, "text/html");
    const root = doc.body.firstElementChild || doc.body;
    return collapseMarkdown(renderChildren(root, {}));
  } catch (error) {
    logDebug("HTML 转 Markdown 失败，回退为纯文本。", error);
    return collapseMarkdown(
      String(html || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;/gi, "'")
    );
  }
}

function sanitizeFileName(name, fallback) {
  const value = (name || fallback || "未命名笔记")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/[\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return value || fallback || "未命名笔记";
}

function getDirectoryPath(dir) {
  if (!dir) {
    return "";
  }

  if (typeof dir === "string") {
    return dir;
  }

  if (typeof dir.path === "string") {
    return dir.path;
  }

  return String(dir);
}

function addNoteIfNeeded(note, notes, seen) {
  if (!note || !note.id || seen.has(note.id)) {
    return;
  }
  seen.add(note.id);
  notes.push(note);
}

function collectCollectionNotes(collection, includeSubcollections, notes, seen) {
  for (const item of collection.getChildItems()) {
    if (item.isNote()) {
      addNoteIfNeeded(item, notes, seen);
      continue;
    }

    if (!item.isRegularItem()) {
      continue;
    }

    for (const noteID of item.getNotes()) {
      addNoteIfNeeded(Zotero.Items.get(noteID), notes, seen);
    }
  }

  if (!includeSubcollections) {
    return;
  }

  for (const subcollection of Zotero.Collections.getByParent(collection.id)) {
    collectCollectionNotes(subcollection, true, notes, seen);
  }
}

function collectItemNotes(items, notes, seen) {
  for (const item of items || []) {
    if (!item) {
      continue;
    }

    if (item.isNote()) {
      addNoteIfNeeded(item, notes, seen);
      continue;
    }

    if (!item.isRegularItem()) {
      continue;
    }

    for (const noteID of item.getNotes()) {
      addNoteIfNeeded(Zotero.Items.get(noteID), notes, seen);
    }
  }
}

function getSelectedCollection(win) {
  return win?.ZoteroPane?.getSelectedCollection?.() || null;
}

function getSelectedItems(win) {
  return win?.ZoteroPane?.getSelectedItems?.() || [];
}

async function chooseExportDirectory(win, count) {
  const { FilePicker } = ChromeUtils.importESModule(
    "chrome://zotero/content/modules/filePicker.mjs"
  );
  const picker = new FilePicker();
  picker.init(win, `选择导出目录（共 ${count} 篇笔记）`, picker.modeGetFolder);
  const result = await picker.show();
  if (result !== picker.returnOK) {
    return null;
  }
  return picker.file;
}

async function buildUniqueFilePath(dirPath, baseName) {
  let index = 0;
  while (true) {
    const suffix = index === 0 ? "" : `_${index}`;
    const filePath = PathUtils.join(dirPath, `${baseName}${suffix}.md`);
    if (!(await IOUtils.exists(filePath))) {
      return filePath;
    }
    index += 1;
  }
}

async function exportNotes(win, notes, dialogTitle, sourceLabel) {
  try {
    if (!notes.length) {
      Services.prompt.alert(win, dialogTitle, `${sourceLabel}没有可导出的笔记。`);
      return;
    }

    const dir = await chooseExportDirectory(win, notes.length);
    if (!dir) {
      return;
    }

    const dirPath = getDirectoryPath(dir);
    if (!dirPath) {
      throw new Error("无法获取导出目录路径");
    }

    let successCount = 0;
    const failures = [];

    for (const note of notes) {
      try {
        const title = note.getNoteTitle() || `笔记_${note.id}`;
        const fileName = sanitizeFileName(title, `笔记_${note.id}`);
        const markdownBody = htmlToMarkdown(win, note.getNote());
        const filePath = await buildUniqueFilePath(dirPath, fileName);
        const output = `# ${title}\n\n${markdownBody}`.trimEnd() + "\n";

        await IOUtils.writeUTF8(filePath, output);
        successCount += 1;
      } catch (error) {
        const noteLabel = note?.getNoteTitle?.() || `笔记_${note?.id || "unknown"}`;
        failures.push(`${noteLabel}: ${error.message}`);
        logDebug(`导出笔记失败 ${noteLabel}`, error);
      }
    }

    const lines = [
      sourceLabel,
      `导出成功：${successCount}/${notes.length}`,
      `导出目录：${dirPath}`
    ];

    if (failures.length) {
      lines.push("", `失败 ${failures.length} 篇：`);
      lines.push(...failures.slice(0, 10));
      if (failures.length > 10) {
        lines.push(`其余 ${failures.length - 10} 篇失败已写入调试日志。`);
      }
    }

    Services.prompt.alert(win, dialogTitle, lines.join("\n"));
  } catch (error) {
    logDebug(`${dialogTitle}失败。`, error);
    Services.prompt.alert(win, dialogTitle, `导出失败：${error.message}`);
  }
}

async function exportSelectedCollectionNotes(win) {
  try {
    const collection = getSelectedCollection(win);
    if (!collection) {
      Services.prompt.alert(win, "批量导出分类笔记", "请先在左侧选择一个分类。");
      return;
    }

    const subcollections = Zotero.Collections.getByParent(collection.id);
    const includeSubcollections =
      subcollections.length > 0 &&
      Services.prompt.confirm(
        win,
        "批量导出分类笔记",
        `分类“${collection.name}”下有 ${subcollections.length} 个子分类，是否一并导出？`
      );

    const notes = [];
    collectCollectionNotes(collection, includeSubcollections, notes, new Set());
    await exportNotes(win, notes, "批量导出分类笔记", `分类：${collection.name}`);
  } catch (error) {
    logDebug("批量导出分类笔记失败。", error);
    Services.prompt.alert(win, "批量导出分类笔记", `导出失败：${error.message}`);
  }
}

async function exportSelectedItemsNotes(win) {
  try {
    const items = getSelectedItems(win);
    if (!items.length) {
      Services.prompt.alert(win, "导出选中条目笔记", "请先在中间条目列表中选择条目。");
      return;
    }

    const notes = [];
    collectItemNotes(items, notes, new Set());
    await exportNotes(win, notes, "导出选中条目笔记", `选中条目：${items.length} 项`);
  } catch (error) {
    logDebug("导出选中条目笔记失败。", error);
    Services.prompt.alert(win, "导出选中条目笔记", `导出失败：${error.message}`);
  }
}

function removeMenuItem(win) {
  try {
    const timer = menuRetryTimers.get(win);
    if (timer) {
      win.clearTimeout(timer);
      menuRetryTimers.delete(win);
    }
    win?.document?.getElementById(MENU_ITEM_ID)?.remove();
    win?.document?.getElementById(SELECTED_MENU_ITEM_ID)?.remove();
    win?.document?.getElementById(MENU_SEPARATOR_ID)?.remove();
  } catch (error) {
    logDebug("移除菜单项失败。", error);
  }
}

function addMenuItem(win) {
  try {
    const doc = win?.document;
    const toolsPopup = doc?.getElementById("menu_ToolsPopup");
    if (!doc || !toolsPopup) {
      return false;
    }

    if (doc.getElementById(MENU_ITEM_ID) && doc.getElementById(SELECTED_MENU_ITEM_ID)) {
      return true;
    }

    win?.document?.getElementById(MENU_ITEM_ID)?.remove();
    win?.document?.getElementById(SELECTED_MENU_ITEM_ID)?.remove();
    win?.document?.getElementById(MENU_SEPARATOR_ID)?.remove();

    const separator = doc.createXULElement("menuseparator");
    separator.id = MENU_SEPARATOR_ID;

    const menuItem = doc.createXULElement("menuitem");
    menuItem.id = MENU_ITEM_ID;
    menuItem.setAttribute("label", "批量导出分类笔记");
    menuItem.addEventListener("command", () => {
      void exportSelectedCollectionNotes(win);
    });

    const selectedMenuItem = doc.createXULElement("menuitem");
    selectedMenuItem.id = SELECTED_MENU_ITEM_ID;
    selectedMenuItem.setAttribute("label", "导出选中条目笔记");
    selectedMenuItem.addEventListener("command", () => {
      void exportSelectedItemsNotes(win);
    });

    toolsPopup.appendChild(separator);
    toolsPopup.appendChild(menuItem);
    toolsPopup.appendChild(selectedMenuItem);
    return true;
  } catch (error) {
    logDebug("注入工具菜单失败。", error);
    return false;
  }
}

function ensureMenuItem(win, attempt = 0) {
  try {
    if (addMenuItem(win)) {
      const timer = menuRetryTimers.get(win);
      if (timer) {
        win.clearTimeout(timer);
        menuRetryTimers.delete(win);
      }
      return;
    }

    if (!win || attempt >= MENU_RETRY_LIMIT) {
      logDebug("工具菜单节点未就绪，已停止重试注入。");
      return;
    }

    const existingTimer = menuRetryTimers.get(win);
    if (existingTimer) {
      win.clearTimeout(existingTimer);
    }

    const timer = win.setTimeout(() => {
      menuRetryTimers.delete(win);
      ensureMenuItem(win, attempt + 1);
    }, MENU_RETRY_DELAY);

    menuRetryTimers.set(win, timer);
  } catch (error) {
    logDebug("安排菜单注入重试失败。", error);
  }
}

function startup({ id, version, rootURI }, reason) {
  try {
    logDebug(`startup id=${id} version=${version} reason=${reason}`);
    for (const win of Zotero.getMainWindows()) {
      ensureMenuItem(win);
    }
  } catch (error) {
    logDebug("startup 失败。", error);
  }
}

function shutdown({ id, version, rootURI }, reason) {
  try {
    logDebug(`shutdown id=${id} version=${version} reason=${reason}`);
    for (const win of Zotero.getMainWindows()) {
      removeMenuItem(win);
    }
  } catch (error) {
    logDebug("shutdown 失败。", error);
  }
}

function onMainWindowLoad({ window }) {
  try {
    ensureMenuItem(window);
  } catch (error) {
    logDebug("onMainWindowLoad 失败。", error);
  }
}

function onMainWindowUnload({ window }) {
  try {
    removeMenuItem(window);
  } catch (error) {
    logDebug("onMainWindowUnload 失败。", error);
  }
}

function install(data, reason) {
  try {
    logDebug(`install reason=${reason}`);
  } catch (error) {
    logDebug("install 失败。", error);
  }
}

function uninstall(data, reason) {
  try {
    logDebug(`uninstall reason=${reason}`);
  } catch (error) {
    logDebug("uninstall 失败。", error);
  }
}
