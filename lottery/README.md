# Lottery — Tee Time Sign-Up (local prototype)

A local-only prototype of the tee time sign-up system described in [`plans/lottery-plan.md`](../plans/lottery-plan.md).
This version runs entirely on your machine with a JSON file as the data store — no Cloudflare, no
database, no email — so the sign-up / edit / admin flow can be tried out before committing to real
infrastructure.

## What's different from the original plan (for now)

- **Storage:** a flat `data/registrations.json` file instead of D1, guarded by an in-process write
  lock (`src/store.js`). Good enough for local/single-instance use; not concurrency-safe across
  multiple server processes.
- **Auth:** no OTP/email verification. Submitting a registration returns a private
  `manage.html?id=...` link that is the only way to edit or cancel it — whoever has the link has
  access. Don't expose this deployment publicly as-is.
- **Admin dashboard:** `/admin.html` has no password gate.
- **Notifications:** none. No confirmation emails are sent on submit/join/edit.
- **Member roster:** `data/members.json` is seeded with fake names/emails, not the real MCC roster.

## Events

Events are pro-shop-managed, not hardcoded — see `data/events.json`, editable from
[admin-events.html](#project-structure) (linked as "Manage Events" in the nav). Seeded with two:

- **Thursday** — a single day, so no day picker is shown.
- **Weekend** — spans Saturday and Sunday, so registering requires picking a day in addition to
  the time block.

The pro shop can add/edit/delete events from `admin-events.html`, configuring per event:

- **Name** and one or more **days** (comma-separated; a single day hides the Day picker on the
  sign-up form).
- **Time blocks** — the choices golfers pick from on the sign-up form (one per line, or
  comma-separated). Each event owns its own set — there's no longer a single global list, so a
  Twosomes event on Friday afternoons can offer completely different blocks than the weekend one.
- **Max players per group** (1–8, default 4) — how many player slots the sign-up form shows for
  that event. A registration's `players` array is always exactly that length at the time it was
  created.
- An optional **notice**, shown at the top of the sign-up form whenever that event is selected —
  e.g. "Please do not sign up here if you are playing in an official club event."

An event can't be deleted while registrations still reference it (`DELETE /api/events/:id`
returns 409).

Every registration is tagged with `eventId` and `day`. `join.html` (Browse Groups) and
`admin.html` filter by event/day and show every group for that slot, not just ones open to join —
groups only get a "Join" button when they're marked open and have a free slot. The admin table and
CSV export size their Player-N columns to the widest group actually present, so a mix of events
with different max-players doesn't clip anyone.

These are intentional shortcuts for local iteration, not the final design. Revisit OTP auth, email
broadcasts, and admin auth before this goes anywhere multi-user or public-facing.

## Running locally

```bash
cd lottery
npm install
npm start
# open http://localhost:4000
```

Use `npm run dev` instead to auto-restart on file changes (Node's built-in `--watch`).

## Project structure

```
lottery/
├── server.js              ← Express entry point
├── src/
│   ├── routes.js           ← /api/* route handlers
│   └── store.js             ← JSON file read/write + per-file write lock
├── data/
│   ├── members.json        ← seed member roster (fake data)
│   ├── events.json         ← pro-shop-managed events (name, days, notice)
│   └── registrations.json  ← registrations "database" (gitignored — see below)
└── public/                 ← static frontend, no build step
    ├── index.html           ← landing page
    ├── register.html        ← new sign-up form
    ├── manage.html          ← edit/cancel via unique link (?id=...)
    ├── join.html            ← browse groups (filtered by event/day) + join open ones
    ├── admin.html           ← pro shop dashboard + CSV export
    ├── admin-events.html    ← pro shop event management (add/edit/delete, set notice text)
    ├── app.js               ← shared frontend helpers (player slot UI, fetch helper)
    └── style.css
```

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/members` | roster for the autocomplete dropdown |
| GET | `/api/events` | events and their days/time blocks/max players/notice |
| POST | `/api/events` | pro shop creates an event (`name`, `days`, `timeBlocks`, `maxPlayers`, `noticeText`) |
| PUT | `/api/events/:id` | pro shop edits an event |
| DELETE | `/api/events/:id` | pro shop deletes an event (409 if registrations reference it) |
| GET | `/api/registrations` | registrations, sorted for the admin table; optional `?eventId=&day=` filters |
| GET | `/api/registrations/open` | groups marked open with room for more players; optional `?eventId=&day=` filters |
| GET | `/api/registrations/export.csv` | CSV download for the pro shop; optional `?eventId=&day=` filters |
| GET | `/api/registrations/:id` | one registration (used by the manage page) |
| POST | `/api/registrations` | create a registration |
| PUT | `/api/registrations/:id` | edit a registration |
| POST | `/api/registrations/:id/join` | append a player to the next open slot |
| DELETE | `/api/registrations/:id` | cancel a registration |

## Data model

Each registration in `data/registrations.json`:

```json
{
  "id": "a1b2c3...",
  "createdAt": "2026-08-20T12:00:00.000Z",
  "updatedAt": "2026-08-20T12:00:00.000Z",
  "eventId": "weekend",
  "day": "Saturday",
  "timeBlock": "7:30 AM - 9:30 AM",
  "targetTime": "Middle of block",
  "players": [
    { "isGuest": false, "memberId": "m1", "name": "Smith, Jane", "email": "jane.smith@example.com" },
    { "isGuest": true, "memberId": null, "name": "Guest Guest", "email": "guest@example.com" },
    null,
    null
  ],
  "notes": "",
  "isOpenGroup": true
}
```

`players` is always length `maxPlayers` for the event it was registered under (as of registration
time); empty slots are `null`. Slot 0 (Player 1) is required.
