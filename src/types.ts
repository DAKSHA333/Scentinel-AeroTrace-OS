export type ZoneState = "NORMAL" | "WATCH" | "CONTAIN" | "TREAT" | "PURGE" | "VERIFY" | "SAFE" | "FAULT";
export type ZoneClass = "CLOSED_HIGH_LOAD" | "OCCUPIED_INTERMITTENT" | "OUTDOOR_VENT" | "SENSITIVE_RECEPTOR";
export type Quality = "GOOD" | "STALE" | "BAD" | "UNCERTAIN";
export type Metric = "H2S" | "O3" | "odor_index" | "airflow" | "pressure" | "humidity" | "temperature" | "occupancy" | "door_closed" | "moisture" | "LEL";

export type Telemetry = {
  timestamp: string;
  zone_id: string;
  sensor_id: string;
  metric: Metric;
  value: number | boolean | string;
  unit: string;
  quality: Quality;
  sequence: number;
};

export type Zone = {
  id: string;
  name: string;
  shortName: string;
  class: ZoneClass;
  occupancyMode: string;
  treatment: string;
  ozoneAllowed: boolean;
  containment: string;
  safetyRule: string;
  map: { x: number; y: number; w: number; h: number };
  adjacent: string[];
};

export type Equipment = {
  id: string;
  zoneId: string;
  type: string;
  label: string;
  command: string;
  feedback: string;
  criticality: "P0" | "P1" | "P2";
};

export type SafeGateResult = {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
};

export type Alert = {
  id: string;
  zoneId: string;
  severity: "P0" | "P1" | "P2" | "P3";
  message: string;
  acknowledged: boolean;
};

export type TimelineEvent = {
  time: string;
  type: "TELEMETRY" | "STATE" | "AEROTRACE" | "SAFEGATE" | "COMMAND" | "FEEDBACK" | "ALERT" | "ACK" | "VERIFY" | "CLOSE";
  zoneId: string;
  text: string;
};

export type SourceRank = {
  zoneId: string;
  confidence: number;
  evidence: string[];
};

export type Scenario = {
  id: string;
  priority: "P0" | "P1" | "P2";
  title: string;
  initial: string;
  expected: string;
  expectedAlert: string;
  passCriteria: string;
};

export type AppSnapshot = {
  tick: number;
  activeScenarioId: string;
  running: boolean;
  zoneStates: Record<string, ZoneState>;
  telemetry: Telemetry[];
  equipment: Equipment[];
  alerts: Alert[];
  timeline: TimelineEvent[];
  sourceRanks: SourceRank[];
  selectedZoneId: string;
  testResults: Record<string, "PASS" | "FAIL" | "READY" | "RUNNING">;
  networkOnline: boolean;
  lastDataReceived: string;
  workOrders: string[];
};
