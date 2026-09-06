const RELATIVE_TARGET_OPTIONS = [
  "As early as possible in block",
  "Middle of block",
  "As late as possible in block",
];

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const body = isJson ? await res.json() : null;
  if (!res.ok) {
    throw new Error((body && body.error) || `Request failed (${res.status})`);
  }
  return body;
}

async function loadMembers() {
  return fetchJSON("/api/members");
}

async function loadEvents() {
  return fetchJSON("/api/events");
}

// selectedEventId: an event id to pre-select, undefined to default to the first event,
// or null to leave every radio unchecked (used by the "All Events" admin filter).
function eventRadiosHTML(events, selectedEventId, name) {
  const target = selectedEventId === null ? null : selectedEventId || events[0].id;
  return events
    .map(
      (ev) =>
        `<label><input type="radio" name="${name}" value="${escapeHtml(ev.id)}" ${
          ev.id === target ? "checked" : ""
        }/> ${escapeHtml(ev.name)}</label>`
    )
    .join("");
}

// Renders day radios for `event` into `containerEl`, or clears/hides it for single-day events.
function renderDayRadios(containerEl, event, selectedDay, name) {
  if (!event || event.days.length <= 1) {
    containerEl.innerHTML = "";
    containerEl.style.display = "none";
    return;
  }
  containerEl.style.display = "";
  containerEl.innerHTML = event.days
    .map(
      (d) =>
        `<label><input type="radio" name="${name}" value="${escapeHtml(d)}" ${
          d === selectedDay ? "checked" : ""
        }/> ${escapeHtml(d)}</label>`
    )
    .join("");
  if (!selectedDay || !event.days.includes(selectedDay)) {
    const first = containerEl.querySelector("input");
    if (first) first.checked = true;
  }
}

async function loadTimeBlockFillCounts(eventId, day) {
  const params = new URLSearchParams({ eventId });
  if (day) params.set("day", day);
  return fetchJSON(`/api/registrations/capacity?${params.toString()}`);
}

