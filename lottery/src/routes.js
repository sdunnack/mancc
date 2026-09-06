const express = require("express");
const crypto = require("crypto");
const store = require("./store");

const router = express.Router();

const DEFAULT_MAX_PLAYERS = 4;
const MIN_MAX_PLAYERS = 1;
const MAX_MAX_PLAYERS = 8;

function playerCount(players) {
  return players.filter((p) => p && p.name).length;
}

function normalizePlayer(raw) {
  if (!raw || !raw.name) return null;
  return {
    isGuest: !!raw.isGuest,
    memberId: raw.isGuest ? null : raw.memberId || null,
    name: String(raw.name).trim(),
    email: raw.email ? String(raw.email).trim() : null,
  };
}

function normalizePlayers(rawPlayers, maxPlayers) {
  const players = [];
  for (let i = 0; i < maxPlayers; i++) {
    players.push(normalizePlayer((rawPlayers || [])[i]));
  }
  if (!players[0]) {
    throw new Error("Player 1 (host) is required");
  }
  return players;
}

function findEvent(events, eventId) {
  return events.find((e) => e.id === eventId) || null;
}

function findTimeBlock(event, label) {
  return (event && event.timeBlocks.find((b) => b.label === label)) || null;
}

// Validates eventId/day/timeBlock against the live event config and fills in the
// implied day for single-day events. Returns the matched event/day/time-block.
function resolveEventDay(events, eventId, day, timeBlockLabel) {
  const event = findEvent(events, eventId);
  if (!event) {
    throw new Error("Invalid event");
  }
  let resolvedDay;
  if (event.days.length > 1) {
    if (!event.days.includes(day)) {
      throw new Error(`Day must be one of: ${event.days.join(", ")}`);
    }
    resolvedDay = day;
  } else {
    resolvedDay = event.days[0];
  }
  const block = findTimeBlock(event, timeBlockLabel);
  if (!block) {
    throw new Error(`Time block must be one of: ${event.timeBlocks.map((b) => b.label).join(", ")}`);
  }
  return { event, day: resolvedDay, block };
}

// Total players already signed up across every registration in this event/day/time-block.
function totalPlayersSignedUp(registrations, eventId, day, timeBlockLabel, excludeRegistrationId) {
  return registrations
    .filter(
      (r) =>
        r.eventId === eventId &&
        r.day === day &&
        r.timeBlock === timeBlockLabel &&
        r.id !== excludeRegistrationId
    )
    .reduce((sum, r) => sum + playerCount(r.players), 0);
}

// Throws if adding `addingCount` players to this block would exceed its capacity.
// A block with no capacity set is unlimited.
function checkCapacity(registrations, event, day, block, addingCount, excludeRegistrationId) {
  if (block.capacity == null) return;
  const current = totalPlayersSignedUp(registrations, event.id, day, block.label, excludeRegistrationId);
  if (current + addingCount > block.capacity) {
    const remaining = Math.max(0, block.capacity - current);
    throw new Error(
      `"${block.label}" only has ${remaining} spot(s) left (capacity ${block.capacity} total players).`
    );
  }
}

