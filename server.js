import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { promises as dns } from "dns";
import { fileURLToPath } from "url";
import multer from "multer";
import nodemailer from "nodemailer";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKENS_PATH = path.join(__dirname, "tokens.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const ORDERS_PATH = path.join(__dirname, "orders.json");
const TESTIMONIALS_PATH = path.join(__dirname, "testimonials.json");
const SESSIONS_PATH = path.join(__dirname, "sessions.json");
const METRICS_PATH = path.join(__dirname, "metrics.json");

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_CALENDAR_ID = "primary",
  APP_BASE_URL = "http://localhost:3000",
  FRONTEND_URL,
  ADMIN_EMAILS = "rubianojuan2213@gmail.com",
  GOOGLE_REVIEW_URL = "",
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  NOTIFY_EMAIL
} = process.env;

const GOOGLE_ENABLED = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);

if (!GOOGLE_ENABLED) {
  console.warn(
    "Google OAuth/Calendar deshabilitado: faltan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_REDIRECT_URI."
  );
}

const oauth2Client = GOOGLE_ENABLED
  ? new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)
  : null;

const googleIdClient = GOOGLE_ENABLED ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const adminEmails = ADMIN_EMAILS.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
const frontendUrl = FRONTEND_URL || APP_BASE_URL;
const allowedOrigins = [frontendUrl, APP_BASE_URL, "http://localhost:3000", "http://127.0.0.1:5500", "http://localhost:5500"];

function ensureFile(filePath, initialData) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2), "utf8");
  }
}

function readJsonFile(filePath, fallback = []) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

ensureFile(ORDERS_PATH, []);
ensureFile(TESTIMONIALS_PATH, []);
ensureFile(SESSIONS_PATH, []);
ensureFile(METRICS_PATH, []);

function readTokens() {
  if (!fs.existsSync(TOKENS_PATH)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(TOKENS_PATH, "utf8"));
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2), "utf8");
}

function setStoredCredentials() {
  if (!oauth2Client) {
    return false;
  }
  const stored = readTokens();
  if (stored) {
    oauth2Client.setCredentials(stored);
    return true;
  }

  return false;
}

if (oauth2Client) {
  oauth2Client.on("tokens", (tokens) => {
    const current = readTokens() || {};
    saveTokens({ ...current, ...tokens });
  });
}

const blockedWords = [
  "odio",
  "matar",
  "estupida",
  "estupido",
  "idiota",
  "imbecil",
  "perra",
  "perro",
  "puta",
  "puto",
  "sexo",
  "sexual",
  "porno",
  "desnuda",
  "desnudo",
  "violacion",
  "violar",
  "burla",
  "burlarse",
  "ridiculo",
  "ridicula",
  "marica",
  "mierda"
];

function containsBlockedContent(text) {
  const normalized = String(text || "").toLowerCase();
  return blockedWords.some((word) => normalized.includes(word));
}

function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

async function hasMxRecords(email) {
  const domain = String(email || "").split("@")[1];

  if (!domain) {
    return false;
  }

  try {
    const records = await dns.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch (_error) {
    return false;
  }
}

function getAuthorizationToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    return null;
  }
  return auth.slice(7);
}

function readSessions() {
  return readJsonFile(SESSIONS_PATH, []);
}

function saveSessions(data) {
  writeJsonFile(SESSIONS_PATH, data);
}

function getSessionByToken(token) {
  if (!token) {
    return null;
  }
  const sessions = readSessions();
  return sessions.find((item) => item.token === token) || null;
}

function requireAuth(req, res, next) {
  const token = getAuthorizationToken(req);
  const session = getSessionByToken(token);

  if (!session) {
    res.status(401).json({ error: "Debes iniciar sesion con Google." });
    return;
  }

  req.session = session;
  req.user = session.user;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: "Acceso exclusivo para administradores." });
    return;
  }

  next();
}

function recordMetric(eventType, payload = {}) {
  const metrics = readJsonFile(METRICS_PATH, []);
  metrics.push({
    id: Date.now() + Math.floor(Math.random() * 1000),
    eventType,
    createdAt: new Date().toISOString(),
    ...payload
  });
  writeJsonFile(METRICS_PATH, metrics);
}

