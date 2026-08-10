import type { Equipment, Scenario, Zone } from "./types";

export const limits = {
  h2sTarget: 0.1,
  occupiedO3Ceiling: 0.05,
  ozoneLeakTrip: 0.03,
  safeSampleCount: 2,
  criticalSensorStaleSeconds: 10,
  aerotraceAutoConfidence: 0.65,
  carbonBreakthrough: 0.7,
  biofilterUnderperformance: 0.6,
};

export const zones: Zone[] = [
  { id: "Z01", name: "Mortuary treatment chamber", shortName: "Mortuary", class: "CLOSED_HIGH_LOAD", occupancyMode: "Normally unoccupied; controlled entry", treatment: "Sealed O3 contact path + catalytic destructor + carbon polish", ozoneAllowed: true, containment: "Sealed chamber + negative pressure", safetyRule: "Purge + two safe samples before entry", map: { x: 7, y: 12, w: 18, h: 22 }, adjacent: ["Z06", "Z02"] },
  { id: "Z02", name: "Sewage sump extraction", shortName: "Sewage sump", class: "CLOSED_HIGH_LOAD", occupancyMode: "Unoccupied process space", treatment: "Sealed downstream O3 path + destructor; emergency ventilation", ozoneAllowed: true, containment: "Extracted negative-pressure duct", safetyRule: "High H2S or LEL inhibits ozone", map: { x: 7, y: 42, w: 18, h: 22 }, adjacent: ["Z01", "Z05"] },
  { id: "Z03", name: "Dirty utility / sluice", shortName: "Dirty utility", class: "OCCUPIED_INTERMITTENT", occupancyMode: "Intermittently occupied", treatment: "Negative pressure + activated carbon + drain/root-cause correction", ozoneAllowed: false, containment: "Negative pressure at doorway", safetyRule: "Occupancy uncertainty treated as occupied", map: { x: 33, y: 12, w: 19, h: 22 }, adjacent: ["Z06", "Z04", "Z07"] },
  { id: "Z04", name: "Biomedical-waste holding", shortName: "Waste hold", class: "OCCUPIED_INTERMITTENT", occupancyMode: "Short staff visits", treatment: "Source enclosure + carbon + pickup SLA workflow", ozoneAllowed: false, containment: "Source enclosure + negative exhaust", safetyRule: "Temperature and pickup breach create work order", map: { x: 33, y: 42, w: 19, h: 22 }, adjacent: ["Z03", "Z10", "Z06"] },
  { id: "Z05", name: "STP vent stack", shortName: "STP vent", class: "OUTDOOR_VENT", occupancyMode: "Outdoor", treatment: "Moisture-controlled biofilter", ozoneAllowed: false, containment: "Ducted through media bed", safetyRule: "Efficiency and moisture health proven continuously", map: { x: 7, y: 72, w: 18, h: 18 }, adjacent: ["Z02"] },
  { id: "Z06", name: "Corridor odor receptor", shortName: "Corridor", class: "SENSITIVE_RECEPTOR", occupancyMode: "Continuously occupied", treatment: "Receptor monitoring + upstream source control; no local dosing", ozoneAllowed: false, containment: "Pressure boundary + source isolation", safetyRule: "AeroTrace ranks source; receptor never receives ozone", map: { x: 27, y: 35, w: 46, h: 18 }, adjacent: ["Z01", "Z03", "Z04", "Z08"] },
  { id: "Z07", name: "Public / staff toilets", shortName: "Toilets", class: "OCCUPIED_INTERMITTENT", occupancyMode: "Frequently occupied", treatment: "Exhaust + carbon + drain maintenance", ozoneAllowed: false, containment: "Continuous exhaust", safetyRule: "Cleaning and drain task linked to event", map: { x: 59, y: 12, w: 16, h: 22 }, adjacent: ["Z03", "Z06"] },
  { id: "Z08", name: "ICU / OT boundary", shortName: "ICU / OT", class: "SENSITIVE_RECEPTOR", occupancyMode: "Continuously occupied; high sensitivity", treatment: "Monitoring + upstream source shutdown", ozoneAllowed: false, containment: "Positive-pressure coordination", safetyRule: "Any O3 detection triggers investigation and source shutdown", map: { x: 79, y: 12, w: 16, h: 22 }, adjacent: ["Z06"] },
  { id: "Z09", name: "Laundry utility", shortName: "Laundry", class: "OCCUPIED_INTERMITTENT", occupancyMode: "Occupied during shifts", treatment: "Exhaust + humidity-aware carbon", ozoneAllowed: false, containment: "Local exhaust", safetyRule: "High humidity derates carbon-health estimate", map: { x: 59, y: 62, w: 16, h: 22 }, adjacent: ["Z06", "Z04"] },
  { id: "Z10", name: "Kitchen-waste holding", shortName: "Kitchen waste", class: "OCCUPIED_INTERMITTENT", occupancyMode: "Staff access", treatment: "Enclosure + carbon + wash and pickup workflow", ozoneAllowed: false, containment: "Source enclosure + exhaust", safetyRule: "Pickup and wash SLA are root-cause controls", map: { x: 79, y: 62, w: 16, h: 22 }, adjacent: ["Z04"] },
];