function sortRegistrations(registrations, events) {
  return registrations.sort((a, b) => {
    if (a.eventId !== b.eventId) return a.eventId.localeCompare(b.eventId);
    const event = findEvent(events, a.eventId);
    if (event && a.day !== b.day) {
      return event.days.indexOf(a.day) - event.days.indexOf(b.day);
    }
    if (event && a.timeBlock !== b.timeBlock) {
      const labels = event.timeBlocks.map((bl) => bl.label);
      return labels.indexOf(a.timeBlock) - labels.indexOf(b.timeBlock);
    }
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
}

function matchesFilter(registration, eventId, day) {
  if (eventId && registration.eventId !== eventId) return false;
  if (day && registration.day !== day) return false;
  return true;
}

function slugify(str) {
  return (
    String(str)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "event"
  );
}

function uniqueId(base, existingIds) {
  let id = base;
  let i = 2;
  while (existingIds.includes(id)) {
    id = `${base}-${i}`;
    i++;
  }
  return id;
}

// Accepts either an array of strings or a comma/newline-separated string.
function normalizeStringList(raw, label) {
  const list = Array.isArray(raw) ? raw : String(raw || "").split(/[\n,]/);
  const items = [];
  for (const entry of list) {
    const trimmed = String(entry).trim();
    if (trimmed && !items.includes(trimmed)) items.push(trimmed);
  }
  if (items.length === 0) {
    throw new Error(`At least one ${label} is required`);
  }
  return items;
}

// Time blocks carry an optional total-player capacity for that slot (across every group,
// not per group) — e.g. "8:30 AM - 11:30 AM" might cap out at 68 total players so singles
// can sign up without needing to fill or join a foursome themselves.
function normalizeTimeBlocks(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const blocks = [];
  for (const entry of list) {
    const label = String((entry && entry.label) || "").trim();
    if (!label || blocks.some((b) => b.label === label)) continue;
    let capacity = null;
    const rawCapacity = entry && entry.capacity;
    if (rawCapacity !== undefined && rawCapacity !== null && rawCapacity !== "") {
      const n = Number(rawCapacity);
      if (!Number.isInteger(n) || n < 1) {
        throw new Error(`Capacity for "${label}" must be a positive whole number`);
      }
      capacity = n;
    }
    blocks.push({ label, capacity });
  }
  if (blocks.length === 0) {
    throw new Error("At least one time block is required");
  }
  return blocks;
}

function normalizeMaxPlayers(raw) {
  if (raw === undefined || raw === null || raw === "") return DEFAULT_MAX_PLAYERS;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < MIN_MAX_PLAYERS || n > MAX_MAX_PLAYERS) {
    throw new Error(`Max players per group must be a whole number between ${MIN_MAX_PLAYERS} and ${MAX_MAX_PLAYERS}`);
  }
  return n;
}

// GET /api/members - roster for the autocomplete dropdown
router.get("/members", async (req, res, next) => {
  try {
    res.json(await store.getMembers());
  } catch (err) {
    next(err);
  }
});

// GET /api/events - the events sign-ups can be made against (Thursday, Weekend, ...)
router.get("/events", async (req, res, next) => {
  try {
    res.json(await store.getEvents());
  } catch (err) {
    next(err);
  }
});

// POST /api/events - pro shop creates a new event
router.post("/events", async (req, res, next) => {
  try {
    const { name, days: rawDays, timeBlocks: rawTimeBlocks, maxPlayers: rawMaxPlayers, noticeText } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Event name is required" });
    }
    let days, timeBlocks, maxPlayers;
    try {
      days = normalizeStringList(rawDays, "day");
      timeBlocks = normalizeTimeBlocks(rawTimeBlocks);
      maxPlayers = normalizeMaxPlayers(rawMaxPlayers);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const existing = await store.getEvents();
    const id = uniqueId(
      slugify(name),
      existing.map((e) => e.id)
    );
    const event = {
      id,
      name: String(name).trim(),
      days,
      timeBlocks,
      maxPlayers,
      noticeText: noticeText ? String(noticeText).trim() : null,
    };
    await store.addEvent(event);
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

// PUT /api/events/:id - pro shop edits an event
router.put("/events/:id", async (req, res, next) => {
  try {
    const { name, days: rawDays, timeBlocks: rawTimeBlocks, maxPlayers: rawMaxPlayers, noticeText } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Event name is required" });
    }
    let days, timeBlocks, maxPlayers;
    try {
      days = normalizeStringList(rawDays, "day");
      timeBlocks = normalizeTimeBlocks(rawTimeBlocks);
      maxPlayers = normalizeMaxPlayers(rawMaxPlayers);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const updated = await store.updateEvent(req.params.id, (existing) => ({
      ...existing,
      name: String(name).trim(),
      days,
      timeBlocks,
      maxPlayers,
      noticeText: noticeText ? String(noticeText).trim() : null,
    }));
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/events/:id - pro shop removes an event (blocked if registrations use it)
router.delete("/events/:id", async (req, res, next) => {
  try {
    const registrations = await store.getRegistrations();
    if (registrations.some((r) => r.eventId === req.params.id)) {
      return res.status(409).json({ error: "Cannot delete an event that has registrations" });
    }
    const ok = await store.deleteEvent(req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/registrations - full list, for the admin dashboard and group browsing.
// Optional ?eventId=&day= filters.
router.get("/registrations", async (req, res, next) => {
  try {
    const { eventId, day } = req.query;
    const [registrations, events] = await Promise.all([store.getRegistrations(), store.getEvents()]);
    const filtered = registrations.filter((r) => matchesFilter(r, eventId, day));
    res.json(sortRegistrations(filtered, events));
  } catch (err) {
    next(err);
  }
});

// GET /api/registrations/open - open groups with room for more players.
// Optional ?eventId=&day= filters.
router.get("/registrations/open", async (req, res, next) => {
  try {
    const { eventId, day } = req.query;
    const [registrations, events] = await Promise.all([store.getRegistrations(), store.getEvents()]);
    const open = registrations.filter(
      (r) =>
        r.isOpenGroup && playerCount(r.players) < r.players.length && matchesFilter(r, eventId, day)
    );
    res.json(sortRegistrations(open, events));
  } catch (err) {
    next(err);
  }
});

// GET /api/registrations/capacity - total players signed up per time block, for showing
// remaining spots on the sign-up form. Optional ?eventId=&day= filters (recommended).
router.get("/registrations/capacity", async (req, res, next) => {
  try {
    const { eventId, day } = req.query;
    const registrations = await store.getRegistrations();
    const filtered = registrations.filter((r) => matchesFilter(r, eventId, day));
    const filled = {};
    for (const r of filtered) {
      filled[r.timeBlock] = (filled[r.timeBlock] || 0) + playerCount(r.players);
    }
    res.json(filled);
  } catch (err) {
    next(err);
  }
});

// GET /api/registrations/export.csv - admin CSV export. Optional ?eventId=&day= filters.
router.get("/registrations/export.csv", async (req, res, next) => {
  try {
    const { eventId, day } = req.query;
    const [registrations, events] = await Promise.all([store.getRegistrations(), store.getEvents()]);
    const filtered = registrations
      .filter((r) => matchesFilter(r, eventId, day))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const maxPlayers = filtered.reduce((max, r) => Math.max(max, r.players.length), DEFAULT_MAX_PLAYERS);

    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const playerLabel = (p) => (p ? `${p.name}${p.isGuest ? " (Guest)" : ""}` : "");
    const eventLabel = (id) => (findEvent(events, id) || {}).name || id;

    const header = [
      "Queue #",
      "Original Timestamp",
      "Event",
      "Day",
      "Time Block",
      "Target Time",
      ...Array.from({ length: maxPlayers }, (_, i) => `Player ${i + 1}`),
      "Notes",
    ];
    const rows = filtered.map((r, i) => [
      i + 1,
      r.createdAt,
      eventLabel(r.eventId),
      r.day,
      r.timeBlock,
      r.targetTime || "",
      ...Array.from({ length: maxPlayers }, (_, p) => playerLabel(r.players[p])),
      r.notes || "",
    ]);

    const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="tee-time-signups.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// GET /api/registrations/:id - fetch one, for the manage-by-link page
router.get("/registrations/:id", async (req, res, next) => {
  try {
    const registration = await store.getRegistration(req.params.id);
    if (!registration) return res.status(404).json({ error: "Not found" });
    res.json(registration);
  } catch (err) {
    next(err);
  }
});

// POST /api/registrations - create a new registration
router.post("/registrations", async (req, res, next) => {
  try {
    const { eventId, day, timeBlock, targetTime, notes, isOpenGroup, players: rawPlayers } = req.body;
    const [events, registrations] = await Promise.all([store.getEvents(), store.getRegistrations()]);
    let resolved;
    try {
      resolved = resolveEventDay(events, eventId, day, timeBlock);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    let players;
    try {
      players = normalizePlayers(rawPlayers, resolved.event.maxPlayers);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    try {
      checkCapacity(registrations, resolved.event, resolved.day, resolved.block, playerCount(players));
    } catch (err) {
      return res.status(409).json({ error: err.message });
    }
    const openGroup = !!isOpenGroup && playerCount(players) < players.length;

    const now = new Date().toISOString();
    const registration = {
      id: crypto.randomBytes(12).toString("hex"),
      createdAt: now,
      updatedAt: now,
      eventId: resolved.event.id,
      day: resolved.day,
      timeBlock,
      targetTime: targetTime || null,
      players,
      notes: notes ? String(notes).trim() : null,
      isOpenGroup: openGroup,
    };
    await store.addRegistration(registration);
    res.status(201).json(registration);
  } catch (err) {
    next(err);
  }
});

// PUT /api/registrations/:id - edit an existing registration (via its unique link)
router.put("/registrations/:id", async (req, res, next) => {
  try {
    const { eventId, day, timeBlock, targetTime, notes, isOpenGroup, players: rawPlayers } = req.body;
    const [events, registrations] = await Promise.all([store.getEvents(), store.getRegistrations()]);
    let resolved;
    try {
      resolved = resolveEventDay(events, eventId, day, timeBlock);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    let players;
    try {
      players = normalizePlayers(rawPlayers, resolved.event.maxPlayers);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    try {
      checkCapacity(
        registrations,
        resolved.event,
        resolved.day,
        resolved.block,
        playerCount(players),
        req.params.id
      );
    } catch (err) {
      return res.status(409).json({ error: err.message });
    }
    const openGroup = !!isOpenGroup && playerCount(players) < players.length;

    const updated = await store.updateRegistration(req.params.id, (existing) => ({
      ...existing,
      eventId: resolved.event.id,
      day: resolved.day,
      timeBlock,
      targetTime: targetTime || null,
      players,
      notes: notes ? String(notes).trim() : null,
      isOpenGroup: openGroup,
      updatedAt: new Date().toISOString(),
    }));
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/registrations/:id/join - append a player into the next open slot
router.post("/registrations/:id/join", async (req, res, next) => {
  try {
    const player = normalizePlayer(req.body.player);
    if (!player) return res.status(400).json({ error: "Player name is required" });

    const [events, registrations] = await Promise.all([store.getEvents(), store.getRegistrations()]);
    const existing = registrations.find((r) => r.id === req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });

    const event = findEvent(events, existing.eventId);
    const block = event && findTimeBlock(event, existing.timeBlock);
    if (event && block) {
      try {
        checkCapacity(registrations, event, existing.day, block, 1, existing.id);
      } catch (err) {
        return res.status(409).json({ error: err.message });
      }
    }

    const updated = await store.updateRegistration(req.params.id, (reg) => {
      const slotIndex = reg.players.findIndex((p) => !p);
      if (slotIndex === -1) {
        throw new Error("This group is already full");
      }
      const players = [...reg.players];
      players[slotIndex] = player;
      return {
        ...reg,
        players,
        isOpenGroup: reg.isOpenGroup && playerCount(players) < players.length,
        updatedAt: new Date().toISOString(),
      };
    });
    res.json(updated);
  } catch (err) {
    if (err.message === "This group is already full") {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
});

// DELETE /api/registrations/:id - cancel a registration (via its unique link)
router.delete("/registrations/:id", async (req, res, next) => {
  try {
    const ok = await store.deleteRegistration(req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
