document.body.classList.add("is-loading");

const navItems = document.querySelectorAll(".nav-item");
const navContainer = document.getElementById("mainNav");
const navToggle = document.getElementById("navToggle");
const preloader = document.getElementById("preloader");
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

function sendMetricEvent(data) {
  const payload = JSON.stringify(data);

  if (navigator.sendBeacon) {
    try {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/metrics/track", blob);
      return;
    } catch (_error) {
      // Fall back to fetch si sendBeacon falla.
    }
  }

  fetch("/api/metrics/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    keepalive: true,
    body: payload
  }).catch(() => {});
}

function trackMetric(eventType, payload = {}) {
  const data = { eventType, ...payload };
  sendMetricEvent(data);

  if (typeof window.trackAnalyticsEvent === "function") {
    window.trackAnalyticsEvent(eventType, payload);
  }
}

function normalizeButtonKey(element) {
  const explicit = element.getAttribute("data-track-key");
  if (explicit) {
    return explicit;
  }

  const label = (
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    element.textContent ||
    ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 64);

  return label || "boton-sin-etiqueta";
}

function isInternalSectionLink(href) {
  return typeof href === "string" && href.startsWith("#");
}

function closeNavMenu() {
  navContainer?.classList.remove("is-open");
  navToggle?.classList.remove("is-open");

  if (navToggle) {
    navToggle.setAttribute("aria-expanded", "false");
  }
}

function trackCourseCta(control, href) {
  const absoluteUrl = new URL(href, window.location.origin);
  const courseKey = control.getAttribute("data-course-key") ||
    absoluteUrl.searchParams.get("curso") ||
    "general";

  trackMetric("course_cta_click", {
    courseKey,
    source: window.location.pathname || "/"
  });
}

function renderSearchResults(matches) {
  if (!searchResults) {
    return;
  }

  if (!matches.length) {
    searchResults.innerHTML = `
      <div class="search-item">
        <strong>Sin coincidencias</strong>
        <p>No encontramos cursos con ese texto.</p>
      </div>
    `;
    searchResults.classList.remove("hidden");
    return;
  }

  searchResults.innerHTML = matches.map((course) => `
    <a
      class="search-item"
      href="${course.href}"
      data-course-key="${course.key}"
      data-track-key="buscar-${course.key}"
    >
      <strong>${course.title}</strong>
      <p>${course.description}</p>
      <span class="course-action">Adquirir ahora</span>
    </a>
  `).join("");

  searchResults.classList.remove("hidden");
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
  const isOpen = navContainer?.classList.toggle("is-open");
  navToggle.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(Boolean(isOpen)));

  trackMetric("button_click", {
    buttonKey: isOpen ? "menu-hamburguesa-abrir" : "menu-hamburguesa-cerrar",
    source: window.location.pathname || "/"
  });
});

searchInput?.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();

  if (!query) {
    searchResults?.classList.add("hidden");
    if (searchResults) {
      searchResults.innerHTML = "";
    }
    return;
  }

  const matches = searchableCourses.filter((course) =>
    course.title.toLowerCase().includes(query) ||
    course.description.toLowerCase().includes(query)
  );

  renderSearchResults(matches);
});

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;

  if (!target) {
    return;
  }

  const clickedInsideSearch = target.closest(".search-shell") || target.closest(".search-results");
  if (!clickedInsideSearch) {
    searchResults?.classList.add("hidden");
  }

  if (target.closest(".rating-star")) {
    return;
  }

  const control = target.closest("a[href], button");
  if (!control || control === navToggle) {
    return;
  }

  const href = control.tagName === "A" ? control.getAttribute("href") : "";
  const buttonKey = normalizeButtonKey(control);

  trackMetric("button_click", {
    buttonKey,
    source: window.location.pathname || "/",
    href: href || undefined
  });

  if (control.tagName === "A" && href && href.includes("adquirir.html?curso=")) {
    trackCourseCta(control, href);
  }

  if (control.tagName === "A" && href && isInternalSectionLink(href)) {
    event.preventDefault();
    showLoader();

    window.setTimeout(() => {
      const section = document.querySelector(href);
      section?.scrollIntoView({ behavior: "auto", block: "start" });
      closeNavMenu();
      hideLoader();
    }, 360);

    return;
  }

  if (control.tagName === "A" && href) {
    showLoader();
    closeNavMenu();

    window.setTimeout(() => {
      hideLoader();
    }, 700);
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 1480) {
    closeNavMenu();
  }
});

window.addEventListener("load", () => {
  window.setTimeout(() => {
    hideLoader();
  }, 900);
});
