const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const typeLabels = {
  work: "Work",
  personal: "Personal",
  appointment: "Appointment",
  family: "Family",
  other: "Other"
};

const storageKey = "month-at-a-glance-schedule";

const scheduleTitle = document.querySelector("#scheduleTitle");
const monthSelect = document.querySelector("#monthSelect");
const yearInput = document.querySelector("#yearInput");
const eventCount = document.querySelector("#eventCount");
const monthSummary = document.querySelector("#monthSummary");
const shareButton = document.querySelector("#shareButton");
const printButton = document.querySelector("#printButton");
const shareBox = document.querySelector("#shareBox");
const shareStatus = document.querySelector("#shareStatus");
const shareUrl = document.querySelector("#shareUrl");
const previousMonth = document.querySelector("#previousMonth");
const nextMonth = document.querySelector("#nextMonth");
const calendarHeading = document.querySelector("#calendarHeading");
const calendarGrid = document.querySelector("#calendarGrid");
const selectedDateLabel = document.querySelector("#selectedDateLabel");
const eventForm = document.querySelector("#eventForm");
const editingEventId = document.querySelector("#editingEventId");
const eventTitle = document.querySelector("#eventTitle");
const eventStart = document.querySelector("#eventStart");
const eventEnd = document.querySelector("#eventEnd");
const eventType = document.querySelector("#eventType");
const eventNote = document.querySelector("#eventNote");
const saveEvent = document.querySelector("#saveEvent");
const clearForm = document.querySelector("#clearForm");
const clearDay = document.querySelector("#clearDay");
const eventList = document.querySelector("#eventList");
const eventTemplate = document.querySelector("#eventTemplate");
const readonlyNotice = document.querySelector("#readonlyNotice");

let isReadOnly = false;

const today = new Date();

let state = {
  title: "",
  month: today.getMonth(),
  year: today.getFullYear(),
  selectedDate: toDateKey(today),
  events: {}
};

function init() {
  populateMonths();
  state = loadInitialState();
  state.selectedDate = getSafeSelectedDate();
  syncControls();
  bindEvents();
  render();
}

function populateMonths() {
  monthNames.forEach((month, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = month;
    monthSelect.append(option);
  });
}

function loadInitialState() {
  const sharedState = readSharedState();

  if (sharedState) {
    isReadOnly = true;
    return sharedState;
  }

  const savedState = localStorage.getItem(storageKey);

  if (savedState) {
    try {
      return normalizeState(JSON.parse(savedState));
    } catch {
      localStorage.removeItem(storageKey);
    }
  }

  return normalizeState(state);
}

function readSharedState() {
  const prefix = "#schedule=";

  if (!window.location.hash.startsWith(prefix)) {
    return null;
  }

  const hash = window.location.hash.slice(prefix.length);

  try {
    const paddedHash = hash.padEnd(hash.length + (4 - (hash.length % 4)) % 4, "=");
    const json = decodeURIComponent(atob(paddedHash.replace(/-/g, "+").replace(/_/g, "/")));
    return normalizeState(JSON.parse(json));
  } catch {
    shareBox.hidden = false;
    shareStatus.textContent = "This share link could not be read. You can keep planning from a fresh schedule.";
    return null;
  }
}

function normalizeState(rawState) {
  const safeState = rawState && typeof rawState === "object" ? rawState : {};
  const month = clamp(Number(safeState.month), 0, 11, today.getMonth());
  const year = clamp(Number(safeState.year), 1900, 2200, today.getFullYear());
  const selectedDate = isValidDateKey(safeState.selectedDate) ? safeState.selectedDate : toDateKey(new Date(year, month, 1));
  const events = safeState.events && typeof safeState.events === "object" ? safeState.events : {};

  return {
    title: typeof safeState.title === "string" ? safeState.title : "",
    month,
    year,
    selectedDate,
    events: normalizeEvents(events)
  };
}

function normalizeEvents(events) {
  return Object.entries(events).reduce((safeEvents, [dateKey, dayEvents]) => {
    if (!isValidDateKey(dateKey) || !Array.isArray(dayEvents)) {
      return safeEvents;
    }

    safeEvents[dateKey] = dayEvents
      .filter((event) => event && typeof event.title === "string" && event.title.trim())
      .map((event) => ({
        id: typeof event.id === "string" ? event.id : createId(),
        title: event.title.trim(),
        start: typeof event.start === "string" ? event.start : "",
        end: typeof event.end === "string" ? event.end : "",
        type: typeLabels[event.type] ? event.type : "other",
        note: typeof event.note === "string" ? event.note : ""
      }));

    if (!safeEvents[dateKey].length) {
      delete safeEvents[dateKey];
    }

    return safeEvents;
  }, {});
}

