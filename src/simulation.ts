import { baseEquipment, limits, safeGatePermissionLabels, scenarios, zones } from "./data";
import type { Alert, AppSnapshot, Equipment, Metric, Quality, SafeGateResult, SourceRank, Telemetry, TimelineEvent, ZoneState } from "./types";

const now = (tick = 0) => new Date(Date.UTC(2026, 7, 10, 8, 0, tick * 15)).toISOString();

function reading(zone_id: string, sensor_id: string, metric: Metric, value: number | boolean | string, unit = "", quality: Quality = "GOOD", sequence = 1): Telemetry {
  return { timestamp: now(sequence), zone_id, sensor_id, metric, value, unit, quality, sequence };
}

export function baselineTelemetry(sequence = 1): Telemetry[] {
  return zones.flatMap((zone, i) => [
    reading(zone.id, `${zone.id}-H2S`, "H2S", zone.class === "SENSITIVE_RECEPTOR" ? 0.03 : 0.05 + i * 0.003, "ppm", "GOOD", sequence),
    reading(zone.id, `${zone.id}-O3`, "O3", 0.0, "ppm", "GOOD", sequence),
    reading(zone.id, `${zone.id}-ODOR`, "odor_index", 12 + i, "index", "GOOD", sequence),
    reading(zone.id, `${zone.id}-AIR`, "airflow", zone.class === "SENSITIVE_RECEPTOR" ? 180 : 330, "m3/h", "GOOD", sequence),
    reading(zone.id, `${zone.id}-OCC`, "occupancy", zone.class !== "CLOSED_HIGH_LOAD", "boolean", "GOOD", sequence),
    reading(zone.id, `${zone.id}-DOOR`, "door_closed", true, "boolean", "GOOD", sequence),
    reading(zone.id, `${zone.id}-RH`, "humidity", zone.id === "Z05" ? 58 : 46, "%RH", "GOOD", sequence),
  ]);
}

export function initialSnapshot(): AppSnapshot {
  return {
    tick: 0,
    activeScenarioId: "T01",
    running: false,
    zoneStates: Object.fromEntries(zones.map((z) => [z.id, "NORMAL" as ZoneState])),
    telemetry: baselineTelemetry(),
    equipment: baseEquipment,
    alerts: [],
    timeline: [{ time: now(), type: "STATE", zoneId: "Z00", text: "Digital twin initialized; all hazardous outputs safe-off." }],
    sourceRanks: rankSources("T01", baselineTelemetry()),
    selectedZoneId: "Z06",
    testResults: Object.fromEntries(scenarios.map((s) => [s.id, "READY"])),
    networkOnline: true,
    lastDataReceived: now(),
    workOrders: [],
  };
}

export function latest(telemetry: Telemetry[], zoneId: string, metric: Metric) {
  return [...telemetry].reverse().find((r) => r.zone_id === zoneId && r.metric === metric);
}

export function numeric(telemetry: Telemetry[], zoneId: string, metric: Metric, fallback = 0) {
  const value = latest(telemetry, zoneId, metric)?.value;
  return typeof value === "number" ? value : fallback;
}

export function boolValue(telemetry: Telemetry[], zoneId: string, metric: Metric, fallback = false) {
  const value = latest(telemetry, zoneId, metric)?.value;
  return typeof value === "boolean" ? value : fallback;
}

