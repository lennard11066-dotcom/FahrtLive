"use strict";

// Browser-only demo. Keine Apple-Pushes und keine echte iOS-Live-Aktivität.
const DEFAULT_DEMO = Object.freeze({
  stage: "ride",
  line: "S4",
  direction: "Kronberg (Taunus) Bahnhof",
  boardStop: "Kronberg (Taunus) Bahnhof",
  nextStop: "Kronberg (Taunus) Bahnhof",
  departure: "07:06",
  minutes: 2,
  nextMinutes: 2,
  delay: 0,
  progress: 82,
  transferLine: "71",
  transferTime: "07:25",
  transferStop: "Kronberg (Taunus) Bahnhof",
  transferEnabled: true
});
const DEMO_PHASES = ["walk", "board", "ride", "next", "exit", "transfer", "arrived"];
const PHASE_NAMES = {
  walk: "ZUM BAHNHOF", board: "EINSTEIGEN", ride: "UNTERWEGS",
  next: "NÄCHSTER HALT", exit: "AUSSTIEG", transfer: "UMSTIEG", arrived: "ANGEKOMMEN"
};
const $id = (id) => document.getElementById(id);
let demoConfig = {...DEFAULT_DEMO};
let stageTimer = null;

function numberInRange(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function setText(id, value) {
  const el = $id(id);
  if (el) el.textContent = String(value);
}

function setShown(id, show) {
  const el = $id(id);
  if (el) el.hidden = !show;
}

function syncPresetButtons() {
  document.querySelectorAll("[data-preset]").forEach((btn) => {
    const active = btn.dataset.preset === demoConfig.stage;
    btn.classList.toggle("selected", active);
    btn.setAttribute("aria-pressed", String(active));
  });
}

function syncDemoForm() {
  const pairs = {
    "demo-stage": demoConfig.stage,
    "demo-line": demoConfig.line,
    "demo-direction": demoConfig.direction,
    "demo-stop": demoConfig.boardStop,
    "demo-next": demoConfig.nextStop,
    "demo-departure": demoConfig.departure,
    "demo-minutes": demoConfig.minutes,
    "demo-next-minutes": demoConfig.nextMinutes,
    "demo-delay": demoConfig.delay,
    "demo-progress": demoConfig.progress,
    "demo-transfer-line": demoConfig.transferLine,
    "demo-transfer-time": demoConfig.transferTime,
    "demo-transfer-stop": demoConfig.transferStop
  };
  for (const [id, value] of Object.entries(pairs)) $id(id).value = value;
  $id("demo-transfer-enabled").checked = demoConfig.transferEnabled;
  setText("demo-progress-out", demoConfig.progress + " %");
  syncPresetButtons();
}

function readDemoForm() {
  demoConfig = {
    stage: DEMO_PHASES.includes($id("demo-stage").value) ? $id("demo-stage").value : "ride",
    line: $id("demo-line").value.trim().slice(0, 12) || "S4",
    direction: $id("demo-direction").value.trim().slice(0, 85) || "Kronberg (Taunus) Bahnhof",
    boardStop: $id("demo-stop").value.trim().slice(0, 85) || "Bahnhof",
    nextStop: $id("demo-next").value.trim().slice(0, 85) || "Nächster Halt",
    departure: $id("demo-departure").value || "07:06",
    minutes: numberInRange($id("demo-minutes").value, 0, 240, 2),
    nextMinutes: numberInRange($id("demo-next-minutes").value, 0, 240, 2),
    delay: numberInRange($id("demo-delay").value, -30, 180, 0),
    progress: numberInRange($id("demo-progress").value, 0, 100, 82),
    transferLine: $id("demo-transfer-line").value.trim().slice(0, 15) || "71",
    transferTime: $id("demo-transfer-time").value || "07:25",
    transferStop: $id("demo-transfer-stop").value.trim().slice(0, 90) || "Umstieg",
    transferEnabled: $id("demo-transfer-enabled").checked
  };
  setText("demo-progress-out", Math.round(demoConfig.progress) + " %");
  syncPresetButtons();
}

function selectPanel(panel) {
  for (const tab of ["demo", "real", "design"]) {
    const active = tab === panel;
    $id("panel-" + tab).hidden = !active;
    $id("tab-" + tab).classList.toggle("active", active);
    $id("tab-" + tab).setAttribute("aria-selected", String(active));
  }
}

function selectDemoStage(stage) {
  if (!DEMO_PHASES.includes(stage)) return;
  demoConfig.stage = stage;
  const progress = {walk:0, board:4, ride:55, next:76, exit:90, transfer:95, arrived:100};
  demoConfig.progress = progress[stage];
  syncDemoForm();
  demoMode();
}

function stopDemoPlayback() {
  if (stageTimer !== null) {
    clearInterval(stageTimer);
    stageTimer = null;
  }
  const button = $id("demo-play");
  if (button) button.textContent = "▷ Animation abspielen";
}

function nextDemoStage() {
  const next = (DEMO_PHASES.indexOf(demoConfig.stage) + 1) % DEMO_PHASES.length;
  selectDemoStage(DEMO_PHASES[next]);
}

function startDemoPlayback() {
  if (stageTimer !== null) {
    stopDemoPlayback();
    return;
  }
  selectDemoStage("walk");
  $id("demo-play").textContent = "Ⅱ Animation stoppen";
  stageTimer = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (state.mode !== "demo") {
      stopDemoPlayback();
      return;
    }
    if (demoConfig.stage === "arrived") {
      stopDemoPlayback();
      return;
    }
    nextDemoStage();
  }, 4500);
}

