(function () {
  function badgeCopy(status) {
    var state = status && status.state ? status.state : "carregando";

    if (state === "sincronizado") {
      return {
        label: "Sincronizado",
        detail: status.lastSyncAt ? "Ultima sync " + window.NRUtils.formatRelativeTime(status.lastSyncAt) : "Dados atualizados",
        tone: "ok"
      };
    }

    if (state === "offline") {
      return {
        label: "Offline",
        detail: status.lastSyncAt ? "Mostrando ultima sync " + window.NRUtils.formatRelativeTime(status.lastSyncAt) : "Sem conexao no momento",
        tone: "offline"
      };
    }

    if (state === "erro") {
      return {
        label: "Erro de sync",
        detail: status.message || "Nao foi possivel falar com o Supabase",
        tone: "erro"
      };
    }

    return {
      label: "Carregando",
      detail: status.message || "Sincronizando com o Supabase...",
      tone: "warning"
    };
  }

  function render(container, status, options) {
    var wrapper = document.createElement("div");
    var badge = document.createElement("button");
    var detail = document.createElement("span");
    var refresh = document.createElement("button");
    var copy = badgeCopy(status);
    var titleParts = [copy.label];

    if (status && status.lastSyncAt) {
      titleParts.push("Ultima sync: " + window.NRUtils.formatDateTime(status.lastSyncAt));
    }

    if (status && status.message) {
      titleParts.push(status.message);
    }

    wrapper.className = "sync-status";

    badge.className = "sync-badge sync-badge--" + copy.tone;
    badge.type = "button";
    badge.textContent = copy.label;
    badge.title = titleParts.join(" | ");
    badge.setAttribute("aria-label", badge.title);

    detail.className = "sync-status__detail";
    detail.textContent = copy.detail;

    wrapper.appendChild(badge);
    wrapper.appendChild(detail);

    if (options && options.showRefresh) {
      refresh.className = "botao-secundario botao-utilitario";
      refresh.type = "button";
      refresh.textContent = "Atualizar agora";
      refresh.addEventListener("click", async function () {
        refresh.disabled = true;
        refresh.textContent = "Atualizando...";

        try {
          await window.NRStorage.refreshSync();
        } finally {
          refresh.disabled = false;
          refresh.textContent = "Atualizar agora";
        }
      });
      wrapper.appendChild(refresh);
    }

    container.replaceChildren(wrapper);
  }

  function mount(container, options) {
    if (!container || !window.NRStorage) {
      return function () {};
    }

    var update = function () {
      render(container, window.NRStorage.getSyncStatus(), options);
    };

    window.addEventListener("nr:sync-changed", update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();

    return update;
  }

  function mountMotionToggle(button) {
    if (!button || !window.NRUtils) {
      return function () {};
    }

    var update = function () {
      button.textContent = window.NRUtils.getMotionModeLabel(window.NRUtils.getMotionPreference());
    };

    button.addEventListener("click", function () {
      window.NRUtils.cycleMotionPreference();
      update();
    });

    window.addEventListener("nr:motion-changed", update);
    update();

    return update;
  }

  function mountThemeToggle(button) {
    if (!button || !window.NRUtils) {
      return function () {};
    }

    var update = function () {
      var preference = window.NRUtils.getThemePreference();
      var resolvedTheme = window.NRUtils.getResolvedTheme(preference);
      var label = window.NRUtils.getThemeModeLabel(preference);
      var detail = preference === "auto"
        ? label + " (seguindo " + (resolvedTheme === "dark" ? "escuro" : "claro") + " do sistema)"
        : label;

      button.textContent = label;
      button.dataset.themeIcon = window.NRUtils.getThemeIconMode(preference, resolvedTheme);
      button.title = detail;
      button.setAttribute("aria-label", detail);
    };

    button.addEventListener("click", function () {
      window.NRUtils.cycleThemePreference();
      update();
    });

    window.addEventListener("nr:theme-changed", update);
    update();

    return update;
  }

  window.NRSyncStatus = {
    mount: mount,
    mountMotionToggle: mountMotionToggle,
    mountThemeToggle: mountThemeToggle
  };
})();
