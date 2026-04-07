const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

function text(value) {
  return { nodeType: TEXT_NODE, textContent: value };
}

function el(tag, children = [], attrs = {}) {
  return {
    nodeType: ELEMENT_NODE,
    tagName: tag.toUpperCase(),
    childNodes: children,
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    }
  };
}

class MockDOMParser {
  parseFromString(source) {
    let root;
    if (source.includes("Primary Note")) {
      root = el("div", [
        el("h2", [text("Primary Heading")]),
        el("p", [
          text("Alpha "),
          el("strong", [text("Bold")]),
          text(" "),
          el("a", [text("Link")], { href: "https://example.com" })
        ])
      ]);
    } else {
      root = el("div", [el("p", [text("Child Note")])]);
    }

    return { body: { firstElementChild: root } };
  }
}

function loadPlugin(context) {
  const source = fs.readFileSync(
    path.join(process.cwd(), "bootstrap.js"),
    "utf8"
  );
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "bootstrap.js" });
}

async function main() {
  const writes = [];
  const alerts = [];
  const nodes = new Map();

  const popup = {
    children: [],
    appendChild(node) {
      this.children.push(node);
      if (node.id) {
        nodes.set(node.id, node);
      }
      return node;
    }
  };

  const selectedNote = {
    id: 101,
    isNote: () => true,
    isRegularItem: () => false,
    getNotes: () => [],
    getNoteTitle: () => "Primary Note",
    getNote: () => "<h2>Primary Note</h2><p>Alpha <strong>Bold</strong> <a href=\"https://example.com\">Link</a></p>"
  };
  const childNote = {
    id: 102,
    isNote: () => true,
    isRegularItem: () => false,
    getNotes: () => [],
    getNoteTitle: () => "Child Note",
    getNote: () => "<p>Child Note</p>"
  };
  const parentItem = {
    id: 201,
    isNote: () => false,
    isRegularItem: () => true,
    getNotes: () => [102]
  };

  class FilePicker {
    constructor() {
      this.modeGetFolder = 1;
      this.returnOK = 1;
      this.file = "C:\\export-dir";
    }
    init() {}
    async show() {
      return this.returnOK;
    }
  }

  const win = {
    DOMParser: MockDOMParser,
    setTimeout(callback) {
      callback();
      return 1;
    },
    clearTimeout() {},
    document: {
      getElementById(id) {
        if (id === "menu_ToolsPopup") {
          return popup;
        }
        return nodes.get(id) || null;
      },
      createXULElement(tag) {
        return {
          tagName: tag,
          setAttribute(name, value) {
            this[name] = value;
          },
          addEventListener(type, handler) {
            this[`on_${type}`] = handler;
          },
          remove() {}
        };
      }
    },
    ZoteroPane: {
      getSelectedItems: () => [selectedNote, parentItem, selectedNote]
    }
  };

  const context = {
    console,
    Zotero: {
      debug() {},
      getMainWindows: () => [win],
      Items: {
        get(id) {
          return id === 102 ? childNote : null;
        }
      },
      Collections: {
        getByParent() {
          return [];
        }
      }
    },
    Services: {
      prompt: {
        alert(_win, _title, message) {
          alerts.push(message);
        },
        confirm() {
          return false;
        }
      }
    },
    ChromeUtils: {
      importESModule() {
        return { FilePicker };
      }
    },
    IOUtils: {
      async exists(target) {
        return writes.some((entry) => entry.path === target);
      },
      async writeUTF8(target, content) {
        writes.push({ path: target, content });
      }
    },
    PathUtils: {
      join: (...parts) => path.win32.join(...parts)
    }
  };

  loadPlugin(context);
  context.startup({ id: "x", version: "1", rootURI: "" }, 3);

  assert.ok(
    nodes.get("note-batch-exporter-selected-menuitem"),
    "selected item export menu should be injected"
  );

  await context.exportSelectedItemsNotes(win);

  assert.strictEqual(writes.length, 2, "should export only notes from selected items");
  assert.ok(writes[0].path.endsWith("Primary Note.md"));
  assert.ok(writes[1].path.endsWith("Child Note.md"));
  assert.ok(writes[0].content.includes("## Primary Heading"));
  assert.ok(writes[0].content.includes("**Bold**"));
  assert.ok(writes[0].content.includes("[Link](https://example.com)"));
  assert.ok(alerts.at(-1).includes("2/2"));
}

main().then(
  () => console.log("selected items export ok"),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
