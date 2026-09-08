# AromaGuard realtime setup

AromaGuard has two operating surfaces:

- **Simulation** for demonstrations and testing the dryer rules.
- **Realtime mode** for readings from an ESP32, DHT22 temperature/humidity sensor, HX711 load cell, and fan/heater relay module.

## Recommended connection: USB serial

1. Open AromaGuard in Chrome or Edge.
2. Select **Realtime mode**, leave **USB serial** selected, and click **Connect ESP32**.
3. Choose the ESP32 serial port at 115200 baud.
4. Upload `esp32/AromaGuardESP32.ino` after setting Wi-Fi credentials, GPIO pins, relay polarity, and load-cell scale factor.

The ESP32 sends one JSON telemetry record per line, for example:

```json
{"temperature":30.1,"humidity":42,"weight":1.178,"battery":78,"fan":false,"heater":false,"running":true,"auto":true}
```

The dashboard sends commands in this form:

```json
{"type":"command","action":"stop"}
```

Supported actions are `start`, `stop`, and `auto`.

## Network connection

The provided sketch also exposes an ESP32 WebSocket at `ws://ESP32_IP:81`. This works while AromaGuard runs on `http://localhost` or a local HTTP server. A public HTTPS website must connect through `wss://`; browsers intentionally block an insecure `ws://` connection from an HTTPS page. For a deployed installation, use a TLS-enabled MQTT/WebSocket gateway or reverse proxy and enter its `wss://` address in Realtime mode.

## Hardware safety

Use an opto-isolated relay or SSR, a fused enclosure, an independent thermal cutoff, and a licensed electrician for mains wiring. The ESP32 must never be the only safety cutoff for the heater.
