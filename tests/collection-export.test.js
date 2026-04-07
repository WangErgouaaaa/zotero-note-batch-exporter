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
    if (source.includes("Section")) {
      root = el("div", [
        el("h2", [text("Section")]),
        el("p", [
          text("Alpha "),
          el("strong", [text("Bold")]),
          text(" "),
          el("em", [text("Italic")]),
          text(" "),
          el("a", [text("Link")], { href: "https://example.com" }),
          el("br"),
          text("Line & < > \u00A0 \"")
        ]),
        el("ul", [el("li", [text("Bullet")])])
      ]);
    } else if (source.includes("Child note")) {
      root = el("div", [el("p", [text("Child note")])]);
    } else {
      root = el("div", [el("p", [text("Sub collection note")])]);
    }

    return { body: { firstElementChild: root } };
  }
}

async function main() {
  const source = fs.readFileSync(
    path.join(process.cwd(), "bootstrap.js"),
    "utf8"
  );
  const writes = [];
  const alerts = [];
  const confirms = [];
  const docNodes = new Map();

  const popup = {
    appendChild(node) {
      if (node.id) {
        docNodes.set(node.id, node);
      }
      return node;
    }
  };

  const document = {
    getElementById(id) {
      if (id === "menu_ToolsPopup") {
        return popup;
      }
      return docNodes.get(id) || null;
    },
    createXULElement(tag) {
      return {
        tagName: tag,
        setAttribute() {},
        addEventListener() {},
        remove() {}
      };
    }
  };

  const notesById = new Map();
  const makeNote = (id, title, html) => ({
    id,
    isNote: () => true,
    isRegularItem: () => false,
    getNotes: () => [],
    getNoteTitle: () => title,
    getNote: () => html
  });
  const standalone = makeNote(1, "Same/Title", "<h2>Section</h2><p>Alpha...</p>");
  const childNote = makeNote(2, "Same/Title", "<p>Child note</p>");
  const subNote = makeNote(3, "Sub Note", "<p>Sub collection note</p>");
  notesById.set(1, standalone);
  notesById.set(2, childNote);
  notesById.set(3, subNote);

  const regularItem = {
    isNote: () => false,
    isRegularItem: () => true,
    getNotes: () => [2]
  };

  const subcollection = {
    id: 11,
    name: "Child Collection",
    getChildItems: () => [subNote]
  };

  const collection = {
    id: 10,
    name: "Main Collection",
    getChildItems: () => [standalone, regularItem]
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
    document,
    setTimeout(callback) {
      callback();
      return 1;
    },
    clearTimeout() {},
    ZoteroPane: {
      getSelectedCollection: () => collection
    }
  };

  const context = {
    console,
    Zotero: {
      debug() {},
      getMainWindows: () => [win],
      Items: { get: (id) => notesById.get(id) || null },
      Collections: { getByParent: (id) => (id === 10 ? [subcollection] : []) }
    },
    Services: {
      prompt: {
        alert: (_win, _title, message) => alerts.push(message),
        confirm: () => {
          confirms.push(true);
          return true;
        }
      }
    },
    ChromeUtils: {
      importESModule: () => ({ FilePicker })
    },
    IOUtils: {
      exists: async (target) => writes.some((entry) => entry.path === target),
      writeUTF8: async (target, content) => writes.push({ path: target, content })
    },
    PathUtils: { join: (...parts) => path.win32.join(...parts) }
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: "bootstrap.js" });

  await context.exportSelectedCollectionNotes(win);

  assert.strictEqual(confirms.length, 1);
  assert.strictEqual(writes.length, 3);
  assert.ok(writes[0].path.endsWith("Same-Title.md"));
  assert.ok(writes[1].path.endsWith("Same-Title_1.md"));
  assert.ok(writes[2].path.endsWith("Sub Note.md"));
  assert.ok(writes[0].content.includes("## Section"));
  assert.ok(writes[0].content.includes("**Bold**"));
  assert.ok(writes[0].content.includes("*Italic*"));
  assert.ok(writes[0].content.includes("[Link](https://example.com)"));
  assert.ok(writes[0].content.includes("- Bullet"));
  assert.ok(alerts.at(-1).includes("3/3"));

  console.log("collection export ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