export const baseEquipment: Equipment[] = [
  { id: "E001", zoneId: "Z01", type: "EDGE_CONTROLLER", label: "Local controller", command: "RUN", feedback: "watchdog healthy", criticality: "P0" },
  { id: "E002", zoneId: "Z01", type: "EXTRACTION_FAN", label: "Negative-pressure fan", command: "AUTO", feedback: "airflow proven", criticality: "P0" },
  { id: "E003", zoneId: "Z01", type: "OZONE_GENERATOR", label: "Sealed O3 generator", command: "OFF", feedback: "relay off", criticality: "P0" },
  { id: "E004", zoneId: "Z01", type: "CATALYTIC_DESTRUCTOR", label: "Catalytic destructor", command: "READY", feedback: "temperature healthy", criticality: "P0" },
  { id: "E005", zoneId: "Z01", type: "DOOR_LOCK", label: "Controlled-entry lock", command: "LOCK", feedback: "locked", criticality: "P0" },
  { id: "E010", zoneId: "Z03", type: "EXTRACTION_FAN", label: "Occupied-zone exhaust", command: "AUTO", feedback: "airflow proven", criticality: "P0" },
  { id: "E011", zoneId: "Z03", type: "CARBON_BANK", label: "Activated-carbon bank", command: "AVAILABLE", feedback: "in/out gas and DP healthy", criticality: "P1" },
  { id: "E013", zoneId: "Z04", type: "EXTRACTION_FAN", label: "Waste-room exhaust", command: "AUTO", feedback: "airflow proven", criticality: "P1" },
  { id: "E014", zoneId: "Z04", type: "CARBON_BANK", label: "Waste carbon bank", command: "AVAILABLE", feedback: "gas delta healthy", criticality: "P1" },
  { id: "E015", zoneId: "Z05", type: "BIOFILTER_BED", label: "Biofilter bed", command: "AVAILABLE", feedback: "H2S removal healthy", criticality: "P1" },
  { id: "E016", zoneId: "Z05", type: "IRRIGATION_VALVE", label: "Moisture valve", command: "CLOSE", feedback: "moisture in window", criticality: "P1" },
  { id: "E018", zoneId: "Z07", type: "EXTRACTION_FAN", label: "Toilet exhaust", command: "AUTO", feedback: "airflow proven", criticality: "P1" },
  { id: "E020", zoneId: "Z09", type: "EXTRACTION_FAN", label: "Laundry exhaust", command: "AUTO", feedback: "airflow proven", criticality: "P1" },
  { id: "E022", zoneId: "Z10", type: "EXTRACTION_FAN", label: "Kitchen-waste exhaust", command: "AUTO", feedback: "airflow proven", criticality: "P1" },
];

export const safeGatePermissionLabels = [
  ["SG01", "Zone policy permits ozone"],
  ["SG02", "Occupancy clear and known"],
  ["SG03", "Door closed and locked"],
  ["SG04", "Treatment fan running"],
  ["SG05", "Exhaust airflow proven"],
  ["SG06", "Destructor healthy"],
  ["SG07", "O3 sensors healthy and fresh"],
  ["SG08", "No ozone leak"],
  ["SG09", "Process gas risk acceptable"],
  ["SG10", "Emergency stop healthy"],
  ["SG11", "Relay feedback matches"],
  ["SG12", "Local watchdog healthy"],
] as const;