function bindEvents() {
  scheduleTitle.addEventListener("input", () => {
    if (isReadOnly) {
      return;
    }

    state.title = scheduleTitle.value;
    persistAndRender();
  });

  monthSelect.addEventListener("change", () => {
    if (isReadOnly) {
      return;
    }

    state.month = Number(monthSelect.value);
    state.selectedDate = getSafeSelectedDate();
    persistAndRender();
  });

  yearInput.addEventListener("change", () => {
    if (isReadOnly) {
      return;
    }

    state.year = clamp(Number(yearInput.value), 1900, 2200, today.getFullYear());
    state.selectedDate = getSafeSelectedDate();
    persistAndRender();
  });

  previousMonth.addEventListener("click", () => moveMonth(-1));
  nextMonth.addEventListener("click", () => moveMonth(1));
  shareButton.addEventListener("click", copyShareLink);
  printButton.addEventListener("click", () => window.print());
  clearForm.addEventListener("click", resetForm);
  clearDay.addEventListener("click", clearSelectedDay);

  eventForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSelectedEvent();
  });
}

function syncControls() {
  scheduleTitle.value = state.title;
  monthSelect.value = state.month;
  yearInput.value = state.year;
}

function render() {
  syncControls();
  renderMode();
  renderCalendar();
  renderDayDetails();
  renderSummary();
}

function renderMode() {
  document.body.classList.toggle("is-read-only", isReadOnly);
  readonlyNotice.hidden = !isReadOnly;
  eventForm.hidden = isReadOnly;
  clearDay.hidden = isReadOnly;
  scheduleTitle.disabled = isReadOnly;
  monthSelect.disabled = isReadOnly;
  yearInput.disabled = isReadOnly;
  previousMonth.disabled = isReadOnly;
  nextMonth.disabled = isReadOnly;
  shareButton.textContent = isReadOnly ? "Copy link" : "Copy share link";
}

function renderCalendar() {
  const monthLabel = `${monthNames[state.month]} ${state.year}`;
  calendarHeading.textContent = state.title.trim() ? `${state.title.trim()} - ${monthLabel}` : monthLabel;
  calendarGrid.innerHTML = "";

  const firstDay = new Date(state.year, state.month, 1);
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
  const previousMonthDays = new Date(state.year, state.month, 0).getDate();
  const startOffset = firstDay.getDay();
  const cellsNeeded = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  for (let index = 0; index < cellsNeeded; index += 1) {
    const dayNumber = index - startOffset + 1;
    const cellDate = getCellDate(dayNumber, previousMonthDays, daysInMonth);
    const dateKey = toDateKey(cellDate);
    const isCurrentMonth = cellDate.getMonth() === state.month;
    const events = state.events[dateKey] || [];
    const cell = document.createElement("button");

    cell.type = "button";
    cell.className = "day-cell";
    cell.setAttribute("aria-label", `${formatLongDate(cellDate)}, ${events.length} item${events.length === 1 ? "" : "s"}`);

    if (!isCurrentMonth) {
      cell.classList.add("is-muted");
    }

    if (dateKey === state.selectedDate) {
      cell.classList.add("is-selected");
    }

    if (dateKey === toDateKey(today)) {
      cell.classList.add("is-today");
    }

    cell.innerHTML = `
      <span class="date-number">${cellDate.getDate()}</span>
      <span class="day-preview"></span>
    `;

    const preview = cell.querySelector(".day-preview");
    events.slice(0, 3).forEach((event) => {
      const pill = document.createElement("span");
      pill.className = `preview-pill ${event.type}`;
      pill.textContent = `${formatTimeRange(event)} ${event.title}`.trim();
      preview.append(pill);
    });

    if (events.length > 3) {
      const more = document.createElement("span");
      more.className = "more-pill";
      more.textContent = `+${events.length - 3} more`;
      preview.append(more);
    }

    cell.addEventListener("click", () => {
      if (isReadOnly && !isCurrentMonth) {
        return;
      }

      state.selectedDate = dateKey;

      if (isReadOnly) {
        render();
        return;
      }

      state.month = cellDate.getMonth();
      state.year = cellDate.getFullYear();
      resetForm();
      persistAndRender();
    });

    calendarGrid.append(cell);
  }
}

function getCellDate(dayNumber, previousMonthDays, daysInMonth) {
  if (dayNumber < 1) {
    return new Date(state.year, state.month - 1, previousMonthDays + dayNumber);
  }

  if (dayNumber > daysInMonth) {
    return new Date(state.year, state.month + 1, dayNumber - daysInMonth);
  }

  return new Date(state.year, state.month, dayNumber);
}

function renderDayDetails() {
  const selectedDate = parseDateKey(state.selectedDate);
  const events = getSelectedDayEvents();
  selectedDateLabel.textContent = formatLongDate(selectedDate);
  eventList.innerHTML = "";
  clearDay.disabled = isReadOnly || events.length === 0;

  if (!events.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = isReadOnly ? "No items scheduled for this day." : "No items yet. Add one above when you are ready.";
    eventList.append(emptyState);
    return;
  }

  events.forEach((event) => {
    const card = eventTemplate.content.firstElementChild.cloneNode(true);
    card.classList.add(event.type);
    card.querySelector(".event-time").textContent = `${typeLabels[event.type]}${formatTimeRange(event) ? ` - ${formatTimeRange(event)}` : ""}`;
    card.querySelector("h4").textContent = event.title;
    card.querySelector(".event-note").textContent = event.note;
    card.querySelector(".event-note").hidden = !event.note;

    const eventActions = card.querySelector(".event-actions");
    eventActions.hidden = isReadOnly;

    if (!isReadOnly) {
      card.querySelector(".edit-event").addEventListener("click", () => editEvent(event.id));
      card.querySelector(".delete-event").addEventListener("click", () => deleteEvent(event.id));
    }

    eventList.append(card);
  });
}

