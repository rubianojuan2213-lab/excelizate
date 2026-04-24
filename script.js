document.body.classList.add("is-loading");

const navItems = document.querySelectorAll(".nav-item");
const navContainer = document.querySelector(".nav-pill");
const preloader = document.getElementById("preloader");
const loadingTriggers = document.querySelectorAll("a[href]");
const searchInput = document.getElementById("courseSearchInput");
const searchResults = document.getElementById("searchResults");

const searchableCourses = [
  {
    title: "Excel basico (desde cero)",
    description: "Ideal para comenzar con formulas, tablas, funciones y reportes.",
    href: "adquirir.html?curso=excel-basico"
  },
  {
    title: "Excel intermedio",
    description: "Funciones utiles, analisis practico y trabajo con datos.",
    href: "adquirir.html?curso=excel-intermedio"
  },
  {
    title: "Excel avanzado",
    description: "Dashboards, power query, macros, reportes y analisis avanzado.",
    href: "adquirir.html?curso=excel-avanzado"
  },
  {
    title: "Contabilidad basica",
    description: "Principios contables, registros, libro diario y estados financieros.",
    href: "adquirir.html?curso=contabilidad-basica"
  },
  {
    title: "Manejo de programa Siigo",
    description: "Configuracion, compras, ventas, clientes, proveedores e inventarios.",
    href: "adquirir.html?curso=siigo"
  },
  {
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

loadingTriggers.forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    const href = trigger.getAttribute("href");

    if (!href) {
      return;
    }

    showLoader();

    if (href.startsWith("#")) {
      event.preventDefault();

      window.setTimeout(() => {
        const target = document.querySelector(href);
        target?.scrollIntoView({ block: "start" });
        hideLoader();
      }, 900);

      return;
    }

    window.setTimeout(() => {
      hideLoader();
    }, 900);
  });
});

searchInput?.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();

  if (!query) {
    searchResults?.classList.add("hidden");
    searchResults.innerHTML = "";
    return;
  }

  const matches = searchableCourses.filter((course) =>
    course.title.toLowerCase().includes(query) ||
    course.description.toLowerCase().includes(query)
  );

  if (!matches.length) {
    searchResults.innerHTML = `<div class="search-item"><strong>Sin coincidencias</strong><p>No encontramos cursos con ese texto.</p></div>`;
    searchResults.classList.remove("hidden");
    return;
  }

  searchResults.innerHTML = matches.map((course) => `
    <a class="search-item" href="${course.href}">
      <strong>${course.title}</strong>
      <p>${course.description}</p>
      <span class="course-action">Adquirir ahora</span>
    </a>
  `).join("");

  searchResults.classList.remove("hidden");
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
  }, 1400);
});
