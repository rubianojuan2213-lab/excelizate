import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { promises as dns } from "dns";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import multer from "multer";
import nodemailer from "nodemailer";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKENS_PATH = path.join(__dirname, "tokens.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const ORDERS_PATH = path.join(__dirname, "orders.json");
const TESTIMONIALS_PATH = path.join(__dirname, "testimonials.json");

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_CALENDAR_ID = "primary",
  APP_BASE_URL = "http://localhost:3000",
  FRONTEND_URL = "http://127.0.0.1:5500",
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  NOTIFY_EMAIL
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  console.error("Faltan variables de Google en .env");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

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
  const stored = readTokens();
  if (stored) {
    oauth2Client.setCredentials(stored);
    return true;
  }

  return false;
}

oauth2Client.on("tokens", (tokens) => {
  const current = readTokens() || {};
  saveTokens({ ...current, ...tokens });
});

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

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

if (!fs.existsSync(ORDERS_PATH)) {
  fs.writeFileSync(ORDERS_PATH, "[]", "utf8");
}

if (!fs.existsSync(TESTIMONIALS_PATH)) {
  fs.writeFileSync(TESTIMONIALS_PATH, "[]", "utf8");
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

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

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

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (
      origin.startsWith("http://127.0.0.1:") ||
      origin.startsWith("http://localhost:") ||
      origin === FRONTEND_URL ||
      origin === "null"
    ) {
      callback(null, true);
      return;
    }

    callback(new Error("Origen no permitido por CORS."));
  }
}));
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("Servidor de Google Calendar listo.");
});

app.get("/auth/google", (_req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"]
  });

  res.redirect(url);
});

app.get("/auth/google/callback", async (req, res) => {
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

app.get("/api/testimonials", (_req, res) => {
  const testimonials = readJsonFile(TESTIMONIALS_PATH);
  res.json(testimonials);
});

app.post("/api/testimonials", async (req, res) => {
  const { email, message, rating } = req.body;
  const safeRating = Number(rating);

  if (!isValidEmailFormat(email)) {
    res.status(400).json({ error: "El correo no tiene un formato valido." });
    return;
  }

  await hasMxRecords(email);

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

  const testimonials = readJsonFile(TESTIMONIALS_PATH);
  const testimonial = {
    id: Date.now(),
    email: String(email).trim().toLowerCase(),
    message: String(message).trim(),
    rating: safeRating,
    createdAt: new Date().toISOString()
  };

  testimonials.unshift(testimonial);
  writeJsonFile(TESTIMONIALS_PATH, testimonials);
  res.json({ ok: true, testimonial });
});

app.put("/api/testimonials/:id", async (req, res) => {
  const testimonialId = Number(req.params.id);
  const { email, message, rating } = req.body;
  const safeRating = Number(rating);
  const testimonials = readJsonFile(TESTIMONIALS_PATH);
  const index = testimonials.findIndex((item) => item.id === testimonialId);

  if (index === -1) {
    res.status(404).json({ error: "No se encontro el testimonio." });
    return;
  }

  if (testimonials[index].email !== String(email || "").trim().toLowerCase()) {
    res.status(403).json({ error: "Solo puedes editar tu propio testimonio con el mismo correo." });
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

app.delete("/api/testimonials/:id", (req, res) => {
  const testimonialId = Number(req.params.id);
  const { email } = req.body;
  const testimonials = readJsonFile(TESTIMONIALS_PATH);
  const found = testimonials.find((item) => item.id === testimonialId);

  if (!found) {
    res.status(404).json({ error: "No se encontro el testimonio." });
    return;
  }

  if (found.email !== String(email || "").trim().toLowerCase()) {
    res.status(403).json({ error: "Solo puedes borrar tu propio testimonio con el mismo correo." });
    return;
  }

  const filtered = testimonials.filter((item) => item.id !== testimonialId);
  writeJsonFile(TESTIMONIALS_PATH, filtered);
  res.json({ ok: true });
});

app.post("/api/payments/upload", upload.single("receipt"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No se recibio el comprobante." });
    return;
  }

  const currentOrders = JSON.parse(fs.readFileSync(ORDERS_PATH, "utf8"));
  const record = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    customerName: req.body.customerName || "",
    customerPhone: req.body.customerPhone || "",
    customerEmail: req.body.customerEmail || "",
    courseTitle: req.body.courseTitle || "",
    teacherName: req.body.teacherName || "",
    receiptFilename: req.file.filename,
    receiptPath: req.file.path
  };

  currentOrders.push(record);
  fs.writeFileSync(ORDERS_PATH, JSON.stringify(currentOrders, null, 2), "utf8");

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

app.post("/api/calendar/book", async (req, res) => {
  if (!setStoredCredentials()) {
    res.status(401).json({
      error: "Google Calendar no esta conectado aun.",
      authUrl: `${APP_BASE_URL}/auth/google`
    });
    return;
  }

  const {
    summary,
    description,
    date,
    time,
    durationMinutes = 60
  } = req.body;

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

app.listen(3000, () => {
  console.log("Servidor listo en http://localhost:3000");
});
