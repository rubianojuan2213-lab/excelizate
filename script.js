document.body.classList.add("is-loading");

const navItems = document.querySelectorAll(".nav-item");
const navContainer = document.getElementById("mainNav");
const navToggle = document.getElementById("navToggle");
const preloader = document.getElementById("preloader");
const loadingTriggers = document.querySelectorAll("a[href]");
const searchInput = document.getElementById("courseSearchInput");
const searchResults = document.getElementById("searchResults");

const searchableCourses = [
  {
    key: "excel-basico",
    title: "Excel basico (desde cero)",
    description: "Ideal para comenzar con formulas, tablas, funciones y reportes.",
    href: "adquirir.html?curso=excel-basico"
  },
  {
    key: "excel-intermedio",
    title: "Excel intermedio",
    description: "Funciones utiles, analisis practico y trabajo con datos.",
    href: "adquirir.html?curso=excel-intermedio"
  },
  {
    key: "excel-avanzado",
    title: "Excel avanzado",
    description: "Dashboards, power query, macros, reportes y analisis avanzado.",
    href: "adquirir.html?curso=excel-avanzado"
  },
  {
    key: "contabilidad-basica",
    title: "Contabilidad basica",
    description: "Principios contables, registros, libro diario y estados financieros.",
    href: "adquirir.html?curso=contabilidad-basica"
  },
  {
    key: "siigo",
    title: "Manejo de programa Siigo",
    description: "Configuracion, compras, ventas, clientes, proveedores e inventarios.",
    href: "adquirir.html?curso=siigo"
  },
  {
    key: "clase-personalizada",
    title: "Clase personalizada",
    description: "Reserva una asesoria 1 a 1 con fecha y hora segun tu necesidad.",
    href: "adquirir.html?curso=clase-personalizada"
  }
];

function showLoader() {
  preloader?.classList.remove("is-hidden");
  document.body.classList.add("is-loading");
}

function hideLoader() {
  preloader?.classList.add("is-hidden");
  document.body.classList.remove("is-loading");
}

function trackMetric(eventType, payload = {}) {
  fetch("/api/metrics/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ eventType, ...payload })
  }).catch(() => {});
}

navItems.forEach((item) => {
  item.addEventListener("mouseenter", () => {
    navItems.forEach((link) => link.classList.remove("active"));
    item.classList.add("active");
  });
});

navContainer?.addEventListener("mouseleave", () => {
  navItems.forEach((link) => link.classList.remove("active"));
  navItems[0]?.classList.add("active");
});

navToggle?.addEventListener("click", () => {
  navContainer?.classList.toggle("is-open");
  navToggle.classList.toggle("is-open");
});

loadingTriggers.forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    const href = trigger.getAttribute("href");

    if (!href) {
      return;
    }

    if (trigger.classList.contains("course-action")) {
      const courseKey = new URL(href, window.location.origin).searchParams.get("curso") || "general";
      trackMetric("course_cta_click", { courseKey, source: "homepage" });
    }

    showLoader();

    if (href.startsWith("#")) {
      event.preventDefault();

      window.setTimeout(() => {
        const target = document.querySelector(href);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
        hideLoader();
        navContainer?.classList.remove("is-open");
        navToggle?.classList.remove("is-open");
      }, 500);

      return;
    }

    window.setTimeout(() => {
      hideLoader();
    }, 700);
  });
});

searchInput?.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();

  if (!query) {
    searchResults?.classList.add("hidden");
    if (searchResults) searchResults.innerHTML = "";
    return;
  }

  const matches = searchableCourses.filter((course) =>
    course.title.toLowerCase().includes(query) ||
    course.description.toLowerCase().includes(query)
  );

  if (!matches.length) {
    if (searchResults) {
      searchResults.innerHTML = `<div class="search-item"><strong>Sin coincidencias</strong><p>No encontramos cursos con ese texto.</p></div>`;
      searchResults.classList.remove("hidden");
    }
    return;
  }

  if (searchResults) {
    searchResults.innerHTML = matches.map((course) => `
      <a class="search-item" href="${course.href}" data-course-key="${course.key}">
        <strong>${course.title}</strong>
        <p>${course.description}</p>
        <span class="course-action">Adquirir ahora</span>
      </a>
    `).join("");
    searchResults.classList.remove("hidden");
  }
});

document.addEventListener("click", (event) => {
  const clickedInsideSearch = event.target instanceof Element &&
    (event.target.closest(".search-shell") || event.target.closest(".search-results"));

  if (!clickedInsideSearch) {
    searchResults?.classList.add("hidden");
  }
});

window.addEventListener("load", () => {
  window.setTimeout(() => {
    hideLoader();
  }, 1000);
});