function summarizeMetrics() {
  const metrics = readJsonFile(METRICS_PATH, []);
  const orders = readJsonFile(ORDERS_PATH, []);

  const perCourse = {};
  const perButton = {};
  const perPage = {};
  const perDay = {};

  const dayKey = (isoString) => {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "invalid";
    return date.toISOString().slice(0, 10);
  };

  const bumpDay = (key, eventType) => {
    if (!perDay[key]) {
      perDay[key] = {
        ctaClicks: 0,
        started: 0,
        paymentViews: 0,
        completed: 0,
        buttonClicks: 0,
        logins: 0
      };
    }
    if (eventType === "course_cta_click") perDay[key].ctaClicks += 1;
    if (eventType === "acquire_view") perDay[key].started += 1;
    if (eventType === "payment_view") perDay[key].paymentViews += 1;
    if (eventType === "purchase_complete") perDay[key].completed += 1;
    if (eventType === "button_click") perDay[key].buttonClicks += 1;
    if (eventType === "login_success") perDay[key].logins += 1;
  };

  metrics.forEach((item) => {
    const key = item.courseKey || "general";
    if (!perCourse[key]) {
      perCourse[key] = {
        clicks: 0,
        started: 0,
        paymentViews: 0,
        completed: 0
      };
    }

    if (item.eventType === "course_cta_click") perCourse[key].clicks += 1;
    if (item.eventType === "acquire_view") perCourse[key].started += 1;
    if (item.eventType === "payment_view") perCourse[key].paymentViews += 1;
    if (item.eventType === "purchase_complete") perCourse[key].completed += 1;

    if (item.eventType === "button_click") {
      const buttonKey = item.buttonKey || "sin-etiqueta";
      perButton[buttonKey] = (perButton[buttonKey] || 0) + 1;
    }

    const pageKey =
      String(item.page || item.source || item.href || "")
        .trim() || "sin-pagina";
    perPage[pageKey] = (perPage[pageKey] || 0) + 1;

    bumpDay(dayKey(item.createdAt), item.eventType);
  });

  Object.values(perCourse).forEach((course) => {
    course.dropOff = Math.max(course.started - course.completed, 0);
    course.conversion = course.started ? course.completed / course.started : 0;
    course.paymentConversion = course.paymentViews ? course.completed / course.paymentViews : 0;
  });

  const totals = {
    ctaClicks: metrics.filter((item) => item.eventType === "course_cta_click").length,
    started: metrics.filter((item) => item.eventType === "acquire_view").length,
    paymentViews: metrics.filter((item) => item.eventType === "payment_view").length,
    completed: metrics.filter((item) => item.eventType === "purchase_complete").length,
    buttonClicks: metrics.filter((item) => item.eventType === "button_click").length,
    logins: metrics.filter((item) => item.eventType === "login_success").length,
    testimonials: readJsonFile(TESTIMONIALS_PATH, []).length,
    receipts: orders.length
  };

  const funnel = {
    steps: [
      { key: "ctaClicks", label: "Clic CTA", value: totals.ctaClicks },
      { key: "started", label: "Formulario (adquirir)", value: totals.started },
      { key: "paymentViews", label: "Vista pago", value: totals.paymentViews },
      { key: "completed", label: "Compra finalizada", value: totals.completed }
    ]
  };

  funnel.steps = funnel.steps.map((step, index, arr) => {
    const prev = index === 0 ? step.value : arr[index - 1].value;
    const rateFromPrev = prev ? step.value / prev : 0;
    return { ...step, rateFromPrev };
  });

  const byDay = Object.entries(perDay)
    .filter(([key]) => key !== "invalid")
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, values]) => ({ date, ...values }));

  return {
    totals,
    funnel,
    perCourse,
    perButton,
    perPage,
    byDay
  };
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
    cb(null, safeName);
  }
});

const upload = multer({ storage });

const app = express();
const mailer = SMTP_HOST && SMTP_USER && SMTP_PASS && NOTIFY_EMAIL
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 465),
      secure: String(SMTP_SECURE || "true") === "true",
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    })
  : null;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (
      origin.startsWith("http://127.0.0.1:") ||
      origin.startsWith("http://localhost:") ||
      origin === "null" ||
      allowedOrigins.includes(origin)
    ) {
      callback(null, true);
      return;
    }

    callback(new Error("Origen no permitido por CORS."));
  }
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(__dirname));

app.get("/", (_req, res) => {
  res.redirect("/index.html");
});

app.get("/api/config", (_req, res) => {
  res.json({
    googleClientId: GOOGLE_ENABLED ? GOOGLE_CLIENT_ID : null,
    adminEmails,
    googleReviewUrl: GOOGLE_REVIEW_URL
  });
});