function liveCardText(journey) {
  if (state.mode !== "demo") {
    return {
      stage: "ride",
      headline: "Fahre in Richtung " + journey.destination,
      secondary: "Nächster Halt · " + journey.nextStop,
      tertiary: journey.cancelled ? "Verbindung fällt aus" : (
        journey.arrivalDelay === null ? "Planzeit" : delayText(Math.round(journey.arrivalDelay / 60))
      )
    };
  }
  const c = demoConfig;
  switch (c.stage) {
    case "walk":
      return {stage:c.stage, headline:"Zu Haltestelle gehen", secondary:c.line + " nehmen", tertiary:c.departure};
    case "board":
      return {stage:c.stage, headline:c.line + " nehmen", secondary:c.boardStop, tertiary:c.departure};
    case "next":
      return {stage:c.stage, headline:"Nächster Halt: " + c.nextStop,
        secondary:"Noch " + c.nextMinutes + " min", tertiary:c.direction};
    case "exit":
      return {stage:c.stage, headline:"Ausstieg: " + c.nextStop, secondary:"Nächster Halt · " + c.nextMinutes + " min",
        tertiary:c.transferEnabled ? "Umsteigen in " + c.transferLine + " · " + c.transferTime : ""};
    case "transfer":
      return {stage:c.stage, headline:"Umsteigen in " + c.transferLine, secondary:c.transferStop,
        tertiary:"Nächste Abfahrt · " + c.transferTime};
    case "arrived":
      return {stage:c.stage, headline:"Ziel erreicht", secondary:c.direction, tertiary:"Gute Fahrt!"};
    default:
      return {stage:"ride", headline:"Fahre in Richtung " + c.direction, secondary:"Nächster Halt · " + c.nextMinutes + " min",
        tertiary:c.transferEnabled ? "" : ""};
  }
}

