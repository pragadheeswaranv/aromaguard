
];
const realtimeState = { port: null, reader: null, writer: null, socket: null, connected: false, reading: false, buffer: '' };

$('completionClose').addEventListener('click', () => { $('completionModal').hidden = true; $('packageBtn').focus(); });

function setWorkspace(realtime) {
  $('simulationView').hidden = realtime;
  $('realtimeView').hidden = !realtime;
  $('simulationTab').classList.toggle('active', !realtime); $('simulationTab').setAttribute('aria-selected', String(!realtime));
  $('realtimeTab').classList.toggle('active', realtime); $('realtimeTab').setAttribute('aria-selected', String(realtime));
}
function updateTransportFields() {
  const useWebsocket = $('transportSelect').value === 'websocket';
  $('serialFields').hidden = useWebsocket;
  $('websocketFields').hidden = !useWebsocket;
  $('connectionNote').textContent = useWebsocket
    ? 'Use wss:// for a publicly hosted dashboard. Plain ws:// is blocked on HTTPS pages.'
    : 'Choose USB serial for a directly connected ESP32. Chrome or Edge is required.';
}
function updateConnectionUI(message) {
  const connected = realtimeState.connected;
  $('connectionBadge').classList.toggle('connected', connected);
  $('connectionBadge').innerHTML = connected
    ? '<i data-lucide="wifi"></i><span>ESP32 connected</span>'
    : '<i data-lucide="plug-zap"></i><span>Device disconnected</span>';
  $('connectDeviceBtn').disabled = connected;
  $('disconnectDeviceBtn').disabled = !connected;
  ['remoteAutoBtn', 'remoteStartBtn', 'remoteStopBtn'].forEach(id => { $(id).disabled = !connected; });
  if (message) $('connectionNote').textContent = message;
  lucide.createIcons({ attrs: { width: 16, height: 16 } });
}
function parseTelemetry(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw.trim()) : raw;
    if (typeof data !== 'object' || data === null) return;
    updateTelemetry(data);
  } catch (_) {
    $('connectionNote').textContent = 'Waiting for JSON telemetry from the ESP32.';
  }
}
function updateTelemetry(data) {
  const set = (id, value, digits = 1) => { if (Number.isFinite(Number(value))) $(id).textContent = Number(value).toFixed(digits); };
  set('liveTemperature', data.temperature); set('liveHumidity', data.humidity, 0); set('liveWeight', data.weight, 3); set('liveBattery', data.battery, 0);
  const fan = data.fan ? 'Fan on' : 'Fan off'; const heater = data.heater ? 'Heater on' : 'Heater off';
  $('liveStatus').textContent = data.running === false ? 'Dryer stopped' : `${fan} · ${heater}`;
  $('remoteMode').textContent = data.auto === false ? 'MANUAL' : 'AUTO';
  $('telemetryStamp').textContent = 'Live data received';
  $('liveTime').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
async function readSerial() {
  const decoder = new TextDecoder();
  while (realtimeState.reading && realtimeState.reader) {
    const { value, done } = await realtimeState.reader.read();
    if (done) break;
    realtimeState.buffer += decoder.decode(value, { stream: true });
    const lines = realtimeState.buffer.split(/\r?\n/);
    realtimeState.buffer = lines.pop();
    lines.filter(Boolean).forEach(parseTelemetry);
  }
}
async function connectSerial() {
  if (!('serial' in navigator)) throw new Error('Web Serial is not available. Use Chrome or Edge with USB serial.');
  realtimeState.port = await navigator.serial.requestPort();
  await realtimeState.port.open({ baudRate: Number($('baudRate').value) });
  realtimeState.reader = realtimeState.port.readable.getReader();
  realtimeState.writer = realtimeState.port.writable.getWriter();
  realtimeState.connected = true; realtimeState.reading = true;
  updateConnectionUI('USB serial connected. Waiting for ESP32 telemetry.');
  readSerial().catch(() => disconnectDevice());
}
function connectWebSocket() {
  return new Promise((resolve, reject) => {
    const endpoint = $('websocketUrl').value.trim();
    if (!endpoint) { reject(new Error('Enter the ESP32 secure WebSocket address.')); return; }
    let url;
    try { url = new URL(endpoint); } catch (_) { reject(new Error('Enter a valid WebSocket URL.')); return; }
    if (!['ws:', 'wss:'].includes(url.protocol)) { reject(new Error('The address must start with ws:// or wss://.')); return; }
    if (location.protocol === 'https:' && url.protocol === 'ws:') { reject(new Error('A hosted HTTPS dashboard requires a secure wss:// WebSocket.')); return; }
    const socket = new WebSocket(url);
    socket.onopen = () => { realtimeState.socket = socket; realtimeState.connected = true; updateConnectionUI('WebSocket connected. Streaming ESP32 telemetry.'); resolve(); };
    socket.onmessage = event => parseTelemetry(event.data);
    socket.onerror = () => reject(new Error('Could not connect to the ESP32 WebSocket.'));
    socket.onclose = () => { if (realtimeState.connected) disconnectDevice('ESP32 WebSocket disconnected.'); };
  });
}
async function connectDevice() {
  try {
    if ($('transportSelect').value === 'serial') await connectSerial(); else await connectWebSocket();
    toast('ESP32 connected');
  } catch (error) {
    updateConnectionUI(error.message);
    toast(error.message);
  }
}
async function disconnectDevice(message = 'ESP32 disconnected.') {
  realtimeState.connected = false; realtimeState.reading = false;