app.post("/api/auth/google-login", async (req, res) => {
  if (!googleIdClient || !GOOGLE_ENABLED) {
    res.status(503).json({ error: "Acceso con Google no esta configurado en el servidor." });
    return;
  }
  const { credential } = req.body;

  if (!credential) {
    res.status(400).json({ error: "No se recibio la credencial de Google." });
    return;
  }

  try {
    const ticket = await googleIdClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const email = String(payload?.email || "").toLowerCase();

    if (!email) {
      res.status(400).json({ error: "No fue posible leer el correo del usuario." });
      return;
    }

    const sessions = readSessions().filter((item) => item.user.email !== email);
    const session = {
      token: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      user: {
        sub: payload.sub,
        email,
        name: payload.name || email,
        picture: payload.picture || "",
        isAdmin: adminEmails.includes(email)
      }
    };

    sessions.push(session);
    saveSessions(sessions);
    recordMetric("login_success", { email });

    res.json({
      ok: true,
      token: session.token,
      user: session.user
    });
  } catch (error) {
    console.error(error);
    res.status(401).json({ error: "No se pudo validar el acceso con Google." });
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  const token = req.session.token;
  const sessions = readSessions().filter((item) => item.token !== token);
  saveSessions(sessions);
  res.json({ ok: true });
});

app.get("/auth/google", (_req, res) => {
  if (!oauth2Client || !GOOGLE_ENABLED) {
    res.status(503).send("Google Calendar no esta configurado en el servidor.");
    return;
  }
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"]
  });

  res.redirect(url);
});

app.get("/auth/google/callback", async (req, res) => {
  if (!oauth2Client || !GOOGLE_ENABLED) {
    res.status(503).send("Google Calendar no esta configurado en el servidor.");
    return;
  }
  const code = req.query.code;

  if (!code || typeof code !== "string") {
    res.status(400).send("No llego el codigo de autorizacion.");
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    saveTokens(tokens);
    oauth2Client.setCredentials(tokens);
    res.send("Google Calendar conectado correctamente. Ya puedes volver a la web.");
  } catch (error) {
    console.error(error);
    res.status(500).send("No se pudo completar la autorizacion.");
  }
});

app.get("/api/calendar/status", (_req, res) => {
  res.json({ connected: setStoredCredentials() });
});

