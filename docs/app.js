"use strict";

// Browser-only demo. Keine Apple-Pushes und keine echte iOS-Live-Aktivität.
const API_BASE = "https://v6.db.transport.rest";
const AUTO_REFRESH_MS = 60_000;
const $ = (selector) => document.querySelector(selector);

const state = {
  mode: "demo",
  journeys: [],
  selectedId: null,
  autoRefresh: true,
  loading: false,
  lastUpdated: null,
  requestGeneration: 0
};

const elements = {
  form: $("#route-form"),
  from: $("#from"),
  to: $("#to"),
  search: $("#search"),
  swap: $("#swap"),
  demo: $("#demo"),
  refresh: $("#refresh"),
  auto: $("#auto"),
  status: $("#status"),
  list: $("#journey-list"),
  count: $("#result-count"),
  updated: $("#last-updated"),
  mode: $("#data-mode"),
  detail: $("#journey-detail"),
  phoneTime: $("#phone-status-time"),
  clock: $("#lock-clock"),
  date: $("#lock-date"),
  liveLine: $("#live-line"),
  liveDelay: $("#live-delay"),
  liveNext: $("#live-next"),
  liveProgress: $("#live-progress"),
  liveDestination: $("#live-destination"),
  liveArrival: $("#live-arrival"),
  liveRemaining: $("#live-remaining")
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char];
  });
}

