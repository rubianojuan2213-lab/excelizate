const dashboardTotals = document.getElementById("dashboardTotals");
const dashboardButtons = document.getElementById("dashboardButtons");
const dashboardPages = document.getElementById("dashboardPages");
const dashboardCourses = document.getElementById("dashboardCourses");
const dashboardFunnel = document.getElementById("dashboardFunnel");
const dashboardTrend = document.getElementById("dashboardTrend");
const authStatus = document.getElementById("authStatus");

function formatPct(value) {
  const safe = Number(value);
  if (!Number.isFinite(safe)) return "0%";
  return `${Math.round(safe * 100)}%`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderBars(container, entries, options = {}) {
  if (!container) return;
  const limit = options.limit ?? 10;
  const sliced = entries.slice(0, limit);
  const max = sliced.reduce((acc, [, v]) => Math.max(acc, Number(v) || 0), 0) || 1;

  if (!sliced.length) {
    container.innerHTML = `<p class="payment-note">Sin datos aun.</p>`;
    return;
  }

  container.innerHTML = sliced.map(([key, value]) => {
    const pct = Math.round(((Number(value) || 0) / max) * 100);
    return `
      <div class="bar-row">
        <div class="bar-row__meta">
          <strong title="${escapeHtml(key)}">${escapeHtml(key)}</strong>
          <span>${Number(value) || 0}</span>
        </div>
        <div class="bar-track" aria-hidden="true">
          <div class="bar-fill" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

function renderFunnel(container, funnel) {
  if (!container) return;
  const steps = funnel?.steps || [];
  if (!steps.length) {
    container.innerHTML = `<p class="payment-note">Sin datos de embudo.</p>`;
    return;
  }

  container.innerHTML = steps.map((step, index) => {
    const prev = index === 0 ? step.value : steps[index - 1].value;
    const drop = Math.max((prev || 0) - (step.value || 0), 0);
    return `
      <div class="funnel-step">
        <div class="funnel-step__left">
          <strong>${escapeHtml(step.label)}</strong>
          <span>${step.value || 0}</span>
        </div>
        <div class="funnel-step__right">
          <span class="pill">${index === 0 ? "Base" : `${formatPct(step.rateFromPrev)} vs etapa anterior`}</span>
          ${index === 0 ? "" : `<span class="muted">Desisten: ${drop}</span>`}
        </div>
      </div>
    `;
  }).join("");
}

function renderTrend(container, byDay) {
  if (!container) return;
  const data = Array.isArray(byDay) ? byDay.slice(-14) : [];
  if (!data.length) {
    container.innerHTML = `<p class="payment-note">Sin datos por dia aun.</p>`;
    return;
  }

  const max = data.reduce((acc, item) => Math.max(acc, item.paymentViews || 0, item.completed || 0), 0) || 1;
  container.innerHTML = `
    <div class="trend-legend">
      <span><i class="dot dot--a"></i> Vistas pago</span>
      <span><i class="dot dot--b"></i> Finalizadas</span>
    </div>
    <div class="trend-grid">
      ${data.map((item) => {
        const payH = Math.round(((item.paymentViews || 0) / max) * 100);
        const compH = Math.round(((item.completed || 0) / max) * 100);
        const label = item.date?.slice(5) || "";
        return `
          <div class="trend-col" title="${escapeHtml(item.date)}">
            <div class="trend-bars">
              <div class="trend-bar trend-bar--a" style="height:${payH}%"></div>
              <div class="trend-bar trend-bar--b" style="height:${compH}%"></div>
            </div>
            <div class="trend-label">${escapeHtml(label)}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

async function loadDashboard() {
  if (!window.currentUser) {
    return;
  }

  try {
    const response = await fetch("/api/admin/dashboard", {
      headers: {
        ...window.getAuthHeaders()
      }
    });

    const data = await response.json();

    if (!response.ok) {
      authStatus.textContent = data.error || "No tienes acceso al dashboard.";
      return;
    }

    const conversion = data.totals.started ? data.totals.completed / data.totals.started : 0;
    const paymentConversion = data.totals.paymentViews ? data.totals.completed / data.totals.paymentViews : 0;

    dashboardTotals.innerHTML = `
      <article class="dashboard-card"><h3>Clics CTA</h3><strong>${data.totals.ctaClicks}</strong><span class="kpi-note">Desde landing</span></article>
      <article class="dashboard-card"><h3>Formulario (adquirir)</h3><strong>${data.totals.started}</strong><span class="kpi-note">Inicios de compra</span></article>
      <article class="dashboard-card"><h3>Vista pago</h3><strong>${data.totals.paymentViews}</strong><span class="kpi-note">Pasa a Nequi</span></article>
      <article class="dashboard-card"><h3>Finalizadas</h3><strong>${data.totals.completed}</strong><span class="kpi-note">Comprobante subido</span></article>
      <article class="dashboard-card dashboard-card--accent"><h3>Conversion</h3><strong>${formatPct(conversion)}</strong><span class="kpi-note">Finalizadas / Formulario</span></article>
      <article class="dashboard-card"><h3>Conv. desde pago</h3><strong>${formatPct(paymentConversion)}</strong><span class="kpi-note">Finalizadas / Vista pago</span></article>
    `;

    const buttonEntries = Object.entries(data.perButton || {}).sort((a, b) => b[1] - a[1]);
    const pageEntries = Object.entries(data.perPage || {}).sort((a, b) => b[1] - a[1]);
    const courseEntries = Object.entries(data.perCourse || {}).sort((a, b) => (b[1].completed || 0) - (a[1].completed || 0));

    renderBars(dashboardButtons, buttonEntries, { limit: 12 });
    renderBars(dashboardPages, pageEntries, { limit: 12 });
    renderFunnel(dashboardFunnel, data.funnel);
    renderTrend(dashboardTrend, data.byDay);

    if (!courseEntries.length) {
      dashboardCourses.innerHTML = `<article class="dashboard-course-card"><h3>Sin datos aun</h3><p>No hay metricas registradas por curso.</p></article>`;
      return;
    }

    dashboardCourses.innerHTML = courseEntries.map(([courseKey, course]) => `
      <article class="dashboard-course-card">
        <h3>${courseKey}</h3>
        <div class="dashboard-list">
          <div class="dashboard-row"><span>Clics</span><strong>${course.clicks}</strong></div>
          <div class="dashboard-row"><span>Inicios</span><strong>${course.started}</strong></div>
          <div class="dashboard-row"><span>Pagos vistos</span><strong>${course.paymentViews}</strong></div>
          <div class="dashboard-row"><span>Finalizadas</span><strong>${course.completed}</strong></div>
          <div class="dashboard-row"><span>Conv. formulario</span><strong>${formatPct(course.conversion || 0)}</strong></div>
          <div class="dashboard-row"><span>Conv. desde pago</span><strong>${formatPct(course.paymentConversion || 0)}</strong></div>
        </div>
      </article>
    `).join("");
  } catch (_error) {
    authStatus.textContent = "No se pudo cargar el dashboard.";
  }
}

document.addEventListener("auth:changed", (event) => {
  if (!event.detail?.isAdmin) {
    authStatus.textContent = "Tu cuenta no tiene acceso como administrador.";
    return;
  }

  loadDashboard();
});
