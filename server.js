const crypto = require("crypto");
require("dotenv").config();
const path = require("path");
const express = require("express");
const { pool, initDb } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

const getSessionId = (req, res) => {
  const rawCookie = req.headers.cookie || "";
  const cookies = rawCookie.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join("=") || "");
    return acc;
  }, {});

  let sessionId = cookies.rsvp_session;
  if (!sessionId) {
    sessionId = crypto.randomBytes(16).toString("hex");
    res.setHeader(
      "Set-Cookie",
      `rsvp_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`
    );
  }
  return sessionId;
};

const isAdmin = (req) => {
  if (!ADMIN_TOKEN) return false;
  const token = (req.query.admin || req.body.admin || "").trim();
  return token && token === ADMIN_TOKEN;
};

const normalizeDateValue = (value) => {
  if (!value) return value;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && value.includes("T")) {
    return value.slice(0, 10);
  }
  return value;
};

const normalizeEvent = (event) => ({
  ...event,
  event_date: normalizeDateValue(event.event_date)
});

const listEvents = async () => {
  const { rows } = await pool.query(
    "SELECT * FROM events ORDER BY event_date ASC, event_time ASC NULLS LAST"
  );
  return rows.map(normalizeEvent);
};

const listUpcoming = async () => {
  const { rows } = await pool.query(
    "SELECT * FROM events WHERE event_date >= CURRENT_DATE ORDER BY event_date ASC, event_time ASC NULLS LAST LIMIT 6"
  );
  return rows.map(normalizeEvent);
};

const listCounts = async () => {
  const { rows } = await pool.query(
    "SELECT event_id, COUNT(*)::int AS count FROM rsvps GROUP BY event_id"
  );
  return rows.reduce((acc, row) => {
    acc[row.event_id] = row.count;
    return acc;
  }, {});
};

app.get("/", async (req, res) => {
  try {
    const events = await listEvents();
    const upcoming = await listUpcoming();
    const counts = await listCounts();
    res.render("index", { events, upcoming, counts });
  } catch (error) {
    res.status(500).send("Failed to load events.");
  }
});

app.get("/events/new", (req, res) => {
  res.render("new-event", { error: req.query.error });
});

app.post("/events", async (req, res) => {
  const title = (req.body.title || "").trim();
  const description = (req.body.description || "").trim();
  const eventDate = (req.body.event_date || "").trim();
  const eventTime = (req.body.event_time || "").trim();
  const location = (req.body.location || "").trim();

  if (!title || !description || !eventDate) {
    return res.redirect("/events/new?error=Title,%20description,%20and%20date%20required");
  }

  try {
    const { rows } = await pool.query(
      "INSERT INTO events (title, description, event_date, event_time, location) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [title, description, eventDate, eventTime || null, location || null]
    );
    res.redirect(`/events/${rows[0].id}`);
  } catch (error) {
    res.status(500).send("Failed to create event.");
  }
});

app.get("/events/:id", async (req, res) => {
  const sessionId = getSessionId(req, res);
  try {
    const eventResult = await pool.query("SELECT * FROM events WHERE id = $1", [
      req.params.id
    ]);
    const event = eventResult.rows[0];
    if (!event) {
      return res.status(404).send("Event not found.");
    }
    const rsvpResult = await pool.query(
      "SELECT id, name, created_at FROM rsvps WHERE event_id = $1 ORDER BY created_at ASC",
      [req.params.id]
    );
    const existing = await pool.query(
      "SELECT 1 FROM rsvps WHERE event_id = $1 AND session_id = $2 LIMIT 1",
      [req.params.id, sessionId]
    );
    res.render("event", {
      event: normalizeEvent(event),
      rsvps: rsvpResult.rows,
      error: req.query.error,
      alreadyRsvped: existing.rowCount > 0,
      adminError: req.query.admin_error
    });
  } catch (error) {
    res.status(500).send("Failed to load event.");
  }
});

app.post("/events/:id/rsvp", async (req, res) => {
  const sessionId = getSessionId(req, res);
  const name = (req.body.name || "").trim();
  try {
    const eventResult = await pool.query("SELECT id FROM events WHERE id = $1", [
      req.params.id
    ]);
    if (!eventResult.rowCount) {
      return res.status(404).send("Event not found.");
    }
    if (!name) {
      return res.redirect(`/events/${req.params.id}?error=Name%20required`);
    }
    const existing = await pool.query(
      "SELECT 1 FROM rsvps WHERE event_id = $1 AND session_id = $2 LIMIT 1",
      [req.params.id, sessionId]
    );
    if (existing.rowCount) {
      return res.redirect(`/events/${req.params.id}?error=Only%20one%20RSVP%20per%20event`);
    }
    await pool.query(
      "INSERT INTO rsvps (event_id, name, session_id) VALUES ($1, $2, $3)",
      [req.params.id, name, sessionId]
    );
    res.redirect(`/events/${req.params.id}`);
  } catch (error) {
    res.status(500).send("Failed to RSVP.");
  }
});

app.post("/events/:id/delete", async (req, res) => {
  if (!isAdmin(req)) {
    return res.redirect(
      `/events/${req.params.id}?admin_error=Wrong%20credential.%20Are%20you%20sure%20you%20are%20authorized%20to%20do%20this%3F`
    );
  }
  try {
    const eventResult = await pool.query("SELECT id FROM events WHERE id = $1", [
      req.params.id
    ]);
    if (!eventResult.rowCount) {
      return res.status(404).send("Event not found.");
    }
    await pool.query("DELETE FROM rsvps WHERE event_id = $1", [req.params.id]);
    await pool.query("DELETE FROM events WHERE id = $1", [req.params.id]);
    res.redirect("/");
  } catch (error) {
    res.status(500).send("Failed to delete event.");
  }
});

app.post("/rsvps/:id/delete", async (req, res) => {
  const adminError =
    "Wrong credential. Are you sure you are authorized to do this?";
  if (!isAdmin(req)) {
    try {
      const rsvpResult = await pool.query(
        "SELECT event_id FROM rsvps WHERE id = $1",
        [req.params.id]
      );
      const rsvp = rsvpResult.rows[0];
      if (!rsvp) {
        return res.status(404).send("RSVP not found.");
      }
      return res.redirect(
        `/events/${rsvp.event_id}?admin_error=${encodeURIComponent(adminError)}`
      );
    } catch (error) {
      return res.status(500).send("Failed to remove RSVP.");
    }
  }
  try {
    const rsvpResult = await pool.query(
      "SELECT event_id FROM rsvps WHERE id = $1",
      [req.params.id]
    );
    const rsvp = rsvpResult.rows[0];
    if (!rsvp) {
      return res.status(404).send("RSVP not found.");
    }
    await pool.query("DELETE FROM rsvps WHERE id = $1", [req.params.id]);
    const adminToken = req.body.admin ? `?admin=${encodeURIComponent(req.body.admin)}` : "";
    res.redirect(`/events/${rsvp.event_id}${adminToken}`);
  } catch (error) {
    res.status(500).send("Failed to remove RSVP.");
  }
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to initialize database.", error);
    process.exit(1);
  });
