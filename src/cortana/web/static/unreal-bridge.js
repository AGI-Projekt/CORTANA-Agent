(() => {
  "use strict";
  const VERSION = 1;
  const CHANNELS = Object.freeze(["browInnerUp","browDown","eyeWide","eyeSquint","cheekRaise","jawOpen","mouthSmile","mouthFrown","mouthPucker","mouthWide","lipPress","upperLipRaise","lowerLipDepress"]);
  const EMOTIONS = new Set(["calm","joy","sadness","anger","fear","surprise","disgust","determination"]);
  const VISEMES = new Set(["neutral","open","mid","wide","round","closed","teeth"]);
  const STATES = new Set(["idle","listening","thinking","speaking"]);
  const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  function normalizeFrame(input = {}, sequence = 0, timestampMs = 0) {
    const facial = input.facial || {};
    const blendshapes = {};
    for (const key of CHANNELS) blendshapes[key] = clamp(facial[key]);
    return Object.freeze({
      type:"cortana.avatar.frame", version:VERSION, sequence,
      timestampMs:Math.max(0, timestampMs),
      state:STATES.has(input.state) ? input.state : "idle",
      emotion:EMOTIONS.has(input.emotion) ? input.emotion : "calm",
      viseme:VISEMES.has(input.viseme) ? input.viseme : "neutral",
      audioLevel:clamp(input.audioLevel), blendshapes
    });
  }
  function createUnrealBridge(options = {}) {
    const WebSocketImpl = options.WebSocket || window.WebSocket;
    const minIntervalMs = Math.max(16, Math.min(100, Number(options.minIntervalMs) || 33));
    let socket = null, sequence = 0, lastSentAt = -Infinity, droppedFrames = 0;
    function connect(url) {
      if (typeof WebSocketImpl !== "function") throw new Error("WebSocket is unavailable");
      let parsed;
      try { parsed = new URL(url); } catch (_) { throw new Error("Invalid Unreal bridge URL"); }
      const local = ["localhost","127.0.0.1","[::1]"].includes(parsed.hostname);
      if (parsed.protocol !== "wss:" && !(local && parsed.protocol === "ws:")) throw new Error("Use wss://, or ws:// only for localhost development");
      if (socket && socket.readyState < 2) socket.close(1000, "replaced");
      socket = new WebSocketImpl(parsed.toString());
      sequence = 0; lastSentAt = -Infinity;
      return socket;
    }
    function publish(input = {}) {
      if (!socket || socket.readyState !== 1) return false;
      const now = Number.isFinite(input.timestampMs) ? input.timestampMs : (window.performance ? window.performance.now() : Date.now());
      if (now - lastSentAt < minIntervalMs) { droppedFrames += 1; return false; }
      socket.send(JSON.stringify(normalizeFrame(input, ++sequence, now)));
      lastSentAt = now;
      return true;
    }
    function disconnect() {
      if (socket && socket.readyState < 2) socket.close(1000, "client disconnect");
      socket = null;
    }
    function getStatus() { return Object.freeze({connected:Boolean(socket && socket.readyState === 1),sequence,droppedFrames}); }
    return Object.freeze({connect,publish,disconnect,getStatus});
  }
  window.CortanaUnrealBridge = Object.freeze({version:"1.0.0",protocolVersion:VERSION,channels:CHANNELS,normalizeFrame,createUnrealBridge});
})();