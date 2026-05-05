let gaReady = false;
let gaMeasurementId = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.async = true;
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(el);
  });
}

function safeString(value, max = 100) {
  return String(value ?? "")
    .slice(0, max)
    .replace(/[^\w\-./@ ]/g, "");
}

async function initGa() {
  try {
    const resp = await fetch("/api/config");
    const cfg = await resp.json();
    gaMeasurementId = cfg.gaMeasurementId || null;

    // Exponemos para debug rápido en producción
    window.__excelizateAnalytics = {
      gaMeasurementId,
      lookerDashboardUrl: cfg.lookerDashboardUrl || null
    };

    if (!gaMeasurementId) {
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };

    await loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`);
    window.gtag("js", new Date());
    window.gtag("config", gaMeasurementId, {
      send_page_view: true
    });

    gaReady = true;
  } catch (_e) {
    // no-op: analytics nunca debe romper la web
  }
}

window.trackAnalyticsEvent = function trackAnalyticsEvent(name, params = {}) {
  if (!gaReady || typeof window.gtag !== "function") return;

  const cleaned = {
    page_path: safeString(window.location.pathname, 80),
    ...Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, typeof v === "string" ? safeString(v) : v])
    )
  };

  window.gtag("event", safeString(name, 40), cleaned);
};

initGa();