const API_BASE = "https://api.transitous.org";
// Transitous ist ein ehrenamtlicher Dienst. Browser-Anfragen sparsam verwenden.
const AUTO_REFRESH_MS = 120_000;
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
  const total = Math.max(1, demoConfig.minutes + 22);
  const departure = new Date(now - Math.min(120, total * demoConfig.progress / 100) * 60_000).toISOString();
  const arrival = new Date(now + demoConfig.minutes * 60_000).toISOString();
  return {
    id: "demo",
    isDemo: true,
    origin: demoConfig.boardStop,
    destination: demoConfig.direction,
    departure,
    arrival,
    line: demoConfig.line,
    nextStop: demoConfig.nextStop,
    arrivalDelay: demoConfig.delay * 60,
    refreshToken: null,
    cancelled: false,
    legs: [{
      line: demoConfig.line,
      from: demoConfig.boardStop,
      to: demoConfig.direction,
      departure,
      arrival,
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

function adaptMotisItinerary(itinerary) {
  if (!itinerary || !Array.isArray(itinerary.legs)) return null;
  return {
    refreshToken: itinerary.id || null,
    legs: itinerary.legs.map(leg => {
      const nonTransit = ["WALK", "BIKE", "CAR"].includes(leg.mode);
      const route = leg.displayName || leg.routeShortName || leg.tripShortName ||
        leg.routeLongName || leg.mode || "Verbindung";
      // Alte UI erwartet HAFAS-ähnliche Legs; convertiert aus MOTIS.
      const stopovers = [leg.from, ...(leg.intermediateStops || []), leg.to]
        .filter(Boolean).map(stop => ({
          stop: { name: stop.name },
          arrival: stop.arrival || stop.scheduledArrival || null,
          departure: stop.departure || stop.scheduledDeparture || null
        }));
      const start = leg.startTime || leg.scheduledStartTime;
      const end = leg.endTime || leg.scheduledEndTime;
      const scheduledEnd = leg.realTime === true ? leg.scheduledEndTime : null;
      const delay = scheduledEnd && end
        ? Math.round((new Date(end).getTime() - new Date(scheduledEnd).getTime()) / 1000)
        : null;
      return {
        origin: { name: leg.from?.name || "Start" },
        destination: { name: leg.to?.name || "Ziel" },
        departure: start, plannedDeparture: leg.scheduledStartTime,
        arrival: end, plannedArrival: scheduledEnd,
        arrivalDelay: delay,
        walking: nonTransit,
        line: nonTransit ? null : { name: route },
        name: nonTransit ? "Fußweg" : route,
        stopovers, cancelled: Boolean(leg.cancelled)
      };
    })
  };
}

async function requestJSON(path, params = {}) {
  let endpoint, query;
  if (path === "/locations") {
    endpoint = "/api/v1/geocode";
    query = { text: params.query, type: "STOP", numResults: "8", language: "de" };
  } else if (path === "/journeys") {
    endpoint = "/api/v6/plan";
    query = {
      fromPlace: params.from, toPlace: params.to, numItineraries: "5",
      maxItineraries: "5", searchWindow: "1800", language: "de"
    };
  } else if (path.startsWith("/journeys/")) {
    endpoint = "/api/v6/refresh-itinerary";
    query = { itineraryId: decodeURIComponent(path.slice("/journeys/".length)), language: "de" };
  } else {
    throw new Error("Unbekannter API-Endpunkt.");
  }

  const url = new URL(API_BASE + endpoint);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 18_000);
  try {
    const response = await fetch(url, {
      signal: abort.signal,
      headers: {"Accept": "application/json"},
      cache: "no-store"
    });
    if (!response.ok) {
      if (response.status === 429) throw new Error("Zu viele API-Anfragen. Bitte später erneut versuchen.");
      throw new Error("Transitous-Anfrage fehlgeschlagen (HTTP " + response.status + ").");
    }
    const result = await response.json();
    if (path === "/locations") {
      if (!Array.isArray(result)) throw new Error("Ungültige Haltestellen-Antwort.");
      return result.filter(x => x && x.id && x.name && x.type === "STOP")
        .map(x => ({ id: x.id, name: x.name }));
    }
    if (path === "/journeys") {
      if (!Array.isArray(result.itineraries)) throw new Error("Ungültige Verbindungsantwort.");
      return { journeys: result.itineraries.slice(0,5).map(adaptMotisItinerary).filter(Boolean) };
    }
    const converted = adaptMotisItinerary(result);
    if (!converted) throw new Error("Die Fahrt konnte nicht aktualisiert werden.");
    return { journey: converted };
  } catch(error) {
    if (error.name === "AbortError") throw new Error("Transitous hat nicht rechtzeitig geantwortet.");
    if (error instanceof TypeError) {
      throw new Error("Transitous ist nicht erreichbar oder der Browser blockiert die Anfrage. Bitte später erneut versuchen.");
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
  const journey = currentJourney();
  if (!journey) return;
  const override = $id("demo-use-clock").checked;
  const clock = override ? ($id("demo-clock").value || "07:16") : clockTime(new Date());
  setText("phone-status-time", clock);
  setText("lock-clock", clock);
  setText("lock-date", new Intl.DateTimeFormat("de-DE", {
    weekday:"short", day:"numeric", month:"short"
  }).format(new Date()));

  const battery = numberInRange($id("demo-battery").value, 1, 100, 33);
  setText("live-battery", battery);
  setText("demo-battery-out", battery + " %");
  setText("live-network", $id("demo-network").value);
  setShown("live-media", $id("demo-show-airpods").checked);
  setShown("phone-actions", $id("demo-show-shortcuts").checked);

  const labels = liveCardText(journey);
  setText("preview-stage", state.mode === "demo" ? PHASE_NAMES[labels.stage] : "ECHTZEIT");
  setText("live-heading", labels.headline);
  setText("live-secondary", labels.secondary);
  setText("live-tertiary", labels.tertiary);
  setShown("live-tertiary", Boolean(labels.tertiary));

  const line = journey.line || "S";
  const symbol = line.toUpperCase().startsWith("S") ? "S"
    : line.toUpperCase().startsWith("U") ? "U" : line.toUpperCase().startsWith("RE") ? "R" : "↗";
  setText("live-state-icon", ["walk","arrived"].includes(labels.stage) ? (labels.stage==="walk"?"➜":"✓") : symbol);

  const showProgress = $id("demo-show-progress").checked &&
    (state.mode === "real" || !["walk","board","arrived"].includes(labels.stage));
  setShown("live-progress-area", showProgress);

  const progress = state.mode === "demo"
    ? demoConfig.progress : Math.round(progressOf(journey) * 100);
  $("#live-progress").style.width = progress + "%";
  $("#live-progress-marker").style.left = progress + "%";

  setText("live-line", line);
  setText("live-next", journey.nextStop);
  setText("live-destination", journey.destination);
  setText("live-arrival", state.mode === "demo" ? demoConfig.departure : clockTime(journey.arrival));
  setText("live-remaining", state.mode === "demo"
    ? demoConfig.minutes + " Min." : minuteDuration(dateFrom(journey.arrival)?.getTime() - Date.now()) + " Min.");
  const minsDelay = journey.arrivalDelay === null ? null : Math.round(journey.arrivalDelay / 60);
  setText("live-delay", journey.cancelled ? "Ausfall" : delayText(minsDelay));

  // Optional: im Demo-Modus Verspätungs-Information zusätzlich in der 3. Textzeile zeigen.
  if (state.mode === "demo" && $id("demo-show-delay").checked && demoConfig.delay !== 0 &&
      ["ride","next"].includes(labels.stage)) {
    setText("live-tertiary", delayText(demoConfig.delay));
    setShown("live-tertiary", true);
  }

  const active = state.mode === "demo" ? "Demo-Fahrt" : "Echte Verbindung";
  $("#phone-root").setAttribute("aria-label", active + ", Phase: " + PHASE_NAMES[labels.stage]);
}

function initStudio() {
  syncDemoForm();
  for (const tab of ["demo", "real", "design"]) {
    $id("tab-" + tab).addEventListener("click", () => selectPanel(tab));
  }
  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => selectDemoStage(button.dataset.preset));
  });

  const settings = [
    "demo-stage", "demo-line", "demo-direction", "demo-stop", "demo-next", "demo-departure",
    "demo-minutes", "demo-next-minutes", "demo-delay", "demo-progress",
    "demo-transfer-line", "demo-transfer-time", "demo-transfer-stop", "demo-transfer-enabled"
  ];
  for (const id of settings) {
    $id(id).addEventListener("input", () => {
      readDemoForm();
      demoMode();
    });
  }
  $id("demo-reset").addEventListener("click", () => {
    stopDemoPlayback();
    demoConfig = {...DEFAULT_DEMO};
    syncDemoForm();
    demoMode();
  });
  $id("demo-play").addEventListener("click", startDemoPlayback);
  $id("demo-next-stage").addEventListener("click", () => {
    stopDemoPlayback();
    nextDemoStage();
  });
  const designControls = [
    "demo-network","demo-battery","demo-clock","demo-use-clock",
    "demo-show-airpods","demo-show-shortcuts","demo-show-progress","demo-show-delay"
  ];
  for (const id of designControls) {
    $id(id).addEventListener("input", renderPhone);
    $id(id).addEventListener("change", renderPhone);
  }
  $id("demo").addEventListener("click", () => selectPanel("demo"));
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
    ? "Automatische Updates aktiviert (alle 2 Minuten bei geöffnetem Tab)."
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

initStudio();
demoMode();
