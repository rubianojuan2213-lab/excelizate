const kpiGrid = document.getElementById("dashboardTotals");
const authStatus = document.getElementById("authStatus");
const dashboardStatus = document.getElementById("dashboardStatus");

const DASHBOARD_JS_BUILD = "2026-05-05-05";

if (dashboardStatus) {
  dashboardStatus.textContent = `Dashboard JS: ${DASHBOARD_JS_BUILD}`;
}


// Colores vibrantes para el dashboard
const COLORS = {
  primary: "#2563eb",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  secondary: "#8b5cf6",
  light: "#f3f4f6",
  text: "#1f2937"
};

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#6366f1"
];

let charts = {};

function formatPct(value) {
  const safe = Number(value);
  if (!Number.isFinite(safe)) return "0%";
  return `${Math.round(safe * 100)}%`;
}

function renderKPICards(container, totals) {
  if (!container) return;
  
  const conversion = totals.started ? totals.completed / totals.started : 0;
  const paymentConversion = totals.paymentViews ? totals.completed / totals.paymentViews : 0;
  const dropoffRate = totals.started ? (totals.started - totals.completed) / totals.started : 0;

  container.innerHTML = `
    <div class="kpi-card kpi-card--blue">
      <div class="kpi-card__icon">📊</div>
      <div class="kpi-card__content">
        <p class="kpi-card__label">Clics CTA</p>
        <h3 class="kpi-card__value">${totals.ctaClicks}</h3>
        <span class="kpi-card__note">Desde landing</span>
      </div>
    </div>

    <div class="kpi-card kpi-card--green">
      <div class="kpi-card__icon">📝</div>
      <div class="kpi-card__content">
        <p class="kpi-card__label">Inicios de compra</p>
        <h3 class="kpi-card__value">${totals.started}</h3>
        <span class="kpi-card__note">Formulario rellenado</span>
      </div>
    </div>

    <div class="kpi-card kpi-card--orange">
      <div class="kpi-card__icon">💳</div>
      <div class="kpi-card__content">
        <p class="kpi-card__label">Vistas de pago</p>
        <h3 class="kpi-card__value">${totals.paymentViews}</h3>
        <span class="kpi-card__note">Llegaron a Nequi</span>
      </div>
    </div>

    <div class="kpi-card kpi-card--purple">
      <div class="kpi-card__icon">✅</div>
      <div class="kpi-card__content">
        <p class="kpi-card__label">Compras finalizadas</p>
        <h3 class="kpi-card__value">${totals.completed}</h3>
        <span class="kpi-card__note">Comprobante subido</span>
      </div>
    </div>

    <div class="kpi-card kpi-card--red">
      <div class="kpi-card__icon">📉</div>
      <div class="kpi-card__content">
        <p class="kpi-card__label">Tasa conversión</p>
        <h3 class="kpi-card__value">${formatPct(conversion)}</h3>
        <span class="kpi-card__note">Finalizadas/Formulario</span>
      </div>
    </div>

    <div class="kpi-card kpi-card--teal">
      <div class="kpi-card__icon">💰</div>
      <div class="kpi-card__content">
        <p class="kpi-card__label">Deserción</p>
        <h3 class="kpi-card__value">${formatPct(dropoffRate)}</h3>
        <span class="kpi-card__note">Que no completaron</span>
      </div>
    </div>
  `;
}

function renderFunnelChart(data) {
  if (typeof Chart === 'undefined') return;
  
  const ctx = document.getElementById("funnelChart");
  if (!ctx) return;

  const steps = data.funnel?.steps || [];
  const labels = steps.map(s => s.label);
  const values = steps.map(s => s.value);

  if (charts.funnel) {
    try { charts.funnel.destroy(); } catch(e) {}
  }

  try {
    charts.funnel = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Usuarios",
          data: values,
          backgroundColor: [
            "rgba(59, 130, 246, 0.8)",
            "rgba(16, 185, 129, 0.8)",
            "rgba(245, 158, 11, 0.8)",
            "rgba(239, 68, 68, 0.8)"
          ],
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  } catch(e) {
    console.error('Error renderizando chart embudo:', e);
  }
}