function renderSummary() {
  const events = Object.entries(state.events);
  const totalEvents = events.reduce((total, [, dayEvents]) => total + dayEvents.length, 0);
  const visibleMonthEvents = events.reduce((total, [dateKey, dayEvents]) => {
    const date = parseDateKey(dateKey);
    return date.getMonth() === state.month && date.getFullYear() === state.year ? total + dayEvents.length : total;
  }, 0);

  eventCount.textContent = `${totalEvents} scheduled item${totalEvents === 1 ? "" : "s"}`;
  monthSummary.textContent = `${visibleMonthEvents} item${visibleMonthEvents === 1 ? "" : "s"} in ${monthNames[state.month]}`;
}

function saveSelectedEvent() {
  if (isReadOnly) {
    return;
  }

  const title = eventTitle.value.trim();

  if (!title) {
    return;
  }

  const event = {
    id: editingEventId.value || createId(),
    title,
    start: eventStart.value,
    end: eventEnd.value,
    type: eventType.value,
    note: eventNote.value.trim()
  };

  const dayEvents = getSelectedDayEvents();
  const eventIndex = dayEvents.findIndex((dayEvent) => dayEvent.id === event.id);

  if (eventIndex >= 0) {
    dayEvents[eventIndex] = event;
  } else {
    dayEvents.push(event);
  }

  state.events[state.selectedDate] = sortEvents(dayEvents);
  resetForm();
  persistAndRender();
}

function editEvent(eventId) {
  if (isReadOnly) {
    return;
  }

  const event = getSelectedDayEvents().find((dayEvent) => dayEvent.id === eventId);

  if (!event) {
    return;
  }

  editingEventId.value = event.id;
  eventTitle.value = event.title;
  eventStart.value = event.start;
  eventEnd.value = event.end;
  eventType.value = event.type;
  eventNote.value = event.note;
  saveEvent.textContent = "Save changes";
  eventTitle.focus();
}

function deleteEvent(eventId) {
  if (isReadOnly) {
    return;
  }

  const nextEvents = getSelectedDayEvents().filter((event) => event.id !== eventId);

  if (nextEvents.length) {
    state.events[state.selectedDate] = nextEvents;
  } else {
    delete state.events[state.selectedDate];
  }

  resetForm();
  persistAndRender();
}

function clearSelectedDay() {
  if (isReadOnly || !getSelectedDayEvents().length) {
    return;
  }

  delete state.events[state.selectedDate];
  resetForm();
  persistAndRender();
}

function resetForm() {
  editingEventId.value = "";
  eventForm.reset();
  eventType.value = "work";
  saveEvent.textContent = "Add item";
}

function moveMonth(direction) {
  if (isReadOnly) {
    return;
  }

  const nextDate = new Date(state.year, state.month + direction, 1);
  state.month = nextDate.getMonth();
  state.year = nextDate.getFullYear();
  state.selectedDate = toDateKey(nextDate);
  resetForm();
  persistAndRender();
}

async function copyShareLink() {
  const url = buildShareUrl();
  shareBox.hidden = false;
  shareUrl.value = url;
  shareUrl.select();

  try {
    await navigator.clipboard.writeText(url);
    shareStatus.textContent = "Share link copied.";
  } catch {
    shareStatus.textContent = "Copy this link to share your schedule.";
  }
}

function buildShareUrl() {
  const encoded = btoa(encodeURIComponent(JSON.stringify(state)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${window.location.href.split("#")[0]}#schedule=${encoded}`;
}

function persistAndRender() {
  if (!isReadOnly) {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  render();
}

function getSelectedDayEvents() {
  return [...(state.events[state.selectedDate] || [])];
}

function getSafeSelectedDate() {
  const selected = parseDateKey(state.selectedDate);
  const lastDay = new Date(state.year, state.month + 1, 0).getDate();
  const safeDay = Math.min(selected.getDate(), lastDay);
  return toDateKey(new Date(state.year, state.month, safeDay));
}

function sortEvents(events) {
  return [...events].sort((a, b) => {
    if (!a.start && !b.start) {
      return a.title.localeCompare(b.title);
    }

    if (!a.start) {
      return 1;
    }

    if (!b.start) {
      return -1;
    }

    return a.start.localeCompare(b.start);
  });
}

function formatTimeRange(event) {
  if (event.start && event.end) {
    return `${formatTime(event.start)}-${formatTime(event.end)}`;
  }

  if (event.start) {
    return formatTime(event.start);
  }

  if (event.end) {
    return `Ends ${formatTime(event.end)}`;
  }

  return "";
}

function formatTime(value) {
  const [hour, minute] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute);

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isValidDateKey(dateKey) {
  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return false;
  }

  const date = parseDateKey(dateKey);
  return toDateKey(date) === dateKey;
}

function clamp(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

init();
