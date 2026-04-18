(function () {
  function logDiagnostic(entry) {
    if (window.NRDiagnostics) {
      window.NRDiagnostics.log(entry);
    }
  }

  function canRegisterServiceWorker() {
    return "serviceWorker" in navigator
      && window.isSecureContext !== false
      && window.location.protocol !== "file:";
  }

  function registerServiceWorker() {
    if (!canRegisterServiceWorker()) {
      return;
    }

    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js")
        .then(function (registration) {
          logDiagnostic({
            source: "pwa",
            kind: "install",
            status: "success",
            message: "Service worker registrado com sucesso.",
            details: registration.scope
          });
        })
        .catch(function (error) {
          logDiagnostic({
            source: "pwa",
            kind: "install",
            status: "error",
            message: "Nao foi possivel registrar o service worker.",
            details: error && error.message ? error.message : ""
          });
        });
    });
  }

  registerServiceWorker();
})();