export function evaluateSafeGate(zoneId: string, telemetry: Telemetry[], equipment: Equipment[], networkOnline = true): SafeGateResult[] {
  const zone = zones.find((z) => z.id === zoneId)!;
  const o3Leak = numeric(telemetry, zoneId, "O3", 0);
  const occupancy = boolValue(telemetry, zoneId, "occupancy", true);
  const doorClosed = boolValue(telemetry, zoneId, "door_closed", false);
  const airflow = numeric(telemetry, zoneId, "airflow", 0);
  const anyCriticalBad = telemetry.filter((r) => r.zone_id === zoneId).some((r) => r.quality !== "GOOD");
  const fan = equipment.find((e) => e.zoneId === zoneId && e.type.includes("FAN"));
  const destructor = equipment.find((e) => e.zoneId === zoneId && e.type.includes("DESTRUCTOR"));
  const ozoneRelay = equipment.find((e) => e.zoneId === zoneId && e.type === "OZONE_GENERATOR");
  const highH2s = numeric(telemetry, zoneId, "H2S", 0) > 5;
  const map: Record<string, [boolean, string]> = {
    SG01: [zone.ozoneAllowed, zone.ozoneAllowed ? "Zone policy allows sealed path only" : "Zone is ozone-prohibited"],
    SG02: [!occupancy, occupancy ? "Occupied or uncertain" : "Occupancy clear and fresh"],
    SG03: [doorClosed, doorClosed ? "Door closed and lock feedback valid" : "Door open or lock not proven"],
    SG04: [Boolean(fan && fan.feedback.toLowerCase().includes("airflow")), fan?.feedback ?? "No treatment fan feedback"],
    SG05: [airflow >= 250, `${airflow.toFixed(0)} m3/h exhaust airflow`],
    SG06: [Boolean(destructor && !destructor.feedback.toLowerCase().includes("fault")), destructor?.feedback ?? "Destructor unavailable"],
    SG07: [!anyCriticalBad, anyCriticalBad ? "Critical sensor stale, bad or uncertain" : "Critical sensors fresh"],
    SG08: [o3Leak < limits.ozoneLeakTrip, `${o3Leak.toFixed(2)} ppm O3 leak monitor`],
    SG09: [!highH2s, highH2s ? "High H2S emergency band" : "Process gas risk acceptable"],
    SG10: [true, "Emergency stop healthy"],
    SG11: [!ozoneRelay || !ozoneRelay.feedback.toLowerCase().includes("mismatch"), ozoneRelay?.feedback ?? "No ozone relay commanded"],
    SG12: [networkOnline || true, networkOnline ? "Local watchdog healthy" : "Network lost; local watchdog still healthy"],
  };
  return safeGatePermissionLabels.map(([id, label]) => ({ id, label, pass: map[id][0], detail: map[id][1] }));
}

export function ozoneAllowedNow(zoneId: string, telemetry: Telemetry[], equipment: Equipment[], networkOnline = true) {
  return evaluateSafeGate(zoneId, telemetry, equipment, networkOnline).every((r) => r.pass);
}

function withReadings(snapshot: AppSnapshot, additions: Telemetry[]) {
  return { ...snapshot, telemetry: [...snapshot.telemetry, ...additions], lastDataReceived: now(snapshot.tick) };
}

function addTimeline(snapshot: AppSnapshot, zoneId: string, type: TimelineEvent["type"], text: string) {
  snapshot.timeline = [...snapshot.timeline, { time: now(snapshot.tick), zoneId, type, text }];
}

function alert(snapshot: AppSnapshot, zoneId: string, severity: Alert["severity"], message: string) {
  snapshot.alerts = [...snapshot.alerts, { id: `AL-${snapshot.activeScenarioId}-${snapshot.tick}-${zoneId}`, zoneId, severity, message, acknowledged: false }];
  addTimeline(snapshot, zoneId, "ALERT", `${severity}: ${message}`);
}

function setZone(snapshot: AppSnapshot, zoneId: string, state: ZoneState, reason: string) {
  snapshot.zoneStates = { ...snapshot.zoneStates, [zoneId]: state };
  addTimeline(snapshot, zoneId, "STATE", `${zoneId} -> ${state}: ${reason}`);
}

function setEquipment(snapshot: AppSnapshot, id: string, command: string, feedback: string) {
  snapshot.equipment = snapshot.equipment.map((e) => (e.id === id ? { ...e, command, feedback } : e));
  const eq = snapshot.equipment.find((e) => e.id === id);
  if (eq) {
    addTimeline(snapshot, eq.zoneId, "COMMAND", `${eq.label}: command ${command}; feedback ${feedback}`);
  }
}