function dateFrom(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clockTime(value) {
  const date = value instanceof Date ? value : dateFrom(value);
  if (!date) return "–:–";
  return new Intl.DateTimeFormat("de-DE", {hour:"2-digit",minute:"2-digit"}).format(date);
}

function minuteDuration(value) {
  return Math.max(0, Math.ceil(value / 60000));
}

function cap(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function delayText(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Keine Echtzeitangabe";
  }
  if (value > 0) return "+" + value + " Min. Verspätung";
  if (value < 0) return Math.abs(value) + " Min. früher";
  return "Pünktlich";
}

function delayClass(value) {
  if (value === null || value === undefined) return "delay-unknown";
  return value > 0 ? "delay-bad" : "delay-good";
}

function displayStatus(message, kind = "info") {
  elements.status.textContent = message;
  elements.status.dataset.kind = kind;
}

function makeDemo() {
  const now = Date.now();
  const dep = new Date(now - 9 * 60000).toISOString();
  const arr = new Date(now + 21 * 60000).toISOString();
  return {
    id: "demo",
    isDemo: true,
    origin: "Kronberg (Taunus)",
    destination: "Frankfurt (Main) Hbf",
    departure: dep,
    arrival: arr,
    line: "S4",
    nextStop: "Frankfurt-Rödelheim",
    arrivalDelay: 300,
    refreshToken: null,
    cancelled: false,
    legs: [{
      line: "S4",
      from: "Kronberg (Taunus)",
      to: "Frankfurt (Main) Hbf",
      departure: dep,
      arrival: arr,
      walking: false
    }]
  };
}

function currentJourney() {
  return state.journeys.find((journey) => journey.id === state.selectedId) || null;
}

function formatLine(leg) {
  return leg.walking ? "Fußweg" : (leg.line && leg.line.name) || leg.name || "Verbindung";
}

function normalizeJourney(journey, id) {
  if (!journey || !Array.isArray(journey.legs) || !journey.legs.length) return null;
  const legs = journey.legs;
  const first = legs[0];
  const last = legs[legs.length - 1];
  const departure = first.departure || first.plannedDeparture;
  const arrival = last.arrival || last.plannedArrival;
  if (!dateFrom(departure) || !dateFrom(arrival)) return null;

  const firstTransit = legs.find((leg) => !leg.walking && leg.line);
  const lastTransit = [...legs].reverse().find((leg) => !leg.walking);
  const delaySource = lastTransit || last;
  let arrivalDelay = Number.isFinite(delaySource.arrivalDelay)
    ? delaySource.arrivalDelay : null;
  if (arrivalDelay === null && delaySource.arrival && delaySource.plannedArrival) {
    arrivalDelay = Math.round(
      (dateFrom(delaySource.arrival) - dateFrom(delaySource.plannedArrival)) / 1000
    );
  }

  return {
    id: id || "journey-" + Math.random().toString(36).slice(2),
    isDemo: false,
    origin: first.origin?.name || "Start",
    destination: last.destination?.name || "Ziel",
    departure,
    arrival,
    line: firstTransit ? formatLine(firstTransit) : "Fußweg",
    nextStop: getNextStop(legs),
    arrivalDelay,
    refreshToken: journey.refreshToken || null,
    cancelled: legs.some((leg) => leg.cancelled === true),
    legs: legs.map((leg) => ({
      line: formatLine(leg),
      from: leg.origin?.name || "Start",
      to: leg.destination?.name || "Ziel",
      departure: leg.departure || leg.plannedDeparture,
      arrival: leg.arrival || leg.plannedArrival,
      walking: Boolean(leg.walking),
      cancelled: Boolean(leg.cancelled),
      stopovers: Array.isArray(leg.stopovers) ? leg.stopovers : []
    }))
  };
}

function getNextStop(legs) {
  const now = Date.now();
  for (const leg of legs) {
    const finalTime = dateFrom(leg.arrival || leg.plannedArrival);
    if (!finalTime || finalTime.getTime() < now) continue;
    if (Array.isArray(leg.stopovers)) {
      const stop = leg.stopovers.slice(1).find((item) => {
        const when = dateFrom(item.arrival || item.departure);
        return when && when.getTime() >= now;
      });
      if (stop?.stop?.name) return stop.stop.name;
    }
    return leg.destination?.name || "Ziel";
  }
  return legs[legs.length - 1]?.destination?.name || "Ziel erreicht";
}

function progressOf(journey) {
  const start = dateFrom(journey.departure)?.getTime() || Date.now();
  const end = dateFrom(journey.arrival)?.getTime() || start;
  if (end <= start) return 0;
  return cap((Date.now() - start) / (end - start), 0, 1);
}

function showBusy(busy) {
  state.loading = busy;
  elements.search.disabled = busy;
  elements.refresh.disabled = busy || state.mode !== "real" || !currentJourney()?.refreshToken;
  elements.search.textContent = busy ? "Verbindung wird geladen …" : "⌕ Verbindungen suchen";
}

async function requestJSON(path, params = {}) {
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 18000);
  try {
    const response = await fetch(url, {
      signal: abort.signal,
      headers: {"Accept":"application/json"},
      cache: "no-store"
    });
    if (!response.ok) {
      if (response.status === 429) throw new Error("Zu viele API-Anfragen. Bitte etwas später versuchen.");
      throw new Error("API-Anfrage fehlgeschlagen (HTTP " + response.status + ").");
    }
    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Zeitüberschreitung bei der DB-Anfrage.");
    if (error instanceof TypeError) {
      throw new Error("Keine Verbindung zur DB-API. Internetverbindung prüfen.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveStop(name) {
  const query = name.trim();
  const locations = await requestJSON("/locations", {
    query, results: "8", stops: "true", addresses: "false",
    poi: "false", language: "de"
  });
  if (!Array.isArray(locations)) throw new Error("Ungültige Haltestellen-Antwort.");
  const stop = locations.find((item) => item && item.id && item.name);
  if (!stop) throw new Error("Haltestelle nicht gefunden: " + query);
  return stop;
}

async function searchJourneys() {
  const from = elements.from.value.trim();
  const to = elements.to.value.trim();
  if (!from || !to) {
    displayStatus("Bitte Start und Ziel eingeben.", "error");
    return;
  }
  if (state.loading) return;
  const generation = ++state.requestGeneration;
  showBusy(true);
  displayStatus("Haltestellen und Verbindungen werden geladen …");
  try {
    const [origin, destination] = await Promise.all([resolveStop(from), resolveStop(to)]);
    const response = await requestJSON("/journeys", {
      from: origin.id, to: destination.id, results: "5",
      stopovers: "true", language: "de", routingMode: "HYBRID"
    });
    if (!Array.isArray(response.journeys)) throw new Error("Ungültige Verbindungsantwort.");
    const journeys = response.journeys.map((j, i) => normalizeJourney(j, "journey-" + i)).filter(Boolean);
    if (!journeys.length) throw new Error("Keine passenden Verbindungen gefunden.");
    if (generation !== state.requestGeneration) return;
    state.mode = "real";
    state.journeys = journeys;
    state.selectedId = journeys[0].id;
    state.lastUpdated = new Date();
    displayStatus(journeys.length + " Verbindung(en) geladen. Neue Daten werden bei geöffnetem Tab automatisch geprüft.", "success");
    render();
  } catch (error) {
    displayStatus(error.message || "Verbindung konnte nicht geladen werden.", "error");
  } finally {
    showBusy(false);
  }
}

async function refreshSelected(silent = false) {
  if (state.loading || state.mode !== "real") return;
  const current = currentJourney();
  if (!current || !current.refreshToken) {
    if (!silent) displayStatus("Für diese Verbindung ist kein Refresh-Token verfügbar.", "error");
    return;
  }
  const selectedID = current.id;
  showBusy(true);
  if (!silent) displayStatus("Aktuelle Fahrtdaten werden abgerufen …");
  try {
    const urlPath = "/journeys/" + encodeURIComponent(current.refreshToken);
    const response = await requestJSON(urlPath, {stopovers:"true", language:"de"});
    const fresh = normalizeJourney(response.journey, selectedID);
    if (!fresh) throw new Error("Die aktualisierte Fahrt konnte nicht gelesen werden.");
    if (state.selectedId !== selectedID) return;
    state.journeys = state.journeys.map((j) => j.id === selectedID ? fresh : j);
    state.lastUpdated = new Date();
    displayStatus("Fahrtdaten aktualisiert um " + clockTime(state.lastUpdated) + " Uhr.", "success");
    render();
  } catch (error) {
    displayStatus((silent ? "Auto-Update: " : "") + (error.message || "Update fehlgeschlagen."), "error");
  } finally {
    showBusy(false);
  }
}

function demoMode() {
  ++state.requestGeneration;
  state.mode = "demo";
  state.journeys = [makeDemo()];
  state.selectedId = "demo";
  state.lastUpdated = null;
  displayStatus("Demo-Modus aktiv: Die angezeigten Zeiten und Verspätungen sind erfunden.", "info");
  render();
}

function render() {
  const selected = currentJourney();
  elements.count.textContent = state.mode === "demo" ? "DEMO" : state.journeys.length + " GEFUNDEN";
  elements.mode.textContent = state.mode === "demo" ? "DEMO" : "DB-DATEN";
  elements.updated.textContent = state.lastUpdated
    ? "Aktualisiert " + clockTime(state.lastUpdated)
    : "Vorschau";
  elements.refresh.disabled = state.loading || state.mode !== "real" || !selected?.refreshToken;

  elements.list.innerHTML = state.journeys.map((journey) => {
    const active = selected?.id === journey.id;
    const delay = journey.cancelled ? "Fällt aus" : delayText(
      journey.arrivalDelay === null ? null : Math.round(journey.arrivalDelay / 60)
    );
    const delayColor = journey.cancelled ? "delay-bad" : delayClass(journey.arrivalDelay);
    const stopTime = clockTime(journey.departure) + " – " + clockTime(journey.arrival);
    const routeText = journey.origin + " → " + journey.destination;
    return '<button class="journey-item" type="button" data-journey-id="' + escapeHTML(journey.id)
      + '" aria-pressed="' + String(active) + '"><span class="line-badge">' + escapeHTML(journey.line)
      + '</span><span class="journey-main"><span class="journey-title" title="' + escapeHTML(routeText)
      + '">' + escapeHTML(routeText) + '</span><span class="journey-times">' + escapeHTML(stopTime)
      + '</span><span class="journey-meta">' + escapeHTML(journey.legs.map((leg) => leg.line).join(" · "))
      + '</span></span><span class="journey-right ' + delayColor + '">' + escapeHTML(delay)
      + (active ? '<br>✓ Ausgewählt' : '') + '</span></button>';
  }).join("");

  elements.list.querySelectorAll("[data-journey-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedId = button.dataset.journeyId;
      render();
    });
  });

  if (selected) {
    const delay = selected.cancelled ? "Fällt aus" : delayText(
      selected.arrivalDelay === null ? null : Math.round(selected.arrivalDelay / 60)
    );
    elements.detail.innerHTML =
      '<div class="detail-stat-row"><div class="detail-stat"><span>ABFAHRT</span><strong>'
      + escapeHTML(clockTime(selected.departure)) + '</strong></div><div class="detail-stat"><span>ANKUNFT</span><strong>'
      + escapeHTML(clockTime(selected.arrival)) + '</strong></div><div class="detail-stat"><span>STATUS</span><strong class="'
      + (selected.cancelled ? "delay-bad" : delayClass(selected.arrivalDelay)) + '">'
      + escapeHTML(delay) + '</strong></div></div><div class="timeline">'
      + selected.legs.map((leg) => '<div class="leg"><div class="leg-title">'
        + escapeHTML(leg.line) + (leg.cancelled ? ' · FÄLLT AUS' : '') + '</div><div class="leg-fromto">'
        + escapeHTML(clockTime(leg.departure) + " " + leg.from + " → "
        + clockTime(leg.arrival) + " " + leg.to) + '</div></div>').join("")
      + '</div><div class="small-note">Der Fortschrittsbalken basiert auf der Fahrzeit. Die Position des Zuges wird nicht per GPS verfolgt.</div>';
  } else {
    elements.detail.innerHTML = '<div class="empty">Noch keine Verbindung ausgewählt.</div>';
  }

  renderPhone();
}