export const scenarios: Scenario[] = [
  { id: "T01", priority: "P1", title: "Nominal monitoring", initial: "All zones NORMAL", expected: "No false alert", expectedAlert: "None", passCriteria: "All equipment remains in safe normal state" },
  { id: "T02", priority: "P0", title: "Safe sealed mortuary treatment", initial: "Z01 H2S rises while occupancy clear", expected: "WATCH > CONTAIN > TREAT > PURGE > VERIFY > SAFE", expectedAlert: "High-load odor incident", passCriteria: "O3 runs only after all permissives; two safe samples before release" },
  { id: "T03", priority: "P0", title: "Occupancy blocks ozone", initial: "Z01 CONTAIN with occupancy detected", expected: "FAULT", expectedAlert: "Unsafe occupancy", passCriteria: "Zero O3 command events after occupancy becomes true" },
  { id: "T04", priority: "P0", title: "Door opens during ozone cycle", initial: "Z01 TREAT, door opens", expected: "FAULT", expectedAlert: "Door interlock trip", passCriteria: "O3 feedback OFF within local cycle; event recorded" },
  { id: "T05", priority: "P0", title: "Ozone leak trip", initial: "Z01 TREAT, leak monitor crosses trip", expected: "FAULT", expectedAlert: "O3 leak trip", passCriteria: "No re-entry release until fault cleared and safe samples collected" },
  { id: "T06", priority: "P0", title: "Stale O3 outlet sensor", initial: "Z01 CONTAIN, O3 outlet stale", expected: "FAULT", expectedAlert: "Critical sensor stale", passCriteria: "Unknown quality is unsafe; no dose command" },
  { id: "T07", priority: "P0", title: "Fan feedback lost", initial: "Z01 TREAT, fan feedback lost", expected: "FAULT", expectedAlert: "Airflow proof lost", passCriteria: "Command/feedback mismatch visible in replay" },
  { id: "T08", priority: "P0", title: "Destructor fault blocks treatment", initial: "Z01 TREAT, destructor unhealthy", expected: "FAULT", expectedAlert: "Destructor fault", passCriteria: "Cycle cannot resume through manual override" },
  { id: "T09", priority: "P0", title: "Network loss", initial: "Gateway and dashboard disconnected", expected: "NO_CHANGE", expectedAlert: "Network offline", passCriteria: "Local control continues and buffers signed events" },
  { id: "T10", priority: "P0", title: "Occupied dirty utility uses carbon", initial: "Z03 odor spike while occupied", expected: "WATCH > CONTAIN > TREAT > VERIFY > SAFE", expectedAlert: "Occupied-zone odor", passCriteria: "No O3 command exists; occupant-facing H2S returns to target" },
  { id: "T11", priority: "P1", title: "Carbon breakthrough", initial: "Z03 removal efficiency falls below 70%", expected: "FAULT", expectedAlert: "Carbon breakthrough", passCriteria: "Efficiency uses inlet/outlet delta plus runtime, RH and DP" },
  { id: "T12", priority: "P1", title: "Dry biofilter service", initial: "Z05 moisture low and removal below 60%", expected: "FAULT", expectedAlert: "Biofilter under-performance", passCriteria: "Dashboard shows efficiency cause and recovery task" },
  { id: "T13", priority: "P0", title: "High H2S emergency", initial: "Z02 independent high-range H2S alarm", expected: "FAULT", expectedAlert: "High H2S emergency", passCriteria: "Independent monitor inhibits ozone and escalates" },
  { id: "T14", priority: "P1", title: "Corridor complaint traced upstream", initial: "Z06 complaint follows upstream plume", expected: "WATCH", expectedAlert: "Source confidence available", passCriteria: "Top-ranked source and reasons match scenario truth; no receptor dosing" },
  { id: "T15", priority: "P0", title: "Verified re-entry", initial: "Z01 VERIFY, acknowledgement plus two safe samples", expected: "SAFE", expectedAlert: "Recovery verified", passCriteria: "Release occurs only after root cause clear, ack and two safe samples" },
];
