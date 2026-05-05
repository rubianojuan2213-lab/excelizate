const order = JSON.parse(sessionStorage.getItem("excelizateOrder") || "{}");

const paymentTitle = document.getElementById("paymentTitle");
const paymentDescription = document.getElementById("paymentDescription");
const paymentSummary = document.getElementById("paymentSummary");
const notifyJuanButton = document.getElementById("notifyJuanButton");
const calendarActions = document.getElementById("calendarActions");
const calendarButton = document.getElementById("calendarButton");
const calendarNote = document.getElementById("calendarNote");
const receiptForm = document.getElementById("receiptForm");
const receiptFile = document.getElementById("receiptFile");
const receiptStatus = document.getElementById("receiptStatus");

if (!order.courseTitle) {
  window.location.href = "index.html#cursos";
}

fetch("/api/metrics/track", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    eventType: "payment_view",
    courseKey: order.courseKey || "general",
    source: "pago"
  })
}).catch(() => {});

if (typeof window.trackAnalyticsEvent === "function") {
  window.trackAnalyticsEvent("payment_view", { courseKey: order.courseKey || "general", source: "pago" });
}

paymentTitle.textContent = order.courseType === "Clase personalizada"
  ? "Tu reserva esta lista para pago"
  : "Tu curso esta listo para pago";

paymentDescription.textContent = `Curso elegido: ${order.courseTitle}. Profesor seleccionado: ${order.teacherName}.`;

const summaryItems = [
  `Estudiante: ${order.name}`,
  `Valor: ${order.price || "Pendiente"}`,
  `Celular: ${order.phone}`,
  `Correo: ${order.email}`,
  `Profesor: ${order.teacherName} - ${order.teacherRole}`,
  order.deliveryMethod ? `Entrega por: ${order.deliveryMethod}` : `Reserva: ${order.date} a las ${order.time}`,
  `Pago sugerido: ${order.paymentChoice}`
];

paymentSummary.innerHTML = "";
summaryItems.forEach((item) => {
  const li = document.createElement("li");
  li.textContent = item;
  paymentSummary.appendChild(li);
});

const notifyMessage = encodeURIComponent(
  `Hola Juan, se registro una ${order.courseType === "Clase personalizada" ? "reserva" : "solicitud de compra"} en Excelizate Pro.\n` +
  `Curso: ${order.courseTitle}\n` +
  `Cliente: ${order.name}\n` +
  `Celular: ${order.phone}\n` +
  `Correo: ${order.email}\n` +
  `Profesor elegido: ${order.teacherName}\n` +
  `${order.deliveryMethod ? `Entrega por: ${order.deliveryMethod}\n` : `Fecha: ${order.date}\nHora: ${order.time}\n`}` +
  `Detalle: ${order.notes || "Sin detalle adicional"}`
);

notifyJuanButton.href = `https://wa.me/573028677915?text=${notifyMessage}`;

if (order.courseType === "Clase personalizada" && order.googleSchedule) {
  const calendarText = encodeURIComponent(`Clase personalizada - ${order.name}`);
  const details = encodeURIComponent(
    `Reserva solicitada en Excelizate Pro.\nCliente: ${order.name}\nCelular: ${order.phone}\nCorreo: ${order.email}\nProfesor elegido: ${order.teacherName}\nObjetivo: ${order.notes || "Sin detalle adicional"}`
  );
  calendarButton.href = order.googleEventLink || `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calendarText}&dates=${order.googleSchedule}&details=${details}`;
  calendarActions.classList.remove("hidden");
  calendarNote.textContent = order.googleEventLink
    ? "La reserva ya fue creada en Google Calendar y puedes abrirla desde aqui."
    : "Puedes abrir la reserva en Google Calendar con la fecha y hora ya preparadas. Si el backend local esta conectado, el sistema intentara crearla automaticamente.";
}

receiptForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!receiptFile?.files?.length) {
    receiptStatus.textContent = "Selecciona un comprobante antes de enviarlo.";
    return;
  }

  const formData = new FormData();
  formData.append("receipt", receiptFile.files[0]);
  formData.append("customerName", order.name || "");
  formData.append("customerPhone", order.phone || "");
  formData.append("customerEmail", order.email || "");
  formData.append("courseTitle", order.courseTitle || "");
  formData.append("courseKey", order.courseKey || "");
  formData.append("teacherName", order.teacherName || "");

  receiptStatus.textContent = "Subiendo comprobante...";

  try {
    const response = await fetch("/api/payments/upload", {
      method: "POST",
      headers: {
        ...window.getAuthHeaders()
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      receiptStatus.textContent = data.error || "No se pudo guardar el comprobante.";
      return;
    }

    if (typeof window.trackAnalyticsEvent === "function") {
      window.trackAnalyticsEvent("purchase_complete", {
        courseKey: order.courseKey || "general",
        source: "receipt_upload"
      });
    }

    receiptStatus.textContent = "Comprobante recibido correctamente. Nos comunicaremos contigo para validar el acceso.";
    receiptForm.reset();
  } catch (_error) {
    receiptStatus.textContent = "El servidor no esta disponible para recibir comprobantes.";
  }
});