function renderTrendChart(byDay) {
  if (typeof Chart === 'undefined') return;
  
  const ctx = document.getElementById("trendChart");
  if (!ctx) return;

  const data = Array.isArray(byDay) ? byDay.slice(-14) : [];
  const labels = data.map(d => d.date?.slice(5) || "");
  const paymentViews = data.map(d => d.paymentViews || 0);
  const completed = data.map(d => d.completed || 0);

  if (charts.trend) {
    try { charts.trend.destroy(); } catch(e) {}
  }

  try {
    charts.trend = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Vistas de pago",
            data: paymentViews,
            borderColor: "rgba(59, 130, 246, 1)",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            fill: true,
            tension: 0.4,
            borderWidth: 2
          },
          {
            label: "Compras finalizadas",
            data: completed,
            borderColor: "rgba(16, 185, 129, 1)",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            fill: true,
            tension: 0.4,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top" }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  } catch(e) {
    console.error('Error renderizando chart tendencia:', e);
  }
}

function renderButtonsChart(perButton) {
  if (typeof Chart === 'undefined') return;
  
  const ctx = document.getElementById("buttonsChart");
  if (!ctx) return;

  const entries = Object.entries(perButton || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  
  const labels = entries.map(e => e[0]);
  const values = entries.map(e => e[1]);

  if (charts.buttons) {
    try { charts.buttons.destroy(); } catch(e) {}
  }

  try {
    charts.buttons = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: CHART_COLORS,
          borderColor: "#fff",
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right" }
        }
      }
    });
  } catch(e) {
    console.error('Error renderizando chart botones:', e);
  }
}

function renderCoursesChart(perCourse) {
  if (typeof Chart === 'undefined') return;
  
  const ctx = document.getElementById("coursesChart");
  if (!ctx) return;

  const entries = Object.entries(perCourse || {})
    .map(([key, data]) => [key, data.clicks || 0])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  
  const labels = entries.map(e => e[0]);
  const values = entries.map(e => e[1]);

  if (charts.courses) {
    try { charts.courses.destroy(); } catch(e) {}
  }

  try {
    charts.courses = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Clics",
          data: values,
          backgroundColor: "rgba(139, 92, 246, 0.8)",
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } }
      }
    });
  } catch(e) {
    console.error('Error renderizando chart cursos:', e);
  }
}

function renderDropoffsChart(funnel, perCourse) {
  if (typeof Chart === 'undefined') return;
  
  const ctx = document.getElementById("dropoffsChart");
  if (!ctx) return;

  const dropoffData = [];
  const steps = funnel?.steps || [];
  
  steps.forEach((step, index) => {
    const prev = index === 0 ? step.value : steps[index - 1].value;
    const drop = Math.max((prev || 0) - (step.value || 0), 0);
    if (drop > 0) {
      dropoffData.push([`${step.label} → Salida`, drop]);
    }
  });

  const sorted = dropoffData.sort((a, b) => b[1] - a[1]).slice(0, 5);
  const labels = sorted.map(d => d[0]);
  const values = sorted.map(d => d[1]);

  if (charts.dropoffs) {
    try { charts.dropoffs.destroy(); } catch(e) {}
  }

  try {
    charts.dropoffs = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Deserciones",
          data: values,
          backgroundColor: "rgba(239, 68, 68, 0.8)",
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } }
      }
    });
  } catch(e) {
    console.error('Error renderizando chart deserciones:', e);
  }
}

