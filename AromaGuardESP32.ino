#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <HX711.h>
// Install: DHT sensor library, HX711, ArduinoJson, WebSockets by Markus Sattler.
// Change these values for your workshop network and hardware wiring.
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const int DHT_PIN = 4;
const int DHT_TYPE = DHT22;
const int HX711_DOUT = 16;
const int HX711_SCK = 17;
const int FAN_RELAY_PIN = 26;
const int HEATER_RELAY_PIN = 27;
const int BATTERY_ADC_PIN = 34;
const float SCALE_FACTOR = -7050.0; // Calibrate this value for your load cell.
DHT dht(DHT_PIN, DHT_TYPE);
HX711 scale;
WebSocketsServer socketServer(81);
bool dryerRunning = false;
bool automaticMode = true;
bool fanOn = false;
bool heaterOn = false;
unsigned long lastTelemetry = 0;
void setRelays() {
  // Change LOW/HIGH if your relay board is active-high.
  digitalWrite(FAN_RELAY_PIN, fanOn ? LOW : HIGH);
  digitalWrite(HEATER_RELAY_PIN, heaterOn ? LOW : HIGH);
}
void controlDryer(float temperature) {
  if (!dryerRunning || !automaticMode || isnan(temperature)) {
    fanOn = false;
    heaterOn = false;
  } else if (temperature > 32.0) {
    fanOn = true;
    heaterOn = false;
  } else if (temperature < 29.0) {
    fanOn = false;
    heaterOn = true;
  } else {
    fanOn = false;
    heaterOn = false;
  }
  setRelays();
}
String telemetryJson() {
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  float weightKg = scale.is_ready() ? max(0.0f, scale.get_units(5) / 1000.0f) : 0.0f;
  int battery = map(analogRead(BATTERY_ADC_PIN), 0, 4095, 0, 100); // Adjust divider calibration.
  controlDryer(temperature);
  StaticJsonDocument<256> doc;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["weight"] = weightKg;
  doc["battery"] = constrain(battery, 0, 100);
  doc["fan"] = fanOn;
  doc["heater"] = heaterOn;
  doc["running"] = dryerRunning;
  doc["auto"] = automaticMode;
  String payload;
  serializeJson(doc, payload);
  return payload;
}
void sendTelemetry() {
  String payload = telemetryJson();
  Serial.println(payload);       // USB serial transport used by the AromaGuard web app.
  socketServer.broadcastTXT(payload); // WebSocket transport at ws://ESP32_IP:81.
}
void onSocketEvent(uint8_t client, WStype_t type, uint8_t* payload, size_t length) {
  if (type != WStype_TEXT) return;
  StaticJsonDocument<192> command;
  if (deserializeJson(command, payload, length)) return;
  const char* action = command["action"] | "";
  if (strcmp(action, "start") == 0) dryerRunning = true;
  if (strcmp(action, "stop") == 0) dryerRunning = false;
  if (strcmp(action, "auto") == 0) automaticMode = true;
  sendTelemetry();
}
void setup() {
  Serial.begin(115200);
  pinMode(FAN_RELAY_PIN, OUTPUT);
  pinMode(HEATER_RELAY_PIN, OUTPUT);
  setRelays();
  dht.begin();
