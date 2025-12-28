# The Projects Calendar

Live: https://www.projectsmc.xyz

A lightweight events + RSVP app used by The Projects community. It renders a
calendar view, highlights upcoming plans, and lets members RSVP to each event.

## Features
- Monthly calendar with clickable event entries
- Upcoming events sidebar with RSVP counts
- Event creation form
- RSVP per session (one RSVP per event)
- Admin-only delete for events and RSVPs

## Tech Stack
- Node.js + Express
- EJS templates
- PostgreSQL (tested with Supabase)

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file in the project root:
   ```
   ADMIN_TOKEN=your-secret-token
   DATABASE_URL=your-postgres-connection-string
   DATABASE_SSL=true
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open `http://localhost:3000`

## Environment Variables
- `ADMIN_TOKEN`: Shared token required to delete events or RSVPs.
- `DATABASE_URL`: Postgres connection string.
- `DATABASE_SSL`: Set to `false` to disable SSL in local dev.

## Database
Tables are created on boot if they do not exist:
- `events`: title, description, date, time, location
- `rsvps`: event_id, name, session_id, created_at

If the events table is empty, the server seeds a few sample events on startup.

## Admin Actions
Deleting an event or RSVP requires the admin token. The UI will prompt for it,
or you can pass it directly:
```
POST /events/:id/delete?admin=YOUR_TOKEN
POST /rsvps/:id/delete?admin=YOUR_TOKEN
```

## Scripts
- `npm start`: Run the Express server.