function renderConversionChart(funnel) {
  if (typeof Chart === 'undefined') return;
  
  const ctx = document.getElementById("conversionChart");
  if (!ctx) return;

  const steps = funnel?.steps || [];
  const labels = steps.map(s => s.label);
  const conversions = steps.map(s => Math.round((s.rateFromPrev || 0) * 100));

  if (charts.conversion) {
    try { charts.conversion.destroy(); } catch(e) {}
  }

  try {
    charts.conversion = new Chart(ctx, {
      type: "radar",
      data: {
        labels,
        datasets: [{
          label: "Tasa de conversión (%)",
          data: conversions,
          borderColor: "rgba(16, 185, 129, 1)",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          borderWidth: 2,
          fill: true,
          pointBackgroundColor: "rgba(16, 185, 129, 1)",
          pointBorderColor: "#fff",
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "top" } },
        scales: {
          r: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });
  } catch(e) {
    console.error('Error renderizando chart conversion:', e);
  }
}

async function loadDashboard() {
  try {
    if (dashboardStatus) dashboardStatus.textContent = "Cargando metricas...";

    if (typeof window.getAuthHeaders !== "function") {
      if (dashboardStatus) dashboardStatus.textContent = "No se cargo auth.js (sin sesion).";
      if (authStatus) authStatus.textContent = "No se cargo el modulo de autenticacion.";
      return;
    }

    const headers = window.getAuthHeaders();
    if (!headers?.Authorization) {
      if (dashboardStatus) {
        dashboardStatus.textContent = "No hay sesion activa. Inicia sesion con Google y recarga (Ctrl+F5).";
      }
      return;
    }

    // Esperar a que Chart.js esté disponible
    let chartReady = false;
    for (let i = 0; i < 50; i++) {
      if (typeof Chart !== 'undefined') {
        chartReady = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const response = await fetch("/api/admin/dashboard", {
      headers: {
        ...headers
      }
    });

    const data = await response.json();

    if (!response.ok) {
      authStatus.textContent = data.error || "No tienes acceso al dashboard.";
      if (dashboardStatus) dashboardStatus.textContent = data.error || "No tienes acceso al dashboard.";
      return;
    }

    // Render KPI Cards
    renderKPICards(kpiGrid, data.totals);

    // Esperar un pequeño delay para que el DOM esté listo
    await new Promise(resolve => setTimeout(resolve, 200));

    // Render Charts - solo si Chart está disponible
    if (chartReady || typeof Chart !== 'undefined') {
      renderFunnelChart(data);
      renderTrendChart(data.byDay);
      renderButtonsChart(data.perButton);
      renderCoursesChart(data.perCourse);
      renderDropoffsChart(data.funnel, data.perCourse);
      renderConversionChart(data.funnel);
    }

    if (dashboardStatus) dashboardStatus.textContent = "Metricas actualizadas ✓";
  } catch (_error) {
    console.error("Error cargando dashboard:", _error);
    authStatus.textContent = "No se pudo cargar el dashboard.";
    if (dashboardStatus) dashboardStatus.textContent = "No se pudo cargar el dashboard (API no responde).";
  }
}

document.addEventListener("auth:changed", (event) => {
  if (!event.detail?.isAdmin) {
    authStatus.textContent = "Tu cuenta no tiene acceso como administrador.";
    if (dashboardStatus) dashboardStatus.textContent = "Tu cuenta no tiene acceso como administrador.";
    return;
  }

  loadDashboard();
});

window.addEventListener("load", () => {
  const start = Date.now();
  const timer = window.setInterval(() => {
    if (typeof window.getAuthHeaders === "function") {
      const headers = window.getAuthHeaders();
      if (headers?.Authorization) {
        window.clearInterval(timer);
        loadDashboard();
        return;
      }
    }

    if (Date.now() - start > 5500) {
      window.clearInterval(timer);
      if (dashboardStatus) {
        dashboardStatus.textContent =
          "No se detecto sesion aun. Si acabas de iniciar sesion, recarga la pagina (Ctrl+F5).";
      }
    }
  }, 250);
});
