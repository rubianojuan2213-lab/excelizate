const dashboardTotals = document.getElementById("dashboardTotals");
const dashboardCourses = document.getElementById("dashboardCourses");
const authStatus = document.getElementById("authStatus");

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

    dashboardTotals.innerHTML = `
      <article class="dashboard-card"><h3>Clics CTA</h3><strong>${data.totals.ctaClicks}</strong></article>
      <article class="dashboard-card"><h3>Inicios de compra</h3><strong>${data.totals.started}</strong></article>
      <article class="dashboard-card"><h3>Vistas de pago</h3><strong>${data.totals.paymentViews}</strong></article>
      <article class="dashboard-card"><h3>Compras finalizadas</h3><strong>${data.totals.completed}</strong></article>
    `;

    const courseEntries = Object.entries(data.perCourse);

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
          <div class="dashboard-row"><span>Desistimientos</span><strong>${course.dropOff}</strong></div>
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