app.post("/api/calendar/book", async (req, res) => {
  if (!oauth2Client || !GOOGLE_ENABLED) {
    res.status(503).json({ error: "Google Calendar no esta configurado en el servidor." });
    return;
  }
  if (!setStoredCredentials()) {
    res.status(401).json({
      error: "Google Calendar no esta conectado aun.",
      authUrl: `${APP_BASE_URL}/auth/google`
    });
    return;
  }

  const { summary, description, date, time, durationMinutes = 60 } = req.body;

  if (!summary || !date || !time) {
    res.status(400).json({ error: "Faltan datos para crear la reserva." });
    return;
  }

  try {
    const startDate = new Date(`${date}T${time}:00-05:00`);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const response = await calendar.events.insert({
      calendarId: GOOGLE_CALENDAR_ID,
      requestBody: {
        summary,
        description,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: "America/Bogota"
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: "America/Bogota"
        }
      }
    });

    res.json({
      ok: true,
      eventId: response.data.id,
      eventLink: response.data.htmlLink
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo crear el evento en Google Calendar." });
  }
});

app.post("/api/metrics/track", (req, res) => {
  const { eventType, courseKey, source, extra, buttonKey, href, page, label } = req.body;

  if (!eventType) {
    res.status(400).json({ error: "Falta el tipo de evento." });
    return;
  }

  recordMetric(eventType, { courseKey, source, extra, buttonKey, href, page, label });
  res.json({ ok: true });
});

app.get("/api/testimonials", (_req, res) => {
  const testimonials = readJsonFile(TESTIMONIALS_PATH, []);
  res.json(testimonials);
});

app.post("/api/testimonials", requireAuth, async (req, res) => {
  const { message, rating } = req.body;
  const safeRating = Number(rating);
  const user = req.user;

  if (!isValidEmailFormat(user.email)) {
    res.status(400).json({ error: "Tu correo de Google no parece valido." });
    return;
  }

  await hasMxRecords(user.email);

  if (!message || String(message).trim().length < 12) {
    res.status(400).json({ error: "El testimonio debe tener al menos 12 caracteres." });
    return;
  }

  if (containsBlockedContent(message)) {
    res.status(400).json({ error: "El testimonio contiene contenido no permitido." });
    return;
  }

  if (!Number.isInteger(safeRating) || safeRating < 1 || safeRating > 5) {
    res.status(400).json({ error: "La calificacion debe ser entre 1 y 5 estrellas." });
    return;
  }

  const testimonials = readJsonFile(TESTIMONIALS_PATH, []);
  const testimonial = {
    id: Date.now(),
    authorSub: user.sub,
    email: user.email,
    name: user.name,
    picture: user.picture,
    message: String(message).trim(),
    rating: safeRating,
    createdAt: new Date().toISOString()
  };

  testimonials.unshift(testimonial);
  writeJsonFile(TESTIMONIALS_PATH, testimonials);
  res.json({ ok: true, testimonial });
});

app.put("/api/testimonials/:id", requireAuth, (req, res) => {
  const testimonialId = Number(req.params.id);
  const { message, rating } = req.body;
  const safeRating = Number(rating);
  const testimonials = readJsonFile(TESTIMONIALS_PATH, []);
  const index = testimonials.findIndex((item) => item.id === testimonialId);

  if (index === -1) {
    res.status(404).json({ error: "No se encontro el testimonio." });
    return;
  }

  if (testimonials[index].authorSub !== req.user.sub) {
    res.status(403).json({ error: "Solo puedes editar tu propio testimonio." });
    return;
  }

  if (containsBlockedContent(message)) {
    res.status(400).json({ error: "El testimonio contiene contenido no permitido." });
    return;
  }

  if (!Number.isInteger(safeRating) || safeRating < 1 || safeRating > 5) {
    res.status(400).json({ error: "La calificacion debe ser entre 1 y 5 estrellas." });
    return;
  }

  testimonials[index] = {
    ...testimonials[index],
    message: String(message).trim(),
    rating: safeRating,
    updatedAt: new Date().toISOString()
  };

  writeJsonFile(TESTIMONIALS_PATH, testimonials);
  res.json({ ok: true, testimonial: testimonials[index] });
});

app.delete("/api/testimonials/:id", requireAuth, (req, res) => {
  const testimonialId = Number(req.params.id);
  const testimonials = readJsonFile(TESTIMONIALS_PATH, []);
  const found = testimonials.find((item) => item.id === testimonialId);

  if (!found) {
    res.status(404).json({ error: "No se encontro el testimonio." });
    return;
  }

  if (found.authorSub !== req.user.sub) {
    res.status(403).json({ error: "Solo puedes borrar tu propio testimonio." });
    return;
  }

  const filtered = testimonials.filter((item) => item.id !== testimonialId);
  writeJsonFile(TESTIMONIALS_PATH, filtered);
  res.json({ ok: true });
});

app.post("/api/payments/upload", requireAuth, upload.single("receipt"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No se recibio el comprobante." });
    return;
  }

  const currentOrders = readJsonFile(ORDERS_PATH, []);
  const record = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    customerName: req.body.customerName || req.user.name || "",
    customerPhone: req.body.customerPhone || "",
    customerEmail: req.body.customerEmail || req.user.email || "",
    courseTitle: req.body.courseTitle || "",
    courseKey: req.body.courseKey || "",
    teacherName: req.body.teacherName || "",
    receiptFilename: req.file.filename,
    receiptPath: req.file.path,
    userEmail: req.user.email,
    userSub: req.user.sub
  };

  currentOrders.push(record);
  writeJsonFile(ORDERS_PATH, currentOrders);
  recordMetric("purchase_complete", { courseKey: record.courseKey, source: "receipt_upload", email: record.userEmail });

  if (mailer) {
    try {
      await mailer.sendMail({
        from: `"Excelizate Pro" <${SMTP_USER}>`,
        to: NOTIFY_EMAIL,
        subject: `Nuevo comprobante - ${record.courseTitle}`,
        text:
          `Se subio un nuevo comprobante.\n\n` +
          `Cliente: ${record.customerName}\n` +
          `Celular: ${record.customerPhone}\n` +
          `Correo: ${record.customerEmail}\n` +
          `Curso: ${record.courseTitle}\n` +
          `Profesor: ${record.teacherName}\n` +
          `Archivo: ${record.receiptFilename}\n` +
          `Ruta local: ${record.receiptPath}`,
        attachments: [
          {
            filename: record.receiptFilename,
            path: record.receiptPath
          }
        ]
      });
    } catch (error) {
      console.error("No se pudo enviar el correo de notificacion:", error);
    }
  }

  res.json({
    ok: true,
    message: "Comprobante recibido correctamente.",
    record
  });
});

app.get("/api/admin/dashboard", requireAuth, requireAdmin, (_req, res) => {
  res.json(summarizeMetrics());
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Servidor listo en http://localhost:${PORT}`);
});
