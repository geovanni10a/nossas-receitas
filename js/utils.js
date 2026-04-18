(function () {
  var MOTION_KEY = "nr_prefs_motion";
  var THEME_KEY = "nr_theme";
  var themeMediaQuery = null;
  var themeWatcherBound = false;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeColor(value, fallback) {
    var normalized = String(value || "").trim();
    var isHex = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized);
    return isHex ? normalized : (fallback || "#C4845A");
  }

  function safeImageSource(value, fallback) {
    var normalized = String(value || "").trim();

    if (!normalized) {
      return fallback || "assets/sem-foto.svg";
    }

    if (/^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,/i.test(normalized)) {
      return normalized;
    }

    if (/^(?:https?:)?\/\//i.test(normalized)) {
      return normalized;
    }

    if (/^(?:\.\/|\.\.\/|\/)?assets\//i.test(normalized) || /^[a-z0-9_\-./]+$/i.test(normalized)) {
      return normalized;
    }

    return fallback || "assets/sem-foto.svg";
  }

  function formatBytes(bytes) {
    var value = Number(bytes || 0);
    var units = ["B", "KB", "MB", "GB"];
    var unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }

    return value.toFixed(unitIndex === 0 ? 0 : 1) + " " + units[unitIndex];
  }

  function formatDateTime(isoString) {
    if (!isoString) {
      return "sem registro";
    }

    try {
      return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
      }).format(new Date(isoString));
    } catch (error) {
      return isoString;
    }
  }

  function formatRelativeTime(isoString) {
    if (!isoString) {
      return "ainda sem sincronizacao";
    }

    try {
      var now = Date.now();
      var target = new Date(isoString).getTime();
      var diffSeconds = Math.round((target - now) / 1000);
      var absSeconds = Math.abs(diffSeconds);
      var formatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

      if (absSeconds < 60) {
        return formatter.format(diffSeconds, "second");
      }

      if (absSeconds < 3600) {
        return formatter.format(Math.round(diffSeconds / 60), "minute");
      }

      if (absSeconds < 86400) {
        return formatter.format(Math.round(diffSeconds / 3600), "hour");
      }

      return formatter.format(Math.round(diffSeconds / 86400), "day");
    } catch (error) {
      return formatDateTime(isoString);
    }
  }

  function getMotionPreference() {
    var stored = window.localStorage.getItem(MOTION_KEY);
    return stored === "reduce" || stored === "full" ? stored : "auto";
  }

  function setMotionPreference(value) {
    var nextValue = value === "reduce" || value === "full" ? value : "auto";

    if (nextValue === "auto") {
      window.localStorage.removeItem(MOTION_KEY);
    } else {
      window.localStorage.setItem(MOTION_KEY, nextValue);
    }

    window.dispatchEvent(new CustomEvent("nr:motion-changed", {
      detail: { preference: getMotionPreference() }
    }));
  }

  function getMotionModeLabel(value) {
    if (value === "reduce") {
      return "Movimento reduzido";
    }

    if (value === "full") {
      return "Movimento completo";
    }

    return "Movimento automatico";
  }

  function shouldReduceMotion() {
    var preference = getMotionPreference();
    var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var reducedByMedia = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var deviceMemory = Number(navigator.deviceMemory || 0);
    var slowNetwork = connection && (connection.saveData || /(^|-)2g/.test(String(connection.effectiveType || "")));

    if (preference === "reduce") {
      return true;
    }

    if (preference === "full") {
      return false;
    }

    return reducedByMedia || Boolean(slowNetwork) || (deviceMemory > 0 && deviceMemory <= 4);
  }

  function cycleMotionPreference() {
    var current = getMotionPreference();
    var next = current === "auto" ? "reduce" : (current === "reduce" ? "full" : "auto");

    setMotionPreference(next);
    return next;
  }

  function getThemeMediaQuery() {
    if (!themeMediaQuery && typeof window.matchMedia === "function") {
      themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    }

    return themeMediaQuery;
  }

  function getThemePreference() {
    var stored = window.localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "dark" ? stored : "auto";
  }

  function getResolvedTheme(preference) {
    var currentPreference = preference === "light" || preference === "dark" ? preference : getThemePreference();
    var media = getThemeMediaQuery();

    if (currentPreference === "light" || currentPreference === "dark") {
      return currentPreference;
    }

    return media && media.matches ? "dark" : "light";
  }

  function emitThemeChanged(resolvedTheme) {
    window.dispatchEvent(new CustomEvent("nr:theme-changed", {
      detail: {
        preference: getThemePreference(),
        resolvedTheme: resolvedTheme || getResolvedTheme()
      }
    }));
  }

  function applyTheme(preference) {
    var root = document.documentElement;
    var currentPreference = preference === "light" || preference === "dark" ? preference : getThemePreference();
    var resolvedTheme = getResolvedTheme(currentPreference);

    if (root) {
      root.dataset.theme = resolvedTheme;
      root.dataset.themePreference = currentPreference;
      root.style.colorScheme = resolvedTheme;
    }

    return resolvedTheme;
  }

  function setThemePreference(value) {
    var nextValue = value === "light" || value === "dark" ? value : "auto";

    if (nextValue === "auto") {
      window.localStorage.removeItem(THEME_KEY);
    } else {
      window.localStorage.setItem(THEME_KEY, nextValue);
    }

    emitThemeChanged(applyTheme(nextValue));
  }

  function getThemeModeLabel(value) {
    if (value === "dark") {
      return "Tema escuro";
    }

    if (value === "light") {
      return "Tema claro";
    }

    return "Tema automatico";
  }

  function getThemeIconMode(preference, resolvedTheme) {
    var currentPreference = preference === "light" || preference === "dark" ? preference : getThemePreference();
    var currentResolvedTheme = resolvedTheme === "light" || resolvedTheme === "dark" ? resolvedTheme : getResolvedTheme(currentPreference);

    if (currentPreference === "auto") {
      return "auto";
    }

    return currentResolvedTheme;
  }

  function cycleThemePreference() {
    var current = getThemePreference();
    var next = current === "auto" ? "dark" : (current === "dark" ? "light" : "auto");

    setThemePreference(next);
    return next;
  }

  function bindThemeWatcher() {
    var media = getThemeMediaQuery();

    if (!media || themeWatcherBound) {
      return;
    }

    var onChange = function () {
      if (getThemePreference() === "auto") {
        emitThemeChanged(applyTheme("auto"));
      }
    };

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
    } else if (typeof media.addListener === "function") {
      media.addListener(onChange);
    }

    themeWatcherBound = true;
  }

  function sanitizeText(value, fallback) {
    var normalized = String(value || "").trim();
    return normalized || (fallback || "");
  }

  bindThemeWatcher();
  applyTheme();

  window.NRUtils = {
    escapeHtml: escapeHtml,
    sanitizeColor: sanitizeColor,
    safeImageSource: safeImageSource,
    formatBytes: formatBytes,
    formatDateTime: formatDateTime,
    formatRelativeTime: formatRelativeTime,
    getMotionPreference: getMotionPreference,
    setMotionPreference: setMotionPreference,
    getMotionModeLabel: getMotionModeLabel,
    shouldReduceMotion: shouldReduceMotion,
    cycleMotionPreference: cycleMotionPreference,
    getThemePreference: getThemePreference,
    getResolvedTheme: getResolvedTheme,
    applyTheme: applyTheme,
    setThemePreference: setThemePreference,
    getThemeModeLabel: getThemeModeLabel,
    getThemeIconMode: getThemeIconMode,
    cycleThemePreference: cycleThemePreference,
    sanitizeText: sanitizeText
  };
})();
