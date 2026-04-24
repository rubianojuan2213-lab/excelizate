const courseCatalog = {
  "excel-basico": {
    type: "Curso grabado",
    title: "Excel basico (desde cero)",
    price: "$49.900 COP",
    description: "Empieza desde lo fundamental y domina formulas, tablas, funciones y reportes utiles.",
    points: [
      "Entrega digital del contenido",
      "Ideal para principiantes",
      "Acceso practico y claro"
    ],
    posterClass: "course-cover--excel-basico",
    personalized: false
  },
  "excel-intermedio": {
    type: "Curso grabado",
    title: "Excel intermedio",
    price: "$69.900 COP",
    description: "Refuerza tu manejo de funciones, analisis y herramientas aplicadas al trabajo diario.",
    points: [
      "Funciones de nivel intermedio",
      "Aplicado a reportes reales",
      "Pensado para avanzar con orden"
    ],
    posterClass: "course-cover--excel-intermedio",
    personalized: false
  },
  "excel-avanzado": {
    type: "Curso grabado",
    title: "Excel avanzado",
    price: "$89.900 COP",
    description: "Profundiza en dashboards, tablas dinamicas, power query y automatizacion.",
    points: [
      "Enfoque avanzado y profesional",
      "Herramientas para analisis de datos",
      "Mayor productividad en oficina o negocio"
    ],
    posterClass: "course-cover--excel-avanzado",
    personalized: false
  },
  "contabilidad-basica": {
    type: "Curso grabado",
    title: "Contabilidad basica",
    price: "$59.900 COP",
    description: "Entiende los fundamentos contables, los registros y la estructura financiera esencial.",
    points: [
      "Principios y registros contables",
      "Libro diario y mayor",
      "Base ideal para emprender o trabajar"
    ],
    posterClass: "course-cover--contabilidad",
    personalized: false
  },
  siigo: {
    type: "Curso grabado",
    title: "Manejo de programa Siigo",
    price: "$79.900 COP",
    description: "Aprende a manejar configuracion, clientes, compras, ventas, inventarios y reportes.",
    points: [
      "Paso a paso dentro del sistema",
      "Util para operacion administrativa",
      "Pensado para uso practico"
    ],
    posterClass: "course-cover--siigo",
    personalized: false
  },
  "clase-personalizada": {
    type: "Clase personalizada",
    title: "Clase personalizada",
    price: "$29.950 COP / hora",
    description: "Reserva una sesion 1 a 1 y elige el dia y la hora que mas te convenga.",
    points: [
      "Atencion enfocada en tu necesidad",
      "Eliges fecha y hora",
      "Acompanamiento personalizado"
    ],
    posterClass: "course-cover--personalizada",
    personalized: true
  }
};

const params = new URLSearchParams(window.location.search);
const selectedCourse = params.get("curso") || "excel-basico";
const course = courseCatalog[selectedCourse] || courseCatalog["excel-basico"];

const purchaseType = document.getElementById("purchaseType");
const purchaseTitle = document.getElementById("purchaseTitle");
const purchaseDescription = document.getElementById("purchaseDescription");
const purchasePrice = document.getElementById("purchasePrice");
const summaryPoints = document.getElementById("summaryPoints");
const purchasePoster = document.getElementById("purchasePoster");
const deliveryField = document.getElementById("deliveryField");
const scheduleFields = document.getElementById("scheduleFields");
const formIntro = document.getElementById("formIntro");
const submitButton = document.getElementById("submitButton");
const purchaseForm = document.getElementById("purchaseForm");
const classDate = document.getElementById("classDate");
const classTime = document.getElementById("classTime");
const paymentChoice = "Wompi";
const calendarApiBase = "http://localhost:3000";

if (classDate) {
  classDate.min = new Date().toISOString().split("T")[0];
}

function formatGoogleDate(dateString, timeString, extraHours = 1) {
  const start = new Date(`${dateString}T${timeString}:00`);
  const end = new Date(start.getTime() + extraHours * 60 * 60 * 1000);
  const toStamp = (value) => value.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return `${toStamp(start)}/${toStamp(end)}`;
}

purchaseType.textContent = course.type;
purchaseTitle.textContent = course.title;
purchasePrice.textContent = course.price;
purchaseDescription.textContent = course.description;
purchasePoster.classList.add("course-cover", course.posterClass);
submitButton.textContent = course.personalized ? "Solicitar reserva" : "Solicitar curso";
formIntro.textContent = course.personalized
  ? "Completa tus datos y escoge la fecha de tu clase personalizada."
  : "Completa tus datos y elige por donde deseas recibir el curso.";

summaryPoints.innerHTML = "";
course.points.forEach((point) => {
  const item = document.createElement("li");
  item.textContent = point;
  summaryPoints.appendChild(item);
});

if (course.personalized) {
  deliveryField.classList.add("hidden");
  scheduleFields.classList.remove("hidden");
  classDate.required = true;
  classTime.required = true;
} else {
  deliveryField.classList.remove("hidden");
  scheduleFields.classList.add("hidden");
}

purchaseForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(purchaseForm);
  const name = formData.get("fullName");
  const phone = formData.get("phone");
  const email = formData.get("email");
  const notes = formData.get("notes") || "";
  const [teacherName, teacherPhone, teacherRole] = String(formData.get("teacher") || "").split("|");

  const order = {
    courseKey: selectedCourse,
    courseTitle: course.title,
    courseType: course.type,
    name,
    phone,
    email,
    notes,
    teacherName,
    teacherPhone,
    teacherRole,
    paymentChoice,
    price: course.price
  };

  if (course.personalized) {
    const date = formData.get("classDate");
    const time = formData.get("classTime");
    order.date = date;
    order.time = time;
    order.googleSchedule = formatGoogleDate(date, time);

    try {
      const bookingResponse = await fetch(`${calendarApiBase}/api/calendar/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          summary: `${course.title} - ${name}`,
          description:
            `Reserva solicitada en Excelizate Pro.\n` +
            `Cliente: ${name}\n` +
            `Celular: ${phone}\n` +
            `Correo: ${email}\n` +
            `Profesor elegido: ${teacherName}\n` +
            `Detalle: ${notes || "Sin detalle adicional"}`,
          date,
          time,
          durationMinutes: 60
        })
      });

      if (bookingResponse.status === 401) {
        const authData = await bookingResponse.json();
        window.alert("Primero debes autorizar Google Calendar. Se abrira la pagina de conexion.");
        window.open(authData.authUrl, "_blank", "noopener");
      } else if (bookingResponse.ok) {
        const bookingData = await bookingResponse.json();
        order.googleEventLink = bookingData.eventLink;
      }
    } catch (_error) {
      // Si el backend local no esta corriendo, seguimos con el flujo de respaldo.
    }
  }

  if (!course.personalized) {
    order.deliveryMethod = formData.get("deliveryMethod");
  }

  sessionStorage.setItem("excelizateOrder", JSON.stringify(order));
  window.location.href = `pago.html?curso=${selectedCourse}`;
});
