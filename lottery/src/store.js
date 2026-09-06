const fs = require("fs/promises");
const path = require("path");

const REGISTRATIONS_FILE = path.join(__dirname, "..", "data", "registrations.json");
const MEMBERS_FILE = path.join(__dirname, "..", "data", "members.json");
const EVENTS_FILE = path.join(__dirname, "..", "data", "events.json");

// Serializes reads/writes per file so concurrent requests can't clobber each other.
const locks = new Map();
function withLock(file, fn) {
  const prev = locks.get(file) || Promise.resolve();
  const result = prev.then(fn);
  locks.set(
    file,
    result.catch(() => {})
  );
  return result;
}

async function readJSON(file) {
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw);
}

async function writeJSON(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n");
}

async function addItem(file, item) {
  return withLock(file, async () => {
    const items = await readJSON(file);
    items.push(item);
    await writeJSON(file, items);
    return item;
  });
}

async function updateItem(file, id, updater) {
  return withLock(file, async () => {
    const items = await readJSON(file);
    const index = items.findIndex((i) => i.id === id);
    if (index === -1) return null;
    const updated = updater(items[index]);
    items[index] = updated;
    await writeJSON(file, items);
    return updated;
  });
}

async function deleteItem(file, id) {
  return withLock(file, async () => {
    const items = await readJSON(file);
    const index = items.findIndex((i) => i.id === id);
    if (index === -1) return false;
    items.splice(index, 1);
    await writeJSON(file, items);
    return true;
  });
}

// Registrations

async function getRegistrations() {
  return withLock(REGISTRATIONS_FILE, () => readJSON(REGISTRATIONS_FILE));
}

async function getRegistration(id) {
  const registrations = await getRegistrations();
  return registrations.find((r) => r.id === id) || null;
}

async function addRegistration(registration) {
  return addItem(REGISTRATIONS_FILE, registration);
}

async function updateRegistration(id, updater) {
  return updateItem(REGISTRATIONS_FILE, id, updater);
}

async function deleteRegistration(id) {
  return deleteItem(REGISTRATIONS_FILE, id);
}

// Members (read-only for now; not pro-shop editable yet)

async function getMembers() {
  return readJSON(MEMBERS_FILE);
}

// Events

async function getEvents() {
  return withLock(EVENTS_FILE, () => readJSON(EVENTS_FILE));
}

async function getEvent(id) {
  const events = await getEvents();
  return events.find((e) => e.id === id) || null;
}

async function addEvent(event) {
  return addItem(EVENTS_FILE, event);
}

async function updateEvent(id, updater) {
  return updateItem(EVENTS_FILE, id, updater);
}

async function deleteEvent(id) {
  return deleteItem(EVENTS_FILE, id);
}

module.exports = {
  getRegistrations,
  getRegistration,
  addRegistration,
  updateRegistration,
  deleteRegistration,
  getMembers,
  getEvents,
  getEvent,
  addEvent,
  updateEvent,
  deleteEvent,
};
