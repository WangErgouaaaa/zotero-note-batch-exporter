const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

function loadPlugin(overrides = {}) {
  const source = fs.readFileSync(
    path.join(process.cwd(), "bootstrap.js"),
    "utf8"
  );

  const context = {
    console,
    Zotero: {
      debug() {},
      getMainWindows: () => overrides.mainWindows || [],
      Items: { get() {} },
      Collections: { getByParent() { return []; } }
    },
    Services: {
      prompt: {
        alert() {},
        confirm() { return false; }
      }
    },
    ChromeUtils: {
      importESModule() {
        throw new Error("not implemented");
      }
    },
    IOUtils: {
      async exists() { return false; },
      async writeUTF8() {}
    },
    PathUtils: {
      join: path.win32.join
    },
    ...overrides.context
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: "bootstrap.js" });
  return context;
}

function createWindowWithDelayedToolsPopup(appearOnAttempt) {
  let getCount = 0;
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

  const pendingTimers = [];
  const window = {
    setTimeout(callback) {
      pendingTimers.push(callback);
      return pendingTimers.length;
    },
    clearTimeout() {},
    document: {
      getElementById(id) {
        if (id === "menu_ToolsPopup") {
          getCount += 1;
          return getCount >= appearOnAttempt ? popup : null;
        }
        return nodes.get(id) || null;
      },
      createXULElement(tag) {
        return {
          tagName: tag,
          setAttribute() {},
          addEventListener() {},
          remove() {}
        };
      }
    }
  };

  return { window, popup, pendingTimers };
}

async function main() {
  const delayed = createWindowWithDelayedToolsPopup(2);
  const plugin = loadPlugin({ mainWindows: [delayed.window] });

  plugin.startup({ id: "x", version: "1", rootURI: "" }, 3);
  assert.strictEqual(delayed.popup.children.length, 0, "first attempt should not inject yet");

  while (delayed.pendingTimers.length) {
    const callback = delayed.pendingTimers.shift();
    callback();
  }

  assert.strictEqual(
    delayed.popup.children.length,
    3,
    "menu should be injected after a retry when Tools popup appears late"
  );
  assert.ok(
    delayed.window.document.getElementById("note-batch-exporter-menuitem"),
    "collection export menu should exist"
  );
  assert.ok(
    delayed.window.document.getElementById("note-batch-exporter-selected-menuitem"),
    "selected item export menu should exist"
  );
}

main().then(
  () => console.log("menu retry ok"),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