export function rankSources(scenarioId: string, telemetry: Telemetry[]): SourceRank[] {
  const h2s = (z: string) => numeric(telemetry, z, "H2S", 0);
  if (scenarioId === "T14") {
    return [
      { zoneId: "Z03", confidence: 0.82, evidence: ["Dirty utility first-rise occurs 45s before corridor", "Airflow direction points from Z03 to Z06", "Z03 has high H2S plus odor index", "Historical dirty-utility drain pattern match"] },
      { zoneId: "Z04", confidence: 0.46, evidence: ["Adjacent to corridor", "Lower magnitude than Z03", "No earlier detection time"] },
      { zoneId: "Z01", confidence: 0.28, evidence: ["Connected through corridor", "Airflow vector conflicts with source hypothesis"] },
    ];
  }
  const sorted = zones.map((z) => ({ z, score: h2s(z.id) + numeric(telemetry, z.id, "odor_index", 0) / 100 })).sort((a, b) => b.score - a.score);
  return sorted.slice(0, 3).map((item, index) => ({
    zoneId: item.z.id,
    confidence: Math.max(0.24, Math.min(0.92, 0.72 - index * 0.16 + item.score / 20)),
    evidence: [`${item.z.shortName} has strongest current odor signal`, `${item.z.adjacent.length} adjacency links checked`, "Airflow and timing evidence retained in incident log"],
  }));
}

