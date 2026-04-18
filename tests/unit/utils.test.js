const { createBrowserEnv } = require("./helpers/browser-env");

describe("NRUtils", () => {
  let env;
  let utils;

  beforeEach(() => {
    env = createBrowserEnv();
    env.loadScript("js/utils.js");
    utils = env.window.NRUtils;
  });

  afterEach(() => {
    env.close();
  });

  it("escapa HTML perigoso", () => {
    expect(utils.escapeHtml('<img src=x onerror="alert(1)">')).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("aceita apenas cores hexadecimais validas", () => {
    expect(utils.sanitizeColor("#A0522D", "#000000")).toBe("#A0522D");
    expect(utils.sanitizeColor("javascript:alert(1)", "#000000")).toBe("#000000");
  });

  it("bloqueia origens de imagem inseguras", () => {
    expect(utils.safeImageSource("javascript:alert(1)", "assets/fallback.svg")).toBe("assets/fallback.svg");
    expect(utils.safeImageSource("assets/foto.jpg")).toBe("assets/foto.jpg");
  });

  it("formata bytes em unidades humanas", () => {
    expect(utils.formatBytes(999)).toBe("999 B");
    expect(utils.formatBytes(1536)).toBe("1.5 KB");
  });

  it("persiste e cicla a preferencia de movimento", () => {
    expect(utils.getMotionPreference()).toBe("auto");
    expect(utils.cycleMotionPreference()).toBe("reduce");
    expect(utils.getMotionPreference()).toBe("reduce");
    expect(utils.cycleMotionPreference()).toBe("full");
    expect(utils.cycleMotionPreference()).toBe("auto");
    expect(utils.getMotionPreference()).toBe("auto");
  });

  it("reduz movimento por preferencia explicita ou heuristica do dispositivo", () => {
    expect(utils.shouldReduceMotion()).toBe(false);

    utils.setMotionPreference("reduce");
    expect(utils.shouldReduceMotion()).toBe(true);

    utils.setMotionPreference("auto");
    Object.defineProperty(env.window.navigator, "deviceMemory", {
      configurable: true,
      get() {
        return 2;
      }
    });
    expect(utils.shouldReduceMotion()).toBe(true);
  });
});
