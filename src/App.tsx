import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Download,
  Fan,
  FileJson,
  Gauge,
  GitBranch,
  History,
  Lock,
  MapPin,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  TestTube2,
  ToggleLeft,
  Wrench,
  XCircle,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { limits, scenarios, zones } from "./data";
import { boolValue, evaluateSafeGate, initialSnapshot, latest, numeric, ozoneAllowedNow, rankSources, runScenario, scenarioStep, telemetrySeries } from "./simulation";
import type { Alert, AppSnapshot, SourceRank, TimelineEvent, Zone } from "./types";

type View = "overview" | "zone" | "aerotrace" | "safegate" | "hardware" | "simulation" | "replay" | "maintenance" | "complaints" | "reports";

const stateLabels = {
  NORMAL: "normal",
  WATCH: "watch",
  CONTAIN: "contain",
  TREAT: "treat",
  PURGE: "purge",
  VERIFY: "verify",
  SAFE: "safe",
  FAULT: "fault",
};

const viewItems: Array<[View, string, typeof Activity]> = [
  ["overview", "Operations", Activity],
  ["zone", "Zone Detail", Gauge],
  ["aerotrace", "AeroTrace", Search],
  ["safegate", "SafeGate", ShieldCheck],
  ["hardware", "Hardware Link", Cpu],
  ["simulation", "Simulation Lab", TestTube2],
  ["replay", "Incident Replay", History],
  ["maintenance", "Maintenance", Wrench],
  ["complaints", "Complaints", ClipboardList],
  ["reports", "Reports", FileJson],
];

function loadSaved() {
  try {
    const saved = localStorage.getItem("scentinel-snapshot");
    return saved ? ({ ...initialSnapshot(), ...JSON.parse(saved), running: false } as AppSnapshot) : initialSnapshot();
  } catch {
    return initialSnapshot();
  }
}

function zoneById(id: string) {
  return zones.find((z) => z.id === id) ?? zones[0];
}

function classLabel(input: string) {
  return input.replaceAll("_", " ").toLowerCase();
}