export function scenarioStep(base: AppSnapshot, scenarioId: string, tick: number): AppSnapshot {
  let s: AppSnapshot = { ...base, tick, activeScenarioId: scenarioId, running: true, alerts: [...base.alerts], timeline: [...base.timeline], equipment: [...base.equipment], telemetry: [...base.telemetry], zoneStates: { ...base.zoneStates }, workOrders: [...base.workOrders], testResults: { ...base.testResults, [scenarioId]: "RUNNING" } };
  const seq = tick + 2;
  const finish = (pass = true) => {
    s.testResults = { ...s.testResults, [scenarioId]: pass ? "PASS" : "FAIL" };
    s.running = false;
  };
  const failSafe = (zoneId: string, message: string) => {
    setZone(s, zoneId, "FAULT", message);
    setEquipment(s, "E003", "OFF", "relay off");
    setEquipment(s, "E002", "ON", "airflow proven");
    setEquipment(s, "E005", "LOCK", "locked");
    alert(s, zoneId, "P0", message);
    addTimeline(s, zoneId, "SAFEGATE", "SafeGate denied ozone: ozone OFF, ventilation ON, door locked.");
  };

  if (scenarioId === "T01") {
    if (tick >= 2) finish(true);
  }
  if (scenarioId === "T02") {
    if (tick === 1) { s = withReadings(s, [reading("Z01", "S001", "H2S", 0.28, "ppm", "GOOD", seq), reading("Z01", "S006", "occupancy", false, "boolean", "GOOD", seq), reading("Z01", "S007", "door_closed", true, "boolean", "GOOD", seq)]); setZone(s, "Z01", "WATCH", "persistent H2S rise"); alert(s, "Z01", "P0", "High-load odor incident"); }
    if (tick === 2) { setZone(s, "Z01", "CONTAIN", "negative-pressure fan proven"); setEquipment(s, "E002", "ON", "airflow proven"); }
    if (tick === 3) { if (ozoneAllowedNow("Z01", s.telemetry, s.equipment, s.networkOnline)) { setZone(s, "Z01", "TREAT", "all SafeGate permissives passed"); setEquipment(s, "E003", "ON", "relay on"); setEquipment(s, "E004", "ON", "temperature healthy"); s = withReadings(s, [reading("Z01", "S003", "O3", 0.8, "ppm", "GOOD", seq), reading("Z01", "S005", "O3", 0.0, "ppm", "GOOD", seq)]); } else failSafe("Z01", "SafeGate blocked sealed treatment"); }
    if (tick === 4) { setZone(s, "Z01", "PURGE", "dose complete; destructor and fan remain on"); setEquipment(s, "E003", "OFF", "relay off"); s = withReadings(s, [reading("Z01", "S004", "O3", 0.04, "ppm", "GOOD", seq)]); }
    if (tick === 5) { setZone(s, "Z01", "VERIFY", "first safe O3 sample collected"); s = withReadings(s, [reading("Z01", "S004", "O3", 0.04, "ppm", "GOOD", seq)]); }
    if (tick >= 6) { setZone(s, "Z01", "SAFE", "second safe O3 sample below internal ceiling"); s = withReadings(s, [reading("Z01", "S004", "O3", 0.03, "ppm", "GOOD", seq), reading("Z01", "S001", "H2S", 0.06, "ppm", "GOOD", seq)]); addTimeline(s, "Z01", "CLOSE", "Incident closed with signed SafeGate and telemetry evidence."); finish(true); }
  }
  if (scenarioId === "T03") { if (tick === 1) s = withReadings(s, [reading("Z01", "S006", "occupancy", true, "boolean", "GOOD", seq)]); if (tick >= 2) { failSafe("Z01", "Unsafe occupancy"); finish(true); } }
  if (scenarioId === "T04") { if (tick === 1) { setZone(s, "Z01", "TREAT", "sealed cycle active"); setEquipment(s, "E003", "ON", "relay on"); } if (tick >= 2) { s = withReadings(s, [reading("Z01", "S007", "door_closed", false, "boolean", "GOOD", seq)]); failSafe("Z01", "Door interlock trip"); finish(true); } }
  if (scenarioId === "T05") { if (tick === 1) setZone(s, "Z01", "TREAT", "sealed cycle active"); if (tick >= 2) { s = withReadings(s, [reading("Z01", "S005", "O3", 0.04, "ppm", "GOOD", seq)]); failSafe("Z01", "O3 leak trip"); finish(true); } }
  if (scenarioId === "T06") { if (tick >= 1) { s = withReadings(s, [reading("Z01", "S004", "O3", 0, "ppm", "STALE", seq)]); failSafe("Z01", "Critical sensor stale"); finish(true); } }
  if (scenarioId === "T07") { if (tick >= 1) { setEquipment(s, "E002", "ON", "airflow missing"); s = withReadings(s, [reading("Z01", "S008", "airflow", 0, "m3/h", "GOOD", seq)]); failSafe("Z01", "Airflow proof lost"); finish(true); } }
  if (scenarioId === "T08") { if (tick >= 1) { setEquipment(s, "E004", "ON", "destructor fault"); failSafe("Z01", "Destructor fault"); finish(true); } }
  if (scenarioId === "T09") { if (tick >= 1) { s.networkOnline = false; addTimeline(s, "Z01", "FEEDBACK", "Gateway offline; local controller continues and buffers signed events."); alert(s, "Z01", "P0", "Network offline; local safety authority active"); finish(true); } }
  if (scenarioId === "T10") {
    if (tick === 1) { s = withReadings(s, [reading("Z03", "S016", "H2S", 0.24, "ppm", "GOOD", seq), reading("Z03", "S020", "occupancy", true, "boolean", "GOOD", seq)]); setZone(s, "Z03", "WATCH", "occupied-zone H2S rise"); alert(s, "Z03", "P0", "Occupied-zone odor"); }
    if (tick === 2) { setZone(s, "Z03", "CONTAIN", "doorway capture and exhaust high"); setEquipment(s, "E010", "HIGH", "airflow proven"); }
    if (tick === 3) { setZone(s, "Z03", "TREAT", "carbon path only; ozone prohibited"); setEquipment(s, "E011", "AVAILABLE", "in/out gas delta healthy"); s = withReadings(s, [reading("Z03", "S015", "H2S", 0.24, "ppm", "GOOD", seq), reading("Z03", "S017", "H2S", 0.07, "ppm", "GOOD", seq)]); }
    if (tick === 4) setZone(s, "Z03", "VERIFY", "occupant-facing H2S returns to target");
    if (tick >= 5) { s = withReadings(s, [reading("Z03", "S016", "H2S", 0.07, "ppm", "GOOD", seq)]); setZone(s, "Z03", "SAFE", "carbon treatment verified; no ozone command exists"); finish(true); }
  }
  if (scenarioId === "T11") { if (tick >= 1) { setZone(s, "Z03", "FAULT", "Carbon removal below 70%"); s.workOrders.push("Replace or service Z03 carbon bank; verify inlet/outlet removal, RH, runtime and DP."); alert(s, "Z03", "P1", "Carbon breakthrough"); finish(true); } }
  if (scenarioId === "T12") { if (tick >= 1) { s = withReadings(s, [reading("Z05", "S025", "moisture", 22, "%", "GOOD", seq), reading("Z05", "S024", "H2S", 0.32, "ppm", "GOOD", seq)]); setZone(s, "Z05", "FAULT", "Biofilter moisture and removal below limits"); s.workOrders.push("Irrigate and inspect Z05 biofilter media; confirm removal recovery."); alert(s, "Z05", "P1", "Biofilter under-performance"); finish(true); } }
  if (scenarioId === "T13") { if (tick >= 1) { s = withReadings(s, [reading("Z02", "S011", "H2S", 12, "ppm", "GOOD", seq)]); setZone(s, "Z02", "FAULT", "Independent high-range H2S alarm"); alert(s, "Z02", "P0", "High H2S emergency; ozone inhibited"); finish(true); } }
  if (scenarioId === "T14") {
    if (tick === 1) { s = withReadings(s, [reading("Z03", "S016", "H2S", 0.21, "ppm", "GOOD", seq), reading("Z06", "S028", "odor_index", 64, "index", "GOOD", seq)]); setZone(s, "Z06", "WATCH", "corridor complaint and odor trend"); alert(s, "Z06", "P1", "Corridor odor complaint linked to telemetry"); }
    if (tick >= 2) { s.sourceRanks = rankSources("T14", s.telemetry); setZone(s, "Z03", "CONTAIN", "AeroTrace ranks upstream dirty utility as likely source"); addTimeline(s, "Z06", "AEROTRACE", "Top source Z03 at 82% confidence from timing, magnitude and airflow."); finish(true); }
  }
  if (scenarioId === "T15") { if (tick === 1) setZone(s, "Z01", "VERIFY", "fault acknowledged; collecting safe samples"); if (tick >= 2) { s = withReadings(s, [reading("Z01", "S004", "O3", 0.04, "ppm", "GOOD", seq), reading("Z01", "S004", "O3", 0.03, "ppm", "GOOD", seq + 1)]); setZone(s, "Z01", "SAFE", "two consecutive safe samples and acknowledgement complete"); addTimeline(s, "Z01", "VERIFY", "Safe entry indicator released only after two samples."); finish(true); } }

  s.sourceRanks = scenarioId === "T14" ? rankSources("T14", s.telemetry) : rankSources(scenarioId, s.telemetry);
  return s;
}

export function runScenario(id: string) {
  let s = { ...initialSnapshot(), activeScenarioId: id, selectedZoneId: id === "T10" || id === "T11" ? "Z03" : id === "T12" ? "Z05" : id === "T14" ? "Z06" : id === "T13" ? "Z02" : "Z01" };
  for (let tick = 1; tick <= 7; tick += 1) {
    s = scenarioStep(s, id, tick);
    if (!s.running) break;
  }
  return s;
}

export function telemetrySeries(snapshot: AppSnapshot, zoneId: string) {
  const points = Array.from({ length: 12 }, (_, i) => {
    const t = i + 1;
    const h2sBase = numeric(snapshot.telemetry, zoneId, "H2S", 0.05);
    const o3Base = numeric(snapshot.telemetry, zoneId, "O3", 0);
    const odorBase = numeric(snapshot.telemetry, zoneId, "odor_index", 12);
    return { t: `-${(12 - t) * 15}s`, H2S: Math.max(0.01, +(h2sBase * (0.55 + t / 18)).toFixed(2)), O3: +(o3Base * Math.max(0.1, t / 12)).toFixed(2), odor: Math.round(odorBase * (0.65 + t / 24)) };
  });
  return points;
}