function renderPhone() {
  const now = new Date();
  elements.phoneTime.textContent = clockTime(now).replace(/^0/, "");
  elements.clock.textContent = clockTime(now);
  elements.date.textContent = new Intl.DateTimeFormat("de-DE", {
    weekday:"long", day:"numeric", month:"long"
  }).format(now);

  const journey = currentJourney();
  if (!journey) return;
  elements.liveLine.textContent = journey.line;
  elements.liveNext.textContent = journey.nextStop;
  elements.liveDestination.textContent = journey.destination;
  elements.liveArrival.textContent = clockTime(journey.arrival);
  const remaining = minuteDuration(dateFrom(journey.arrival)?.getTime() - now.getTime());
  elements.liveRemaining.textContent = remaining + " Min.";
  elements.liveProgress.style.width = Math.round(progressOf(journey) * 100) + "%";

  const delay = journey.arrivalDelay === null ? null : Math.round(journey.arrivalDelay / 60);
  elements.liveDelay.textContent = journey.cancelled ? "Ausfall" : (
    delay === null ? "Keine Echtzeit" : (delay > 0 ? "+" + delay + " Min." : delay < 0 ? Math.abs(delay) + " Min. früher" : "Pünktlich")
  );
  elements.liveDelay.classList.toggle("good", !journey.cancelled && delay !== null && delay <= 0);
  elements.liveDelay.classList.toggle("muted", !journey.cancelled && delay === null);
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  void searchJourneys();
});
elements.demo.addEventListener("click", demoMode);
elements.refresh.addEventListener("click", () => void refreshSelected());
elements.swap.addEventListener("click", () => {
  [elements.from.value, elements.to.value] = [elements.to.value, elements.from.value];
});
elements.auto.addEventListener("change", () => {
  state.autoRefresh = elements.auto.checked;
  displayStatus(state.autoRefresh
    ? "Automatische Updates aktiviert (nur bei geöffnetem Tab)."
    : "Automatische Updates deaktiviert.");
});

setInterval(() => {
  if (document.visibilityState !== "visible") return;
  renderPhone();
}, 15_000);

setInterval(() => {
  if (document.visibilityState !== "visible" || !state.autoRefresh || state.mode !== "real") return;
  if (!state.loading && currentJourney()?.refreshToken) void refreshSelected(true);
}, AUTO_REFRESH_MS);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  renderPhone();
  if (state.autoRefresh && state.mode === "real"
      && (!state.lastUpdated || Date.now() - state.lastUpdated.getTime() >= AUTO_REFRESH_MS)) {
    void refreshSelected(true);
  }
});

demoMode();