// Renders time block radios for `event` (each event defines its own set of blocks, and
// each block may cap the total number of players across every group signed up for it —
// not a per-group limit, so singles can sign up without joining a foursome). `filled` is
// an optional {label: playerCount} map used to show remaining spots and disable full blocks.
function renderTimeBlockRadios(containerEl, event, selectedBlock, name, filled) {
  const blocks = event ? event.timeBlocks : [];
  filled = filled || {};
  containerEl.innerHTML = blocks
    .map((b) => {
      const filledCount = filled[b.label] || 0;
      const isFull = b.capacity != null && filledCount >= b.capacity;
      const capacityText =
        b.capacity != null ? ` <span class="muted">(${filledCount}/${b.capacity})</span>` : "";
      return `<label class="${isFull ? "full" : ""}"><input type="radio" name="${name}" value="${escapeHtml(
        b.label
      )}" ${b.label === selectedBlock ? "checked" : ""} ${isFull ? "disabled" : ""}/> ${escapeHtml(
        b.label
      )}${capacityText}</label>`;
    })
    .join("");
  const labels = blocks.map((b) => b.label);
  if (!selectedBlock || !labels.includes(selectedBlock)) {
    const first = containerEl.querySelector("input:not(:disabled)") || containerEl.querySelector("input");
    if (first) first.checked = true;
  }
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function populateTargetTimeSelect(selectEl, selectedValue) {
  selectEl.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "No preference";
  selectEl.appendChild(blank);

  for (const opt of RELATIVE_TARGET_OPTIONS) {
    const el = document.createElement("option");
    el.value = opt;
    el.textContent = opt;
    if (opt === selectedValue) el.selected = true;
    selectEl.appendChild(el);
  }
}

// Builds the DOM for one player slot. `index` is 0-based; slot 0 is required.
function createPlayerSlotEl(index, members, existingPlayer) {
  const wrap = document.createElement("div");
  wrap.className = "player-slot";
  wrap.dataset.index = String(index);

  const isGuest = existingPlayer ? !!existingPlayer.isGuest : false;
  const label = `Player ${index + 1}`;
  const required = index === 0;

  wrap.innerHTML = `
    <h3>
      ${label}
      <label class="guest-toggle">
        <input type="checkbox" class="guest-checkbox" ${isGuest ? "checked" : ""} />
        Guest
      </label>
    </h3>
    <div class="member-fields" style="${isGuest ? "display:none" : ""}">
      <div class="combobox">
        <input
          type="text"
          class="member-search"
          autocomplete="off"
          placeholder="${required ? "Search members..." : "Search members (optional)..."}"
        />
        <input type="hidden" class="member-id" value="" />
        <div class="combobox-options" hidden></div>
      </div>
    </div>
    <div class="guest-fields field-row" style="${isGuest ? "" : "display:none"}">
      <div>
        <label>Guest name</label>
        <input type="text" class="guest-name" value="${
          existingPlayer && isGuest ? escapeHtml(existingPlayer.name) : ""
        }" placeholder="First Last" />
      </div>
      <div>
        <label>Guest email</label>
        <input type="email" class="guest-email" value="${
          existingPlayer && isGuest ? escapeHtml(existingPlayer.email || "") : ""
        }" placeholder="guest@example.com" />
      </div>
    </div>
  `;

  const checkbox = wrap.querySelector(".guest-checkbox");
  const memberFields = wrap.querySelector(".member-fields");
  const guestFields = wrap.querySelector(".guest-fields");
  checkbox.addEventListener("change", () => {
    memberFields.style.display = checkbox.checked ? "none" : "";
    guestFields.style.display = checkbox.checked ? "" : "none";
  });

  setupMemberCombobox(
    wrap.querySelector(".combobox"),
    members,
    existingPlayer && !isGuest ? existingPlayer.memberId : null
  );

  return wrap;
}

// Wires up filter-as-you-type behavior for a member search box: typing filters the
// member list live, and a hidden input tracks the selected member's id (empty until
// a member is actually chosen, so a half-typed name doesn't silently match someone).
function setupMemberCombobox(container, members, existingMemberId) {
  const input = container.querySelector(".member-search");
  const hiddenId = container.querySelector(".member-id");
  const optionsEl = container.querySelector(".combobox-options");
  let filtered = [];
  let activeIndex = -1;

  function closeOptions() {
    optionsEl.hidden = true;
    optionsEl.innerHTML = "";
    activeIndex = -1;
  }

  function selectMember(member) {
    input.value = member.name;
    hiddenId.value = member.id;
    closeOptions();
  }

  function setActive(index) {
    activeIndex = index;
    const opts = optionsEl.querySelectorAll(".combobox-option");
    opts.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
    if (opts[activeIndex]) opts[activeIndex].scrollIntoView({ block: "nearest" });
  }

  function renderOptions(query) {
    const q = query.trim().toLowerCase();
    filtered = q ? members.filter((m) => m.name.toLowerCase().includes(q)) : members;
    activeIndex = -1;

    if (filtered.length === 0) {
      optionsEl.innerHTML = `<div class="combobox-empty">No matching members</div>`;
      optionsEl.hidden = false;
      return;
    }

    optionsEl.innerHTML = filtered
      .map((m, i) => `<div class="combobox-option" data-index="${i}">${escapeHtml(m.name)}</div>`)
      .join("");
    optionsEl.hidden = false;
    optionsEl.querySelectorAll(".combobox-option").forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectMember(filtered[Number(el.dataset.index)]);
      });
    });
  }

  input.addEventListener("input", () => {
    hiddenId.value = "";
    renderOptions(input.value);
  });

  input.addEventListener("focus", () => {
    renderOptions(input.value);
  });

  input.addEventListener("keydown", (e) => {
    const count = optionsEl.querySelectorAll(".combobox-option").length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (count) setActive(Math.min(activeIndex + 1, count - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (count) setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && filtered[activeIndex]) {
        e.preventDefault();
        selectMember(filtered[activeIndex]);
      }
    } else if (e.key === "Escape") {
      closeOptions();
    }
  });

  input.addEventListener("blur", () => {
    if (!hiddenId.value) {
      const typed = input.value.trim().toLowerCase();
      const exactMatch = members.find((m) => m.name.toLowerCase() === typed);
      if (exactMatch) selectMember(exactMatch);
    }
    setTimeout(closeOptions, 100);
  });

  if (existingMemberId) {
    const member = members.find((m) => m.id === existingMemberId);
    if (member) selectMember(member);
  }
}

// Reads a player slot's DOM back into {isGuest, memberId, name, email} or null if left empty.
function readPlayerSlot(slotEl, members) {
  const isGuest = slotEl.querySelector(".guest-checkbox").checked;
  if (isGuest) {
    const name = slotEl.querySelector(".guest-name").value.trim();
    const email = slotEl.querySelector(".guest-email").value.trim();
    if (!name) return null;
    return { isGuest: true, memberId: null, name, email: email || null };
  }
  const memberId = slotEl.querySelector(".member-id").value;
  if (!memberId) return null;
  const member = members.find((m) => m.id === memberId);
  return { isGuest: false, memberId, name: member ? member.name : "", email: member ? member.email : null };
}
