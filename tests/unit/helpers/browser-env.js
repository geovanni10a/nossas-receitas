const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const { TextEncoder, TextDecoder } = require("util");

const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");

function createMatchMedia(defaultMatches) {
  return function matchMedia(query) {
    return {
      matches: typeof defaultMatches === "function" ? Boolean(defaultMatches(query)) : Boolean(defaultMatches),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      }
    };
  };
}

function defineNavigatorValue(window, key, value) {
  Object.defineProperty(window.navigator, key, {
    configurable: true,
    get() {
      return typeof value === "function" ? value() : value;
    }
  });
}

function createBrowserEnv(options) {
  const config = options || {};
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: config.url || "https://geovanni10a.github.io/nossas-receitas/livro.html",
    pretendToBeVisual: true,
    runScripts: "outside-only"
  });
  const { window } = dom;

  window.console = console;
  window.TextEncoder = TextEncoder;
  window.TextDecoder = TextDecoder;
  window.Blob = globalThis.Blob;
  window.Headers = globalThis.Headers;
  window.Request = globalThis.Request;
  window.Response = globalThis.Response;
  window.fetch = config.fetch || (async function () {
    throw new Error("Unexpected fetch call in test.");
  });
  window.matchMedia = config.matchMedia || createMatchMedia(false);

  defineNavigatorValue(window, "onLine", typeof config.online === "boolean" ? config.online : true);
  defineNavigatorValue(window, "deviceMemory", typeof config.deviceMemory === "number" ? config.deviceMemory : 8);

  if (config.connection) {
    defineNavigatorValue(window, "connection", config.connection);
    defineNavigatorValue(window, "mozConnection", config.connection);
    defineNavigatorValue(window, "webkitConnection", config.connection);
  }

  return {
    dom,
    window,
    loadScript(relativePath) {
      const absolutePath = path.resolve(ROOT_DIR, relativePath);
      const source = fs.readFileSync(absolutePath, "utf8");
      window.eval(`${source}\n//# sourceURL=${relativePath.replace(/\\/g, "/")}`);
      return window;
    },
    loadScripts(relativePaths) {
      relativePaths.forEach((relativePath) => {
        this.loadScript(relativePath);
      });
      return window;
    },
    close() {
      window.close();
    }
  };
}

module.exports = {
  createBrowserEnv
};
