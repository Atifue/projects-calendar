const dns = require("dns");
const { Pool } = require("pg");

// Force IPv4 first to avoid IPv6-only resolution issues on some hosts.
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const databaseUrl = process.env.DATABASE_URL || "";
if (!databaseUrl) {
  // eslint-disable-next-line no-console
  console.warn("DATABASE_URL is not set. Set it to your Supabase connection string.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.DATABASE_SSL === "false"
      ? false
      : { rejectUnauthorized: false }
});

const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      event_date DATE NOT NULL,
      event_time TIME,
      location TEXT
    );
    CREATE TABLE IF NOT EXISTS rsvps (
      id SERIAL PRIMARY KEY,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      session_id TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM events");
  if (rows[0].count === 0) {
    const today = new Date();
    const toISODate = (d) => d.toISOString().slice(0, 10);
    const addDays = (d, days) => new Date(d.getTime() + days * 86400000);

    const seedEvents = [
      {
        title: "Friday Game Night",
        description:
          "Bring your co-op pick. We'll rotate between party games and a co-op run.",
        event_date: toISODate(addDays(today, 2)),
        event_time: "20:00",
        location: "Discord: #hangout"
      },
      {
        title: "Movie Club: Sci-Fi Night",
        description:
          "Voting opens at 7pm. We start the stream at 8pm sharp. Popcorn required.",
        event_date: toISODate(addDays(today, 6)),
        event_time: "20:00",
        location: "Discord: #screening-room"
      },
      {
        title: "Sunday Chill & Catch-up",
        description:
          "Low-key voice chat to talk about the week and plan upcoming stuff.",
        event_date: toISODate(addDays(today, 10)),
        event_time: "18:30",
        location: "Discord: #lounge"
      }
    ];

    for (const event of seedEvents) {
      await pool.query(
        "INSERT INTO events (title, description, event_date, event_time, location) VALUES ($1, $2, $3, $4, $5)",
        [
          event.title,
          event.description,
          event.event_date,
          event.event_time,
          event.location
        ]
      );
    }
  }
};

module.exports = {
  pool,
  initDb
};