function formatValue(snapshot: AppSnapshot, zoneId: string, metric: "H2S" | "O3" | "odor_index" | "airflow") {
  const record = latest(snapshot.telemetry, zoneId, metric);
  if (!record) return "n/a";
  const value = typeof record.value === "number" ? record.value.toFixed(metric === "odor_index" || metric === "airflow" ? 0 : 2) : String(record.value);
  return `${value}${record.unit ? ` ${record.unit}` : ""}`;
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function Panel({ title, icon: Icon, children, action }: { title: string; icon?: typeof Activity; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>{Icon ? <Icon size={17} /> : null}<span>{title}</span></div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function HospitalMap({ snapshot, onSelect }: { snapshot: AppSnapshot; onSelect: (id: string) => void }) {
  const topSource = snapshot.sourceRanks[0];
  return (
    <div className="map-wrap">
      <svg className="floor-map" viewBox="0 0 100 100" role="img" aria-label="Interactive hospital floor map">
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#2d6cdf" />
          </marker>
          <marker id="arrowGreen" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#2e7d46" />
          </marker>
        </defs>
        <rect x="3" y="7" width="94" height="87" rx="2" className="map-shell" />
        <path d="M27 35 H73 V53 H27 Z" className="corridor-line" />
        <path d="M52 23 L42 35" className="airflow" markerEnd="url(#arrow)" />
        <path d="M42 42 L30 42" className="airflow" markerEnd="url(#arrow)" />
        <path d="M52 45 L71 70" className="proof-flow" markerEnd="url(#arrowGreen)" />
        {zones.map((zone) => {
          const state = snapshot.zoneStates[zone.id];
          const isSelected = snapshot.selectedZoneId === zone.id;
          const isSource = topSource?.zoneId === zone.id && topSource.confidence >= limits.aerotraceAutoConfidence;
          const isTreat = state === "TREAT" || state === "PURGE" || state === "VERIFY";
          return (
            <g key={zone.id} role="button" tabIndex={0} onClick={() => onSelect(zone.id)} className="zone-hotspot">
              <rect x={zone.map.x} y={zone.map.y} width={zone.map.w} height={zone.map.h} rx="2" className={`map-zone ${stateLabels[state]} ${isSelected ? "selected" : ""}`} />
              <text x={zone.map.x + zone.map.w / 2} y={zone.map.y + 8} textAnchor="middle" className="zone-id">{zone.id}</text>
              <text x={zone.map.x + zone.map.w / 2} y={zone.map.y + 15} textAnchor="middle" className="zone-name">{zone.shortName}</text>
              <circle cx={zone.map.x + zone.map.w - 4} cy={zone.map.y + zone.map.h - 4} r="1.8" className="sensor-dot" />
              {isSource ? <path d={`M${zone.map.x + 3} ${zone.map.y + 4} h5 l-2.5 5 z`} className="source-marker" /> : null}
              {isTreat ? <circle cx={zone.map.x + 5} cy={zone.map.y + zone.map.h - 5} r="2.5" className="treatment-dot" /> : null}
              {(zone.id === "Z01" && (state === "TREAT" || state === "PURGE" || state === "VERIFY" || state === "FAULT")) ? <text x={zone.map.x + zone.map.w - 4} y={zone.map.y + 5} className="lock-symbol">L</text> : null}
            </g>
          );
        })}
      </svg>
      <div className="map-legend">
        <span><i className="normal"></i>Normal</span>
        <span><i className="watch"></i>Watch</span>
        <span><i className="treat"></i>Treat/verify</span>
        <span><i className="fault"></i>Fault</span>
        <span><i className="source"></i>Source</span>
      </div>
    </div>
  );
}

function Overview({ snapshot, setSnapshot, setView }: { snapshot: AppSnapshot; setSnapshot: (s: AppSnapshot) => void; setView: (v: View) => void }) {
  const faultCount = Object.values(snapshot.zoneStates).filter((s) => s === "FAULT").length;
  const activeAlerts = snapshot.alerts.filter((a) => !a.acknowledged).length;
  const selected = zoneById(snapshot.selectedZoneId);
  return (
    <div className="page-grid overview-grid">
      <Panel title="Interactive Hospital Map" icon={MapPin}>
        <HospitalMap snapshot={snapshot} onSelect={(id) => { setSnapshot({ ...snapshot, selectedZoneId: id }); setView("zone"); }} />
      </Panel>
      <Panel title="Facility Health" icon={Stethoscope}>
        <div className="stats-grid">
          <Stat label="Zones monitored" value="10" />
          <Stat label="Active alerts" value={String(activeAlerts)} tone={activeAlerts ? "danger-text" : "safe-text"} />
          <Stat label="Fault states" value={String(faultCount)} tone={faultCount ? "danger-text" : "safe-text"} />
          <Stat label="Safety status" value={faultCount ? "Fail-safe active" : "Protected"} tone={faultCount ? "danger-text" : "safe-text"} />
        </div>
        <div className="connection">
          <Badge tone="safe">Digital Twin active</Badge>
          <Badge tone="muted">Wokwi/ESP32 ready</Badge>
          <Badge tone={snapshot.networkOnline ? "safe" : "warning"}>{snapshot.networkOnline ? "Network online" : "Network offline"}</Badge>
          <span>Last data: {new Date(snapshot.lastDataReceived).toLocaleTimeString()}</span>
        </div>
        <button className="primary-command" onClick={() => { setSnapshot(runGuidedDemo()); setView("replay"); }}>
          <Play size={16} /> Run Guided Demo
        </button>
      </Panel>
      <Panel title="Live Zone Table" icon={Activity}>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Zone</th><th>State</th><th>H2S</th><th>O3</th><th>Odor</th><th>Airflow</th><th>Quality</th><th>Treatment</th></tr></thead>
            <tbody>
              {zones.map((zone) => {
                const state = snapshot.zoneStates[zone.id];
                const quality = latest(snapshot.telemetry, zone.id, "H2S")?.quality ?? "GOOD";
                return (
                  <tr key={zone.id} onClick={() => { setSnapshot({ ...snapshot, selectedZoneId: zone.id }); setView("zone"); }}>
                    <td><strong>{zone.id}</strong> {zone.shortName}</td>
                    <td><Badge tone={stateLabels[state]}>{state}</Badge></td>
                    <td>{formatValue(snapshot, zone.id, "H2S")}</td>
                    <td>{formatValue(snapshot, zone.id, "O3")}</td>
                    <td>{formatValue(snapshot, zone.id, "odor_index")}</td>
                    <td>{formatValue(snapshot, zone.id, "airflow")}</td>
                    <td><Badge tone={quality === "GOOD" ? "safe" : "danger"}>{quality}</Badge></td>
                    <td>{zone.treatment}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Current Focus" icon={Gauge}>
        <ZoneSummary snapshot={snapshot} zone={selected} compact />
      </Panel>
    </div>
  );
}

function ZoneSummary({ snapshot, zone, compact = false }: { snapshot: AppSnapshot; zone: Zone; compact?: boolean }) {
  const occupancy = boolValue(snapshot.telemetry, zone.id, "occupancy", zone.class !== "CLOSED_HIGH_LOAD");
  const carbonHealth = zone.class === "OCCUPIED_INTERMITTENT" ? Math.max(42, 94 - numeric(snapshot.telemetry, zone.id, "odor_index", 0)) : null;
  const bioHealth = zone.id === "Z05" ? Math.max(35, numeric(snapshot.telemetry, "Z05", "moisture", 58)) : null;
  return (
    <div className={compact ? "zone-summary compact" : "zone-summary"}>
      <div>
        <h2>{zone.name}</h2>
        <p>{classLabel(zone.class)} · {zone.occupancyMode}</p>
      </div>
      <div className="stats-grid">
        <Stat label="State" value={snapshot.zoneStates[zone.id]} tone={snapshot.zoneStates[zone.id] === "FAULT" ? "danger-text" : "safe-text"} />
        <Stat label="Occupancy" value={occupancy ? "occupied/uncertain" : "clear"} tone={occupancy ? "warning-text" : "safe-text"} />
        <Stat label="H2S" value={formatValue(snapshot, zone.id, "H2S")} />
        <Stat label="O3" value={formatValue(snapshot, zone.id, "O3")} />
        <Stat label="Airflow" value={formatValue(snapshot, zone.id, "airflow")} />
        <Stat label="Treatment" value={zone.ozoneAllowed ? "SafeGate sealed path" : "No ozone"} tone={zone.ozoneAllowed ? "warning-text" : "safe-text"} />
      </div>
      {!compact ? <p className="rule-note"><strong>Root-cause recommendation:</strong> {rootCause(zone.id)} {zone.safetyRule}</p> : null}
      {carbonHealth !== null ? <Meter label="Carbon health uses removal + runtime + humidity + DP" value={carbonHealth} /> : null}
      {bioHealth !== null ? <Meter label="Biofilter moisture and removal proof" value={bioHealth} /> : null}
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return <div className="meter"><span>{label}</span><div><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div><strong>{Math.round(value)}%</strong></div>;
}

function rootCause(zoneId: string) {
  const map: Record<string, string> = {
    Z01: "Inspect source seal, cold-chain status and purge verification.",
    Z02: "Check process gas risk, extraction fan and independent high-range monitor.",
    Z03: "Drain seal, biofilm cleaning and carbon inlet/outlet breakthrough check.",
    Z04: "Confirm bin closure, pickup SLA and room temperature.",
    Z05: "Check media moisture, DP and H2S inlet/outlet efficiency.",
    Z06: "Protect corridor and fix the ranked upstream source.",
    Z07: "Trap refill, cleaning cadence and exhaust proof.",
    Z08: "Investigate boundary pressure and shut down upstream source if O3 appears.",
    Z09: "Reduce humidity and inspect carbon derating.",
    Z10: "Wash workflow, pickup timing and source enclosure.",
  };
  return map[zoneId] ?? "Inspect source zone.";
}

function ZoneDetail({ snapshot }: { snapshot: AppSnapshot }) {
  const zone = zoneById(snapshot.selectedZoneId);
  const zoneEquipment = snapshot.equipment.filter((e) => e.zoneId === zone.id);
  return (
    <div className="page-grid detail-grid">
      <Panel title="Zone Identity" icon={MapPin}><ZoneSummary snapshot={snapshot} zone={zone} /></Panel>
      <Panel title="Live Trend" icon={Activity}>
        <div className="chart">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={telemetrySeries(snapshot, zone.id)} margin={{ top: 8, right: 14, left: -18, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d8dee3" />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="H2S" stroke="#c1440d" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="O3" stroke="#2d6cdf" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="odor" stroke="#028090" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel title="Equipment Command vs Feedback" icon={Fan}>
        <div className="equipment-list">
          {zoneEquipment.length ? zoneEquipment.map((eq) => <div className="equipment" key={eq.id}><strong>{eq.label}</strong><span>Command: {eq.command}</span><span>Feedback: {eq.feedback}</span><Badge tone={eq.feedback.includes("fault") || eq.feedback.includes("missing") ? "danger" : "safe"}>{eq.criticality}</Badge></div>) : <p>No local actuator. This receptor zone uses upstream source control.</p>}
        </div>
      </Panel>
      <Panel title="Incident Timeline" icon={History}>
        <Timeline events={snapshot.timeline.filter((e) => e.zoneId === zone.id || e.zoneId === "Z06" || zone.id === "Z06").slice(-8)} />
      </Panel>
    </div>
  );
}

function AeroTrace({ snapshot }: { snapshot: AppSnapshot }) {
  const top = snapshot.sourceRanks[0];
  const uncertain = !top || top.confidence < limits.aerotraceAutoConfidence;
  return (
    <div className="page-grid aerotrace-grid">
      <Panel title="Airflow Path and Source Marker" icon={Search}><HospitalMap snapshot={snapshot} onSelect={() => undefined} /></Panel>
      <Panel title="Explainable Source Ranking" icon={Radio}>
        <div className="rank-list">
          {snapshot.sourceRanks.map((rank, index) => <RankCard key={rank.zoneId} rank={rank} index={index} />)}
        </div>
        <div className={uncertain ? "decision uncertain" : "decision"}>
          {uncertain ? "Uncertain: protect corridor, increase sampling and dispatch inspection." : `Recommended source: ${zoneById(top.zoneId).name}`}
        </div>
      </Panel>
      <Panel title="Evidence Model" icon={ClipboardList}>
        <ul className="clean-list">
          <li>Nearby sensor magnitude from H2S and odor index.</li>
          <li>Detection time lag compares upstream rise before receptor complaint.</li>
          <li>Airflow direction separates source from receptor.</li>
          <li>Adjacency limits false routes across the hospital map.</li>
          <li>Historical source patterns add confidence, but never override SafeGate.</li>
        </ul>
      </Panel>
    </div>
  );
}

function RankCard({ rank, index }: { rank: SourceRank; index: number }) {
  const zone = zoneById(rank.zoneId);
  return (
    <article className="rank-card">
      <div><strong>#{index + 1} {zone.shortName}</strong><Badge tone={rank.confidence >= limits.aerotraceAutoConfidence ? "safe" : "warning"}>{Math.round(rank.confidence * 100)}%</Badge></div>
      <ul>{rank.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
    </article>
  );
}

function SafeGate({ snapshot }: { snapshot: AppSnapshot }) {
  const zone = zoneById(snapshot.selectedZoneId);
  const results = evaluateSafeGate(zone.id, snapshot.telemetry, snapshot.equipment, snapshot.networkOnline);
  const allowed = results.every((r) => r.pass);
  return (
    <div className="page-grid safegate-grid">
      <Panel title={`SafeGate for ${zone.shortName}`} icon={ShieldCheck}>
        <div className="safegate-status">
          {allowed ? <CheckCircle2 /> : <XCircle />}
          <div><strong>{allowed ? "Ozone permitted for sealed path" : "Ozone blocked"}</strong><span>{allowed ? "All twelve permissives pass." : "Unsafe, stale, unknown or missing input forces fail-safe."}</span></div>
        </div>
        <div className="sg-grid">
          {results.map((r) => <div key={r.id} className={`sg-item ${r.pass ? "pass" : "blocked"}`}><strong>{r.id}</strong><span>{r.label}</span><small>{r.detail}</small></div>)}
        </div>
      </Panel>
      <Panel title="Fail-Safe Result" icon={Lock}>
        <div className="failsafe-list">
          <Badge tone={allowed ? "safe" : "danger"}>Ozone {allowed ? "available" : "OFF"}</Badge>
          <Badge tone="safe">Ventilation ON where safe</Badge>
          <Badge tone="warning">Door held locked during fault/purge</Badge>
          <Badge tone={allowed ? "safe" : "danger"}>{allowed ? "No alarm" : "Alarm generated"}</Badge>
          <Badge tone="muted">Manual override cannot bypass SafeGate</Badge>
        </div>
      </Panel>
    </div>
  );
}

function controllerState(snapshot: AppSnapshot) {
  const state = snapshot.zoneStates.Z01;
  if (state === "FAULT") return { state, alarm: "P0", failed: "SG07 or active SafeGate permissive", tone: "danger" };
  if (state === "TREAT" || state === "PURGE" || state === "VERIFY") return { state, alarm: "none", failed: "none", tone: "treat" };
  if (state === "SAFE") return { state, alarm: "none", failed: "none", tone: "safe" };
  return { state, alarm: "none", failed: "none", tone: "muted" };
}

function injectSg07Fault(snapshot: AppSnapshot): AppSnapshot {
  const time = new Date().toISOString();
  const telemetry = [
    ...snapshot.telemetry,
    { timestamp: time, zone_id: "Z01", sensor_id: "Z01-O3-SG07", metric: "O3" as const, value: 0, unit: "ppm", quality: "STALE" as const, sequence: snapshot.tick + 100 },
  ];
  return {
    ...snapshot,
    tick: snapshot.tick + 1,
    selectedZoneId: "Z01",
    activeScenarioId: "SG07",
    zoneStates: { ...snapshot.zoneStates, Z01: "FAULT" },
    telemetry,
    equipment: snapshot.equipment.map((e) => {
      if (e.id === "E003") return { ...e, command: "OFF", feedback: "relay off" };
      if (e.id === "E002") return { ...e, command: "ON", feedback: "airflow proven" };
      if (e.id === "E004") return { ...e, command: "ON", feedback: "temperature healthy" };
      if (e.id === "E005") return { ...e, command: "LOCK", feedback: "locked" };
      return e;
    }),
    alerts: [
      ...snapshot.alerts,
      { id: `AL-SG07-${Date.now()}`, zoneId: "Z01", severity: "P0", message: "SG07 ozone sensor health failed; SafeGate forced FAULT / P0.", acknowledged: false },
    ],
    timeline: [
      ...snapshot.timeline,
      { time, type: "SAFEGATE", zoneId: "Z01", text: "SG07 injected: O3 sensors no longer healthy/fresh." },
      { time, type: "COMMAND", zoneId: "Z01", text: "Fail-safe output: ozone OFF, fan ON, destructor ON, door locked." },
      { time, type: "ALERT", zoneId: "Z01", text: "P0 alarm generated by SafeGate Treatment Controller." },
    ],
    testResults: { ...snapshot.testResults, SG07: "PASS" },
    lastDataReceived: time,
  };
}

function HardwareLink({ snapshot, setSnapshot, setView }: { snapshot: AppSnapshot; setSnapshot: (s: AppSnapshot) => void; setView: (v: View) => void }) {
  const ctl = controllerState(snapshot);
  const nodeReadings = [
    ["Gas / odor", formatValue(snapshot, "Z03", "H2S")],
    ["Temperature", `${numeric(snapshot.telemetry, "Z03", "temperature", 24).toFixed(1)} C`],
    ["Humidity", `${numeric(snapshot.telemetry, "Z03", "humidity", 46).toFixed(0)} %RH`],
    ["Occupancy", boolValue(snapshot.telemetry, "Z03", "occupancy", true) ? "detected" : "clear"],
  ];
  const controllerOutputs = [
    ["Fan", snapshot.zoneStates.Z01 === "FAULT" || snapshot.zoneStates.Z01 === "TREAT" || snapshot.zoneStates.Z01 === "PURGE" ? "ON" : "AUTO"],
    ["Ozone", snapshot.zoneStates.Z01 === "TREAT" ? "ON if SafeGate PASS" : "OFF"],
    ["Destructor", snapshot.zoneStates.Z01 === "FAULT" || snapshot.zoneStates.Z01 === "TREAT" || snapshot.zoneStates.Z01 === "PURGE" ? "ON" : "READY"],
    ["Door lock", snapshot.zoneStates.Z01 === "FAULT" || snapshot.zoneStates.Z01 === "TREAT" || snapshot.zoneStates.Z01 === "PURGE" || snapshot.zoneStates.Z01 === "VERIFY" ? "LOCKED" : "released"],
  ];
  return (
    <div className="page-grid hardware-grid">
      <Panel title="End-to-End Team Integration" icon={GitBranch}>
        <div className="pipeline">
          <div><Cpu size={18} /><strong>Person 2 Sensor Node</strong><span>ESP32 reads gas, odor, humidity, temperature and occupancy.</span></div>
          <div><Search size={18} /><strong>AeroTrace Dashboard</strong><span>Ranks likely source zones using readings, airflow and timing.</span></div>
          <div><ShieldCheck size={18} /><strong>Person 3 SafeGate Controller</strong><span>Allows treatment only when all 12 permissives pass.</span></div>
          <div><Fan size={18} /><strong>Treatment Outputs</strong><span>Fan, ozone, destructor, carbon path, biofilter and door lock.</span></div>
        </div>
      </Panel>
      <Panel title="Person 2 Edge Sensor Node" icon={Cpu}>
        <div className="evidence-card">
          <Badge tone="safe">Wokwi ESP32 input layer</Badge>
          <a href="https://wokwi.com/projects/471950063321171969" target="_blank" rel="noreferrer">Open Person 2 simulation</a>
        </div>
        <div className="stats-grid">
          {nodeReadings.map(([label, value]) => <Stat key={label} label={label} value={value} />)}
        </div>
        <p className="rule-note">These simulated readings are represented inside the dashboard as zone telemetry and feed both AeroTrace source localization and SafeGate decisions.</p>
      </Panel>
      <Panel title="Person 3 SafeGate Treatment Controller" icon={ShieldCheck}>
        <div className="evidence-card">
          <Badge tone={ctl.tone}>Controller state: {ctl.state}</Badge>
          <a href="https://wokwi.com/projects/471890102449907713" target="_blank" rel="noreferrer">Open Person 3 simulation</a>
        </div>
        <div className="stats-grid">
          <Stat label="Alarm" value={ctl.alarm} tone={ctl.alarm === "P0" ? "danger-text" : "safe-text"} />
          <Stat label="Failed permissive" value={ctl.failed} tone={ctl.failed === "none" ? "safe-text" : "danger-text"} />
          <Stat label="State machine" value="NORMAL > WATCH > CONTAIN > TREAT > PURGE > VERIFY > SAFE" />
          <Stat label="Fault rule" value="SG07 -> FAULT / P0" tone="danger-text" />
        </div>
      </Panel>
      <Panel title="SG07 Fault Injection Demo" icon={ToggleLeft}>
        <p className="rule-note">This reproduces Person 3's tested case: SG07 ozone sensor health fails during treatment. The dashboard must show ozone OFF, fan ON, destructor ON, door locked and P0 alarm.</p>
        <div className="controls">
          <button onClick={() => { setSnapshot(runScenario("T02")); setView("safegate"); }}><Play size={15} /> Run normal treatment</button>
          <button onClick={() => { setSnapshot(injectSg07Fault(snapshot)); setView("safegate"); }}><AlertTriangle size={15} /> Inject SG07 fault</button>
        </div>
        <div className="output-grid">
          {controllerOutputs.map(([label, value]) => <div key={label} className="output-state"><strong>{label}</strong><span>{value}</span></div>)}
        </div>
      </Panel>
    </div>
  );
}

function SimulationLab({ snapshot, setSnapshot }: { snapshot: AppSnapshot; setSnapshot: (s: AppSnapshot) => void }) {
  const scenario = scenarios.find((s) => s.id === snapshot.activeScenarioId) ?? scenarios[0];
  const passed = Object.values(snapshot.testResults).filter((r) => r === "PASS").length;
  return (
    <div className="page-grid simulation-grid">
      <Panel title="Scenario Selector" icon={TestTube2}>
        <div className="scenario-grid">
          {scenarios.map((s) => <button key={s.id} className={snapshot.activeScenarioId === s.id ? "scenario selected" : "scenario"} onClick={() => setSnapshot({ ...initialSnapshot(), activeScenarioId: s.id, selectedZoneId: selectedForScenario(s.id) })}><strong>{s.id}</strong><span>{s.title}</span><Badge tone={s.priority === "P0" ? "danger" : "warning"}>{s.priority}</Badge></button>)}
        </div>
      </Panel>
      <Panel title="Run Controls" icon={Play}>
        <div className="controls">
          <button onClick={() => setSnapshot(scenarioStep(snapshot, scenario.id, snapshot.tick + 1))}><Play size={15} /> Run step</button>
          <button onClick={() => setSnapshot({ ...snapshot, running: false })}><Pause size={15} /> Pause</button>
          <button onClick={() => setSnapshot(runScenario(scenario.id))}><CheckCircle2 size={15} /> Run to end</button>
          <button onClick={() => setSnapshot({ ...initialSnapshot(), activeScenarioId: scenario.id, selectedZoneId: selectedForScenario(scenario.id) })}><RotateCcw size={15} /> Restart</button>
          <button onClick={() => setSnapshot(runAllTests())}><TestTube2 size={15} /> Run all tests</button>
        </div>
        <div className="scenario-detail">
          <h3>{scenario.id}: {scenario.title}</h3>
          <p><strong>Initial:</strong> {scenario.initial}</p>
          <p><strong>Expected:</strong> {scenario.expected}</p>
          <p><strong>Pass criteria:</strong> {scenario.passCriteria}</p>
          <Badge tone={snapshot.testResults[scenario.id] === "PASS" ? "safe" : snapshot.testResults[scenario.id] === "FAIL" ? "danger" : "muted"}>{snapshot.testResults[scenario.id]}</Badge>
        </div>
        <Meter label={`Scenario tests passed: ${passed}/15`} value={(passed / 15) * 100} />
      </Panel>
      <Panel title="Fault Injection and Inputs" icon={Settings}>
        <div className="sliders">
          <label>Odor persistence <input type="range" min="10" max="90" defaultValue="30" /></label>
          <label>Airflow proof <input type="range" min="0" max="500" defaultValue={numeric(snapshot.telemetry, snapshot.selectedZoneId, "airflow", 330)} /></label>
          <label>O3 leak monitor <input type="range" min="0" max="8" defaultValue={Math.round(numeric(snapshot.telemetry, snapshot.selectedZoneId, "O3", 0) * 100)} /></label>
        </div>
      </Panel>
      <Panel title="Expected vs Actual" icon={ClipboardList}>
        <Timeline events={snapshot.timeline.slice(-10)} />
      </Panel>
    </div>
  );
}

function selectedForScenario(id: string) {
  if (["T10", "T11"].includes(id)) return "Z03";
  if (id === "T12") return "Z05";
  if (id === "T13") return "Z02";
  if (id === "T14") return "Z06";
  return "Z01";
}

function runAllTests() {
  let snapshot = initialSnapshot();
  for (const scenario of scenarios) {
    const result = runScenario(scenario.id);
    snapshot = {
      ...result,
      testResults: { ...snapshot.testResults, [scenario.id]: result.testResults[scenario.id] },
      timeline: [...snapshot.timeline, ...result.timeline.slice(1)],
      alerts: [...snapshot.alerts, ...result.alerts],
      workOrders: [...snapshot.workOrders, ...result.workOrders],
    };
  }
  snapshot.activeScenarioId = "T15";
  snapshot.selectedZoneId = "Z01";
  return snapshot;
}

function runGuidedDemo() {
  let snapshot = initialSnapshot();
  for (const id of ["T14", "T10", "T15"]) {
    const result = runScenario(id);
    snapshot = { ...result, timeline: [...snapshot.timeline, ...result.timeline], alerts: [...snapshot.alerts, ...result.alerts], testResults: { ...snapshot.testResults, ...result.testResults }, workOrders: [...snapshot.workOrders, ...result.workOrders] };
  }
  snapshot.activeScenarioId = "GUIDED";
  snapshot.selectedZoneId = "Z06";
  snapshot.running = false;
  snapshot.timeline = [{ time: new Date().toISOString(), type: "STATE", zoneId: "Z00", text: "Guided demo: hospital operating normally." }, ...snapshot.timeline, { time: new Date().toISOString(), type: "CLOSE", zoneId: "Z06", text: "Guided demo complete: source contained, correct treatment applied and audit evidence generated." }];
  return snapshot;
}

function Replay({ snapshot }: { snapshot: AppSnapshot }) {
  const [index, setIndex] = useState(Math.max(0, snapshot.timeline.length - 1));
  const visible = snapshot.timeline.slice(0, index + 1);
  return (
    <div className="page-grid replay-grid">
      <Panel title="Chronological Incident Replay" icon={History}>
        <div className="controls">
          <button onClick={() => setIndex((i) => Math.min(snapshot.timeline.length - 1, i + 1))}><Play size={15} /> Play step</button>
          <button onClick={() => setIndex((i) => Math.max(0, i - 1))}><Pause size={15} /> Back</button>
          <input type="range" min="0" max={Math.max(0, snapshot.timeline.length - 1)} value={index} onChange={(e) => setIndex(Number(e.target.value))} />
        </div>
        <Timeline events={visible.slice(-14)} />
      </Panel>
      <Panel title="Replay Map" icon={MapPin}><HospitalMap snapshot={snapshot} onSelect={() => undefined} /></Panel>
    </div>
  );
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  return <ol className="timeline">{events.map((e, i) => <li key={`${e.time}-${i}`}><Badge tone="muted">{e.type}</Badge><span>{new Date(e.time).toLocaleTimeString()} · {e.zoneId}</span><p>{e.text}</p></li>)}</ol>;
}

function Maintenance({ snapshot }: { snapshot: AppSnapshot }) {
  const carbon = zones.filter((z) => z.class === "OCCUPIED_INTERMITTENT");
  return (
    <div className="page-grid maintenance-grid">
      <Panel title="Carbon and Biofilter Health" icon={Wrench}>
        <div className="asset-list">
          {carbon.map((z, i) => <AssetHealth key={z.id} label={`${z.id} ${z.shortName} carbon`} value={Math.max(48, 92 - i * 7 - numeric(snapshot.telemetry, z.id, "odor_index", 10) / 3)} detail="Removal efficiency + runtime + humidity + pressure differential" />)}
          <AssetHealth label="Z05 STP biofilter" value={snapshot.zoneStates.Z05 === "FAULT" ? 42 : 86} detail="H2S inlet/outlet + moisture + DP + airflow" />
        </div>
      </Panel>
      <Panel title="Open Work Orders" icon={ClipboardList}>
        {snapshot.workOrders.length ? snapshot.workOrders.map((w) => <p className="work-order" key={w}>{w}</p>) : <p>No open work orders. Preventive tasks are generated by breakthrough, dry media, calibration or equipment feedback faults.</p>}
      </Panel>
      <Panel title="Calibration and Equipment Faults" icon={Settings}>
        <div className="equipment-list">{snapshot.equipment.map((e) => <div className="equipment" key={e.id}><strong>{e.label}</strong><span>{e.feedback}</span><Badge tone={e.feedback.includes("fault") || e.feedback.includes("missing") ? "danger" : "safe"}>{e.criticality}</Badge></div>)}</div>
      </Panel>
    </div>
  );
}

function AssetHealth({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="asset"><strong>{label}</strong><Meter label={detail} value={value} /></div>;
}

function Complaints({ snapshot, setSnapshot, setView }: { snapshot: AppSnapshot; setSnapshot: (s: AppSnapshot) => void; setView: (v: View) => void }) {
  const [location, setLocation] = useState("Z06");
  const [intensity, setIntensity] = useState(4);
  const [note, setNote] = useState("Odor noticed near patient corridor.");
  const submit = () => {
    const next = runScenario("T14");
    const event: TimelineEvent = { time: new Date().toISOString(), type: "ALERT", zoneId: location, text: `Complaint submitted: intensity ${intensity}/5. ${note}` };
    setSnapshot({ ...next, timeline: [event, ...next.timeline], selectedZoneId: location });
    setView("aerotrace");
  };
  return (
    <div className="page-grid complaints-grid">
      <Panel title="Submit Simulated Complaint" icon={ClipboardList}>
        <div className="form-grid">
          <label>Location<select value={location} onChange={(e) => setLocation(e.target.value)}>{zones.map((z) => <option key={z.id} value={z.id}>{z.id} {z.shortName}</option>)}</select></label>
          <label>Perceived intensity<input type="range" min="1" max="5" value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} /></label>
          <label>Note<textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <button onClick={submit}><Search size={15} /> Correlate with AeroTrace</button>
        </div>
      </Panel>
      <Panel title="Recent Complaint Correlation" icon={Search}>
        <p>Complaints are linked by time, location, sensor rise, airflow direction and current source ranking. Scenario T14 demonstrates corridor odor traced to Z03 Dirty Utility without receptor dosing.</p>
        <RankCard rank={snapshot.sourceRanks[0]} index={0} />
      </Panel>
    </div>
  );
}

function Reports({ snapshot }: { snapshot: AppSnapshot }) {
  const passed = Object.values(snapshot.testResults).filter((r) => r === "PASS").length;
  const report = useMemo(() => ({
    incident_id: `INC-${snapshot.activeScenarioId}-001`,
    selected_zone: snapshot.selectedZoneId,
    root_cause: rootCause(snapshot.selectedZoneId),
    safe_gate: evaluateSafeGate(snapshot.selectedZoneId, snapshot.telemetry, snapshot.equipment, snapshot.networkOnline),
    treatment: zoneById(snapshot.selectedZoneId).treatment,
    safe_samples: snapshot.telemetry.filter((t) => t.metric === "O3" && t.zone_id === snapshot.selectedZoneId).slice(-2),
    closure_status: snapshot.zoneStates[snapshot.selectedZoneId],
    timeline: snapshot.timeline,
  }), [snapshot]);
  return (
    <div className="page-grid reports-grid">
      <Panel title="Audit Metrics" icon={FileJson}>
        <div className="stats-grid">
          <Stat label="H2S target" value={`<= ${limits.h2sTarget} ppm`} />
          <Stat label="O3 occupied ceiling" value={`<= ${limits.occupiedO3Ceiling} ppm`} />
          <Stat label="Scenario tests" value={`${passed}/15 passed`} tone={passed === 15 ? "safe-text" : "warning-text"} />
          <Stat label="Open work orders" value={String(snapshot.workOrders.length)} />
          <Stat label="Response time" value="< 30 sec simulated" />
          <Stat label="Prototype status" value="Not clinically certified" tone="warning-text" />
        </div>
        <div className="controls">
          <button onClick={() => download("scentinel-audit.json", JSON.stringify(report, null, 2), "application/json")}><Download size={15} /> JSON export</button>
          <button onClick={() => download("scentinel-telemetry.csv", toCsv(snapshot), "text/csv")}><Download size={15} /> CSV export</button>
          <button onClick={() => window.print()}><ClipboardList size={15} /> Print incident report</button>
        </div>
      </Panel>
      <Panel title="Printable Incident Report" icon={ClipboardList}>
        <pre className="report-pre">{JSON.stringify(report, null, 2)}</pre>
      </Panel>
    </div>
  );
}

function toCsv(snapshot: AppSnapshot) {
  const rows = ["timestamp,zone_id,sensor_id,metric,value,unit,quality,sequence"];
  for (const t of snapshot.telemetry) rows.push([t.timestamp, t.zone_id, t.sensor_id, t.metric, t.value, t.unit, t.quality, t.sequence].join(","));
  return rows.join("\n");
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function Header({ snapshot, setSnapshot, setView }: { snapshot: AppSnapshot; setSnapshot: (s: AppSnapshot) => void; setView: (v: View) => void }) {
  const selectedZone = zoneById(snapshot.selectedZoneId);
  const selectedSafe = ozoneAllowedNow(snapshot.selectedZoneId, snapshot.telemetry, snapshot.equipment, snapshot.networkOnline);
  return (
    <header className="topbar">
      <div>
        <h1>Scentinel AeroTrace OS</h1>
        <p>Detect · Trace · Contain · Treat · Verify · Prove</p>
      </div>
      <div className="header-actions">
        <Badge tone="safe">Digital Twin</Badge>
        <Badge tone="muted">ESP32/Wokwi compatible telemetry</Badge>
        <Badge tone={selectedSafe ? "warning" : "danger"}>{selectedZone.shortName}: O3 {selectedSafe ? "permitted by SafeGate" : "blocked"}</Badge>
        <button onClick={() => { setSnapshot(runGuidedDemo()); setView("replay"); }}><Play size={15} /> Run Guided Demo</button>
      </div>
    </header>
  );
}

export default function App() {
  const [snapshot, setSnapshotRaw] = useState<AppSnapshot>(loadSaved);
  const [view, setView] = useState<View>("overview");

  const setSnapshot = (next: AppSnapshot) => {
    setSnapshotRaw(next);
    localStorage.setItem("scentinel-snapshot", JSON.stringify({ ...next, running: false }));
  };

  useEffect(() => {
    const storedAcks = localStorage.getItem("scentinel-alert-acks");
    if (storedAcks) {
      const ids = new Set(JSON.parse(storedAcks) as string[]);
      setSnapshotRaw((current) => ({ ...current, alerts: current.alerts.map((a) => ({ ...a, acknowledged: ids.has(a.id) || a.acknowledged })) }));
    }
  }, []);

  const acknowledgeAll = () => {
    const alerts = snapshot.alerts.map((a) => ({ ...a, acknowledged: true }));
    localStorage.setItem("scentinel-alert-acks", JSON.stringify(alerts.map((a) => a.id)));
    setSnapshot({ ...snapshot, alerts });
  };

  const page = {
    overview: <Overview snapshot={snapshot} setSnapshot={setSnapshot} setView={setView} />,
    zone: <ZoneDetail snapshot={snapshot} />,
    aerotrace: <AeroTrace snapshot={snapshot} />,
    safegate: <SafeGate snapshot={snapshot} />,
    hardware: <HardwareLink snapshot={snapshot} setSnapshot={setSnapshot} setView={setView} />,
    simulation: <SimulationLab snapshot={snapshot} setSnapshot={setSnapshot} />,
    replay: <Replay snapshot={snapshot} />,
    maintenance: <Maintenance snapshot={snapshot} />,
    complaints: <Complaints snapshot={snapshot} setSnapshot={setSnapshot} setView={setView} />,
    reports: <Reports snapshot={snapshot} />,
  }[view];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><ShieldCheck /><span>Scentinel</span></div>
        <nav>{viewItems.map(([id, label, Icon]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><Icon size={17} />{label}</button>)}</nav>
        <div className="sidebar-footer">
          <span>Prototype thresholds are configurable defaults and require hospital safety commissioning.</span>
        </div>
      </aside>
      <main>
        <Header snapshot={snapshot} setSnapshot={setSnapshot} setView={setView} />
        {snapshot.alerts.some((a) => !a.acknowledged) ? <AlertStrip alerts={snapshot.alerts} acknowledgeAll={acknowledgeAll} /> : null}
        {page}
      </main>
    </div>
  );
}

function AlertStrip({ alerts, acknowledgeAll }: { alerts: Alert[]; acknowledgeAll: () => void }) {
  const active = alerts.filter((a) => !a.acknowledged).slice(-3);
  return (
    <div className="alert-strip">
      <AlertTriangle size={18} />
      <div>{active.map((a) => <span key={a.id}><strong>{a.severity}</strong> {a.zoneId}: {a.message}</span>)}</div>
      <button onClick={acknowledgeAll}>Acknowledge</button>
    </div>
  );
}
