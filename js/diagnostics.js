(function () {
  var KEY = "nr_log";
  var MAX_BYTES = 50 * 1024;
  var MAX_ITEMS = 120;

  function safeParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function normalizeEntry(entry) {
    var source = entry || {};

    return {
      at: source.at || new Date().toISOString(),
      kind: String(source.kind || "info"),
      status: String(source.status || "info"),
      source: String(source.source || "app"),
      message: String(source.message || "Evento registrado"),
      details: String(source.details || "")
    };
  }

  function readEntries() {
    var entries = safeParse(window.localStorage.getItem(KEY), []);

    return Array.isArray(entries)
      ? entries.map(normalizeEntry)
      : [];
  }

  function dispatchChange() {
    window.dispatchEvent(new CustomEvent("nr:diagnostics-changed", {
      detail: {
        total: readEntries().length
      }
    }));
  }

  function persistEntries(entries) {
    var next = entries.slice(0, MAX_ITEMS);

    while (next.length && new Blob([JSON.stringify(next)]).size > MAX_BYTES) {
      next.pop();
    }

    window.localStorage.setItem(KEY, JSON.stringify(next));
    dispatchChange();
  }

  function log(entry) {
    var next = [normalizeEntry(entry)].concat(readEntries());
    persistEntries(next);
    return next[0];
  }

  function getEntries(limit) {
    var entries = readEntries();
    return typeof limit === "number" ? entries.slice(0, limit) : entries;
  }

  function clear() {
    window.localStorage.removeItem(KEY);
    dispatchChange();
  }

  function exportText() {
    return getEntries().map(function (entry) {
      var parts = [
        "[" + entry.at + "]",
        entry.source + "/" + entry.kind + "/" + entry.status,
        entry.message
      ];

      if (entry.details) {
        parts.push(entry.details);
      }

      return parts.join(" | ");
    }).join("\n");
  }

  window.NRDiagnostics = {
    log: log,
    getEntries: getEntries,
    clear: clear,
    exportText: exportText,
    MAX_BYTES: MAX_BYTES
  };
})();
