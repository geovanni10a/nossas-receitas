(function () {
  var MOTION_KEY = "nr_prefs_motion";

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

  function sanitizeText(value, fallback) {
    var normalized = String(value || "").trim();
    return normalized || (fallback || "");
  }

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
    sanitizeText: sanitizeText
  };
})();
