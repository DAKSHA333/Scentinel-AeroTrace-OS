# Scentinel AeroTrace OS Dashboard

Working software prototype for the hospital odor-control hackathon project.

## What It Demonstrates

- Detect, trace, contain, treat, verify and prove workflow.
- Ten hospital zones with live digital-twin telemetry.
- SafeGate hard interlock logic for sealed ozone treatment.
- AeroTrace explainable source localization.
- Scenario lab for T01-T15 acceptance tests.
- Incident replay, maintenance, complaints, reports and audit export.

This is a software and digital-twin prototype only. It is not clinically certified and does not operate real ozone or hazardous gas equipment.

## Install

```bash
npm install
```

## Run

```bash
npm run dev -- --port 5173
```

Open:

```text
http://127.0.0.1:5173/
```

## Build Check

```bash
npm run build
```

## Guided Demo

Use **Run Guided Demo** from the top bar or Operations screen. The guided sequence shows:

1. Normal hospital monitoring.
2. Corridor odor alert.
3. AeroTrace source ranking.
4. Upstream source containment.
5. Zone-safe treatment.
6. SafeGate protection.
7. Verified recovery and audit evidence.

## Scenario Lab

Open **Simulation Lab**, choose T01-T15, then use:

- **Run step** for controlled progression.
- **Run to end** for one scenario.
- **Run all tests** for the full acceptance set.
- **Restart** to reset a scenario.

Important demo scenarios:

- T02: sealed mortuary treatment passes only when SafeGate permits it.
- T05: ozone leak forces fail-safe shutdown.
- T10: occupied dirty utility uses carbon and never ozone.
- T14: corridor complaint is traced to the upstream dirty utility source.

## Future Wokwi / ESP32 Integration

The digital twin uses the telemetry shape intended for future device data:

```ts
{
  timestamp: string,
  zone_id: string,
  sensor_id: string,
  metric: string,
  value: number | boolean | string,
  unit: string,
  quality: "GOOD" | "STALE" | "BAD" | "UNCERTAIN",
  sequence: number
}
```

To connect Wokwi/ESP32 later, replace the local digital-twin telemetry producer with incoming messages using this same structure. Keep SafeGate evaluation local and deterministic.

## Safety Rules Preserved

- Ozone is only shown as available for sealed, approved treatment paths.
- Occupied and sensitive receptor zones never receive ozone.
- Unsafe, stale, unknown or missing critical data blocks ozone.
- Manual override cannot bypass SafeGate.
- Re-entry requires purge plus two safe O3 samples.
- Carbon health uses removal efficiency, runtime, humidity and pressure, not pressure alone.
