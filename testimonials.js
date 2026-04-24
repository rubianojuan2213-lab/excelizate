const testimonialForm = document.getElementById("testimonialForm");
const testimonialEmail = document.getElementById("testimonialEmail");
const testimonialMessage = document.getElementById("testimonialMessage");
const testimonialRating = document.getElementById("testimonialRating");
const testimonialStatus = document.getElementById("testimonialStatus");
const testimonialList = document.getElementById("testimonialList");
const testimonialSubmit = document.getElementById("testimonialSubmit");
const testimonialCancel = document.getElementById("testimonialCancel");
const ratingStars = document.querySelectorAll(".rating-star");

let editingId = null;

function formatTestimonialDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function setRating(value) {
  testimonialRating.value = String(value);
  ratingStars.forEach((star) => {
    star.classList.toggle("active", Number(star.dataset.rating) <= value);
  });
}

async function loadTestimonials() {
  if (!testimonialList) {
    return;
  }

  testimonialList.innerHTML = "<p class=\"payment-note\">Cargando testimonios...</p>";

  try {
    const response = await fetch("http://localhost:3000/api/testimonials");
    const testimonials = await response.json();

    if (!Array.isArray(testimonials) || !testimonials.length) {
      testimonialList.innerHTML = "<p class=\"payment-note\">Todavia no hay testimonios publicados. Se el primero en compartir tu experiencia.</p>";
      return;
    }

    testimonialList.innerHTML = testimonials.map((testimonial) => `
      <article class="testimonial-card">
        <header>
          <div>
            <div class="testimonial-email">${testimonial.email}</div>
            <div class="testimonial-date">${testimonial.updatedAt ? `Editado el ${formatTestimonialDate(testimonial.updatedAt)}` : `Publicado el ${formatTestimonialDate(testimonial.createdAt)}`}</div>
            <div class="testimonial-stars">${"★".repeat(testimonial.rating)}${"☆".repeat(5 - testimonial.rating)}</div>
          </div>
        </header>
        <p>${testimonial.message}</p>
        <div class="testimonial-actions">
          <button class="edit-btn" type="button" data-edit-id="${testimonial.id}">Editar</button>
          <button class="delete-btn" type="button" data-delete-id="${testimonial.id}">Borrar</button>
        </div>
      </article>
    `).join("");
  } catch (_error) {
    testimonialList.innerHTML = "<p class=\"payment-note\">No se pudieron cargar los testimonios. Verifica que el servidor local este encendido.</p>";
  }
}

ratingStars.forEach((star) => {
  star.addEventListener("click", () => {
    setRating(Number(star.dataset.rating));
  });
});

testimonialCancel?.addEventListener("click", () => {
  editingId = null;
  testimonialForm?.reset();
  setRating(5);
  testimonialSubmit.textContent = "Guardar testimonio";
  testimonialStatus.textContent = "Tu testimonio sera revisado automaticamente para evitar contenido ofensivo o inapropiado.";
});

testimonialList?.addEventListener("click", async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const editId = target.dataset.editId;
  const deleteId = target.dataset.deleteId;

  if (editId) {
    try {
      const response = await fetch("http://localhost:3000/api/testimonials");
      const testimonials = await response.json();
      const testimonial = testimonials.find((item) => item.id === Number(editId));

      if (!testimonial) {
        return;
      }

      editingId = testimonial.id;
      testimonialEmail.value = testimonial.email;
      testimonialMessage.value = testimonial.message;
      setRating(testimonial.rating);
      testimonialSubmit.textContent = "Actualizar testimonio";
      testimonialStatus.textContent = "Estas editando tu testimonio. Usa el mismo correo para guardar cambios.";
      testimonialForm.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (_error) {
      testimonialStatus.textContent = "No se pudo cargar el testimonio para editar.";
    }
  }

  if (deleteId) {
    const email = window.prompt("Para borrar tu testimonio, escribe el mismo correo con el que lo publicaste:");

    if (!email) {
      return;
    }

    const response = await fetch(`http://localhost:3000/api/testimonials/${deleteId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    testimonialStatus.textContent = data.error || "Testimonio borrado correctamente.";

    if (response.ok) {
      loadTestimonials();
    }
  }
});

testimonialForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    email: testimonialEmail.value.trim(),
    message: testimonialMessage.value.trim(),
    rating: Number(testimonialRating.value)
  };

  const url = editingId
    ? `http://localhost:3000/api/testimonials/${editingId}`
    : "http://localhost:3000/api/testimonials";

  const method = editingId ? "PUT" : "POST";

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      testimonialStatus.textContent = data.error || "No se pudo guardar el testimonio.";
      return;
    }

    testimonialStatus.textContent = editingId
      ? "Testimonio actualizado correctamente."
      : "Testimonio guardado correctamente.";
    editingId = null;
    testimonialForm.reset();
    setRating(5);
    testimonialSubmit.textContent = "Guardar testimonio";
    loadTestimonials();
  } catch (_error) {
    testimonialStatus.textContent = "No se pudo conectar con el servidor de testimonios.";
  }
});

setRating(5);
loadTestimonials();
