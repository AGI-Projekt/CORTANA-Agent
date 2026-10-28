(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const el = {
    avatar: byId("avatar"), avatarState: byId("avatar-state"), chatLog: byId("chat-log"),
    form: byId("composer-form"), input: byId("message-input"), send: byId("send-button"),
    mic: byId("mic-button"), clear: byId("clear-button"), voiceOutput: byId("voice-output-toggle"),
    working: byId("working-state"), workingText: byId("working-text"), error: byId("error-banner"),
    latency: byId("latency-label"), micSupport: byId("mic-support"), connection: byId("connection-label"),
    realtimeButton: byId("realtime-button"), realtimeVoice: byId("realtime-voice-select"),
    realtimeCaption: byId("realtime-caption"), realtimeAudio: byId("realtime-audio"),
    realtimeEmotionOptIn: byId("realtime-emotion-opt-in"), realtimeEmotionStatus: byId("realtime-emotion-status")
  };
  const newSession = () => (window.crypto && typeof window.crypto.randomUUID === "function")
    ? window.crypto.randomUUID()
    : "session-" + Date.now().toString(36) + Math.random().toString(36).slice(2);
  let sessionId = newSession(), recorder = null, mediaStream = null, recordedChunks = [];
  let autoStopTimer = null, busy = false, recording = false, voiceCounter = 0;
  let realtimeActive = false, realtimeConnecting = false, realtimePeer = null, realtimeChannel = null;
  let realtimeStream = null, liveAssistantP = null, liveAssistantText = "";
  let remoteAudioContext = null, remoteAudioAnalyser = null, remoteAudioSource = null;
  let remotePlaybackAnchor = null;
  let remoteAudioOnsetDetected = false;

  let remoteAudioSamples = null, remoteAudioFrame = null, remoteAudioLevel = 0;

  const labels = { idle:"READY", listening:"LISTENING", thinking:"PROCESSING", speaking:"SPEAKING" };
  const toneLabels = { neutral:"NEUTRAL", supportive:"SUPPORTIVE", exploratory:"EXPLORATORY", upbeat:"UPBEAT" };
  function setAvatarState(state) {
    el.avatar.dataset.state = state;
    el.avatarState.textContent = labels[state] || "READY";
  }
  function setAvatarTone(tone) {
    const safeTone = Object.prototype.hasOwnProperty.call(toneLabels, tone) ? tone : "neutral";
    el.avatar.dataset.tone = safeTone;
    const label = byId("avatar-tone");
    if (label) label.textContent = toneLabels[safeTone];
  }
  const emotionLabels = {
    calm: "SPOKÓJ", joy: "RADOŚĆ", sadness: "SMUTEK", anger: "ZŁOŚĆ",
    fear: "STRACH", surprise: "ZASKOCZENIE", disgust: "ODRAZA",
    determination: "DETERMINACJA"
  };
  function setAvatarEmotion(emotion) {
    const safeEmotion = Object.prototype.hasOwnProperty.call(emotionLabels, emotion) ? emotion : "calm";
    el.avatar.dataset.emotion = safeEmotion;
    window.dispatchEvent(new CustomEvent("cortana:emotion-transition", {
      detail: { emotion: safeEmotion, source: "emotion-core-ui" }
    }));
    const label = byId("avatar-emotion");
    if (label) label.textContent = emotionLabels[safeEmotion];
  }
  function setWorking(text, isBusy) {
    el.workingText.textContent = text;
    el.working.dataset.busy = isBusy ? "true" : "false";
  }
  function showError(text) {
    el.error.textContent = text;
    el.error.hidden = !text;
  }
  function addMessage(role, text) {
    const article = document.createElement("article");
    article.className = "message " + (role === "user" ? "user-message" : "assistant-message");
    const label = document.createElement("div");
    label.className = "message-label";
    label.textContent = role === "user" ? "TY" : "CORTANA";
    const body = document.createElement("p");
    body.textContent = text;
    article.append(label, body);
    el.chatLog.appendChild(article);
    el.chatLog.scrollTop = el.chatLog.scrollHeight;
  }
  function setBusy(value) {
    busy = value;
    const locked = value || realtimeActive || realtimeConnecting;
    el.send.disabled = locked;
    el.input.disabled = locked;
    el.mic.disabled = locked;
    el.realtimeButton.disabled = value && !realtimeActive;
  }
  function choosePolishVoice() {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    return voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("pl"))
      || voices.find((v) => v.default) || voices[0] || null;
  }
  function speakText(text) {
    if (!el.voiceOutput.checked || !("speechSynthesis" in window)) {
      setAvatarState("idle");
      return Promise.resolve();
    }
    window.speechSynthesis.cancel();
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = choosePolishVoice();
      utterance.lang = voice ? voice.lang : "pl-PL";
      if (voice) utterance.voice = voice;
      utterance.rate = 1;
      utterance.pitch = 1.02;
      utterance.onstart = () => {
        setAvatarState("speaking");
        el.avatar.dataset.mouthOpen = "0.18";
        window.dispatchEvent(new CustomEvent("cortana:voice-state", { detail: { speaking: true, source: "speech-synthesis" } }));
        el.latency.textContent = "VOICE OUTPUT";
      };
      utterance.onboundary = () => {
        voiceCounter += 1;
        el.avatar.dataset.mouthOpen = voiceCounter % 2 ? "0.48" : "0.2";
        window.dispatchEvent(new CustomEvent("cortana:voice-state", { detail: { speaking: true, source: "speech-synthesis", boundary: voiceCounter } }));
        const mouth = document.getElementById("mouth");
        if (mouth) mouth.style.transform = voiceCounter % 2 ? "scaleY(2.5)" : "scaleY(1)";
      };
      utterance.onend = () => {
        el.avatar.dataset.mouthOpen = "0";
        window.dispatchEvent(new CustomEvent("cortana:voice-state", { detail: { speaking: false, source: "speech-synthesis" } }));
        const mouth = document.getElementById("mouth");
        if (mouth) mouth.style.transform = "";
        setAvatarState("idle");
        resolve();
      };
      utterance.onerror = () => {
        el.avatar.dataset.mouthOpen = "0";
        window.dispatchEvent(new CustomEvent("cortana:voice-state", { detail: { speaking: false, source: "speech-synthesis" } }));
        setAvatarState("idle");
        resolve();
      };
      window.speechSynthesis.speak(utterance);
    });
  }

  function stopRemoteAudioAnalysis() {
    if (remoteAudioFrame !== null) cancelAnimationFrame(remoteAudioFrame);
    remoteAudioFrame = null;
    if (remoteAudioSource) {
      try { remoteAudioSource.disconnect(); } catch (_) {}
    }
    remoteAudioSource = null;
    remoteAudioAnalyser = null;
    remoteAudioSamples = null;
    remoteAudioLevel = 0;
    remotePlaybackAnchor = null;
    remoteAudioOnsetDetected = false;
    if (window.CortanaAudioClock) window.CortanaAudioClock.resetOutputAnchor();
    el.avatar.dataset.liveAudio = "false";
    el.avatar.dataset.mouthOpen = "0";
    const mouth = document.getElementById("mouth");
    if (mouth) mouth.style.transform = "";
    if (remoteAudioContext) {
      const oldContext = remoteAudioContext;
      remoteAudioContext = null;
      oldContext.close().catch(() => {});
    }
  }

  function startRemoteAudioAnalysis(stream) {
    stopRemoteAudioAnalysis();
    if (!stream || typeof window.AudioContext !== "function") return false;
    try {
      remoteAudioContext = new AudioContext();
      remoteAudioAnalyser = remoteAudioContext.createAnalyser();
      remoteAudioAnalyser.fftSize = 256;
      remoteAudioAnalyser.smoothingTimeConstant = 0.2;
      remoteAudioSource = remoteAudioContext.createMediaStreamSource(stream);
      remoteAudioSource.connect(remoteAudioAnalyser);
      // Play the analyzed stream through the same Web Audio clock domain.
      remoteAudioAnalyser.connect(remoteAudioContext.destination);
      remoteAudioSamples = new Uint8Array(remoteAudioAnalyser.fftSize);
      el.avatar.dataset.liveAudio = "true";
      if (remoteAudioContext.state === "suspended") remoteAudioContext.resume().catch(() => {});
      const sampleAudio = () => {
        if (!remoteAudioAnalyser || !remoteAudioSamples) return;
        remoteAudioAnalyser.getByteTimeDomainData(remoteAudioSamples);
        let sumSquares = 0;
        for (let i = 0; i < remoteAudioSamples.length; i += 1) {
          const sample = (remoteAudioSamples[i] - 128) / 128;
          sumSquares += sample * sample;
        }
        const rms = Math.sqrt(sumSquares / remoteAudioSamples.length);
        // Capture an output-clock reference on first audible frame, not phoneme timing.
        if (!remoteAudioOnsetDetected && rms >= 0.035 && window.CortanaAudioClock) {
          remoteAudioOnsetDetected = true;
          try {
            remotePlaybackAnchor = window.CortanaAudioClock.markOutputStart(remoteAudioContext);
            el.avatar.dataset.audioAnchorSource = remotePlaybackAnchor.source;
          } catch (_) { remotePlaybackAnchor = null; }
        }
        const target = Math.max(0, Math.min(1, (rms - 0.018) * 15));
        const smoothing = target > remoteAudioLevel ? 0.55 : 0.16;
        remoteAudioLevel += (target - remoteAudioLevel) * smoothing;
        el.avatar.dataset.mouthOpen = String(remoteAudioLevel);
        const mouth = document.getElementById("mouth");
        if (mouth && !el.avatar.classList.contains("three-active")) {
          mouth.style.transform = "scaleY(" + (1 + remoteAudioLevel * 2.4) + ")";
        }
        remoteAudioFrame = requestAnimationFrame(sampleAudio);
      };
      remoteAudioFrame = requestAnimationFrame(sampleAudio);
      return true;
    } catch (_) {
      stopRemoteAudioAnalysis();
      return false;
    }
  }

  function setRealtimeCaption(text, active) {
    el.realtimeCaption.textContent = text;
    el.realtimeCaption.dataset.connected = active ? "true" : "false";
  }
  function appendLiveTranscript(role, text, finalText) {
    if (role === "user") {
      const clean = (text || "").trim();
      if (clean) addMessage("user", clean);
      return;
    }
    if (!liveAssistantP) {
      addMessage("assistant", "");
      liveAssistantP = el.chatLog.lastElementChild.querySelector("p");
      liveAssistantText = "";
    }
    if (typeof finalText === "string" && finalText.trim()) {
      liveAssistantText = finalText;
    } else {
      liveAssistantText += text || "";
    }
    liveAssistantP.textContent = liveAssistantText;
    el.chatLog.scrollTop = el.chatLog.scrollHeight;
  }
  async function updateRealtimeEmotion(transcript) {
    if (!el.realtimeEmotionOptIn || !el.realtimeEmotionOptIn.checked || !transcript.trim()) return;
    if (el.realtimeEmotionStatus) el.realtimeEmotionStatus.textContent = "EMOTION HINTS: ANALYZING";
    try {
      const response = await fetch("/api/realtime/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true, transcript: transcript })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("Emotion hint unavailable");
      setAvatarTone(payload.response_style || "neutral");
      setAvatarEmotion(payload.avatar_expression || "calm");
      if (el.realtimeEmotionStatus) {
        const states = {
          adjusted: "EMOTION HINTS: ACTIVE",
          neutral: "EMOTION HINTS: NEUTRAL",
          disabled: "EMOTION HINTS: OFF",
          unavailable: "EMOTION HINTS: UNAVAILABLE",
          invalid_response: "EMOTION HINTS: NEUTRAL"
        };
        el.realtimeEmotionStatus.textContent = states[payload.status] || "EMOTION HINTS: NEUTRAL";
      }
      // The update guides subsequent Realtime responses; the current response may already be underway.
      if (payload.instructions && realtimeChannel && realtimeChannel.readyState === "open") {
        realtimeChannel.send(JSON.stringify({
          type: "session.update",
          session: { type: "realtime", instructions: payload.instructions }
        }));
      }
    } catch (_) {
      setAvatarTone("neutral");
      setAvatarEmotion("calm");
      if (el.realtimeEmotionStatus) el.realtimeEmotionStatus.textContent = "EMOTION HINTS: UNAVAILABLE";
    }
  }

  async function resetRealtimeEmotion() {
    setAvatarTone("neutral");
    setAvatarEmotion("calm");
    if (el.realtimeEmotionStatus) el.realtimeEmotionStatus.textContent = "EMOTION HINTS: OFF";
    if (!realtimeChannel || realtimeChannel.readyState !== "open") return;
    try {
      const response = await fetch("/api/realtime/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false })
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.instructions && realtimeChannel && realtimeChannel.readyState === "open") {
        realtimeChannel.send(JSON.stringify({
          type: "session.update",
          session: { type: "realtime", instructions: payload.instructions }
        }));
      }
    } catch (_) {}
  }

  function handleRealtimeEvent(event) {
    if (!event || typeof event.type !== "string") return;
    if (event.type === "input_audio_buffer.speech_started") {
      setAvatarState("listening");
      setWorking("Słucham — tryb rozmowy na żywo", true);
    } else if (event.type === "input_audio_buffer.speech_stopped") {
      setAvatarState("thinking");
      setWorking("Cortana przygotowuje odpowiedź…", true);
    } else if (event.type === "conversation.item.input_audio_transcription.completed") {
      const transcript = typeof event.transcript === "string" ? event.transcript.trim() : "";
      appendLiveTranscript("user", transcript);
      if (transcript && el.realtimeEmotionOptIn && el.realtimeEmotionOptIn.checked) {
        void updateRealtimeEmotion(transcript);
      }
    } else if (event.type === "response.created") {
      if (window.CortanaVisemeScheduler) window.CortanaVisemeScheduler.reset();
      remoteAudioOnsetDetected = false;
      remotePlaybackAnchor = null;
      if (window.CortanaAudioClock) window.CortanaAudioClock.resetOutputAnchor();
      setAvatarState("thinking");
      setWorking("Cortana odpowiada…", true);
      liveAssistantP = null;
      liveAssistantText = "";
    } else if (event.type === "response.output_audio.delta" || event.type === "response.audio.delta") {
      setAvatarState("speaking");
    } else if (
      event.type === "response.output_audio_transcript.delta" ||
      event.type === "response.audio_transcript.delta"
    ) {
      appendLiveTranscript("assistant", event.delta || "");
      if (window.CortanaVisemeScheduler) window.CortanaVisemeScheduler.enqueue(event.delta || "");
    } else if (
      event.type === "response.output_audio_transcript.done" ||
      event.type === "response.audio_transcript.done"
    ) {
      if (typeof event.transcript === "string" && event.transcript.trim()) {
        appendLiveTranscript("assistant", "", event.transcript);
      }
    } else if (
      event.type === "response.output_audio.done" ||
      event.type === "response.audio.done" ||
      event.type === "response.done"
    ) {
      if (realtimeActive) {
        setAvatarState("listening");
        setWorking("Rozmowa na żywo — Cortana słucha", true);
      }
      liveAssistantP = null;
      liveAssistantText = "";
    } else if (event.type === "error") {
      showError("Sesja głosowa zgłosiła błąd. Zakończ połączenie i spróbuj ponownie.");
      setWorking("Problem z sesją głosową", false);
      setAvatarState("idle");
    }
  }
  function cleanupRealtime() {
    stopRemoteAudioAnalysis();
    if (window.CortanaVisemeScheduler) window.CortanaVisemeScheduler.reset();
    realtimeActive = false;
    realtimeConnecting = false;
    liveAssistantP = null;
    liveAssistantText = "";
    if (realtimeChannel) {
      try { realtimeChannel.close(); } catch (_) {}
      realtimeChannel = null;
    }
    if (realtimePeer) {
      try { realtimePeer.close(); } catch (_) {}
      realtimePeer = null;
    }
    if (realtimeStream) {
      realtimeStream.getTracks().forEach((track) => track.stop());
      realtimeStream = null;
    }
    if (el.realtimeAudio) {
      el.realtimeAudio.pause();
      el.realtimeAudio.srcObject = null;
      el.realtimeAudio.muted = false;
    }
    el.realtimeButton.textContent = "Połącz głos na żywo";
    el.realtimeButton.dataset.connected = "false";
    el.realtimeButton.setAttribute("aria-pressed", "false");
    el.realtimeVoice.disabled = false;
    el.micSupport.textContent = "Mikrofon: wymaga zgody";
    setRealtimeCaption("REALTIME: OFF", false);
    setBusy(false);
    setAvatarState("idle");
    setWorking("Czekam na wiadomość", false);
  }
  async function startRealtime() {
    if (busy || recording || realtimeConnecting || realtimeActive) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.RTCPeerConnection) {
      showError("Ta przeglądarka nie obsługuje WebRTC lub mikrofonu. Użyj aktualnej przeglądarki na localhost albo HTTPS.");
      return;
    }
    showError("");
    realtimeConnecting = true;
    setBusy(true);
    setAvatarState("thinking");
    setWorking("Przygotowuję bezpieczną sesję głosową…", true);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    try {
      // The microphone is requested only after the user activates this control.
      realtimeStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      const tokenResponse = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: el.realtimeVoice.value })
      });
      const token = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || typeof token.value !== "string" || !token.value) {
        throw new Error(token.detail || "Nie można utworzyć sesji głosowej. Sprawdź klucz API i dostęp do modelu.");
      }
      const peer = new RTCPeerConnection();
      realtimePeer = peer;
      peer.ontrack = (event) => {
        el.realtimeAudio.srcObject = event.streams[0];
        el.realtimeAudio.muted = true;
        const analysisStarted = startRemoteAudioAnalysis(event.streams && event.streams[0]);
        if (!analysisStarted) {
          // Browser fallback: keep voice audible if Web Audio analysis is unavailable.
          el.realtimeAudio.muted = false;
          const playResult = el.realtimeAudio.play();
          if (playResult && typeof playResult.catch === "function") playResult.catch(() => {});
        }
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed") {
          showError("Połączenie głosowe zostało przerwane.");
          cleanupRealtime();
        }
      };
      realtimeStream.getTracks().forEach((track) => peer.addTrack(track, realtimeStream));
      const channel = peer.createDataChannel("oai-events");
      realtimeChannel = channel;
      channel.addEventListener("open", () => {
        setWorking("Połączenie gotowe — mów naturalnie", true);
      });
      channel.addEventListener("message", (event) => {
        try { handleRealtimeEvent(JSON.parse(event.data)); } catch (_) {}
      });
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token.value,
          "Content-Type": "application/sdp"
        },
        body: offer.sdp
      });
      if (!sdpResponse.ok) {
        throw new Error("Nie udało się zestawić połączenia z usługą głosową. Sprawdź dostęp do Realtime API.");
      }
      const answerSdp = await sdpResponse.text();
      await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
      realtimeActive = true;
      realtimeConnecting = false;
      el.realtimeButton.textContent = "Zakończ rozmowę";
      el.realtimeButton.dataset.connected = "true";
      el.realtimeButton.setAttribute("aria-pressed", "true");
      el.realtimeVoice.disabled = true;
      el.voiceOutput.checked = false;
      el.voiceOutput.disabled = true;
      byId("voice-label").textContent = "LIVE · " + String(token.voice || "marin").toUpperCase();
      el.micSupport.textContent = "MIKROFON LIVE AKTYWNY";
      setRealtimeCaption("REALTIME: CONNECTED", true);
      setBusy(false);
      setAvatarState("listening");
      setWorking("Rozmowa na żywo — Cortana słucha", true);
    } catch (error) {
      cleanupRealtime();
      showError(error instanceof Error ? error.message : "Nie udało się uruchomić rozmowy na żywo.");
    }
  }

  async function sendText(rawText) {
    const text = (rawText || "").trim();
    if (!text || busy) return;
    showError("");
    addMessage("user", text);
    setBusy(true);
    setAvatarState("thinking");
    setWorking("Cortana analizuje wiadomość…", true);
    const started = performance.now();
    try {
      const response = await fetch("/api/chat", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({text:text,session_id:sessionId})
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || "Nie udało się uzyskać odpowiedzi.");
      addMessage("assistant", payload.text || "Nie otrzymałam tekstowej odpowiedzi.");
      setAvatarTone(payload.metadata && payload.metadata.response_style);
      setAvatarEmotion(payload.metadata && payload.metadata.avatar_expression);
      el.latency.textContent = Math.round(performance.now() - started) + " MS";
      el.connection.textContent = "SYSTEM ONLINE";
      setWorking("Odpowiedź gotowa", false);
      setBusy(false);
      await speakText(payload.text || "");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Błąd połączenia z Cortaną.");
      setWorking("Błąd — sprawdź konfigurację serwera", false);
      setAvatarState("idle");
    } finally {
      setBusy(false);
      if (recording) setAvatarState("listening");
    }
  }
  async function uploadRecording(blob) {
    if (!blob || !blob.size) {
      showError("Nagranie jest puste. Spróbuj ponownie.");
      setAvatarState("idle");
      return;
    }
    if (blob.size > 25 * 1024 * 1024) {
      showError("Nagranie przekracza limit 25 MiB.");
      setAvatarState("idle");
      return;
    }
    showError("");
    setWorking("Transkrybuję nagranie…", true);
    setAvatarState("thinking");
    setBusy(true);
    try {
      const extension = blob.type.includes("ogg") ? "ogg" : (blob.type.includes("mp4") ? "mp4" : "webm");
      const formData = new FormData();
      formData.append("file", blob, "cortana-recording." + extension);
      const response = await fetch("/api/transcribe", {method:"POST",body:formData});
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || "Transkrypcja nie powiodła się.");
      const transcript = (payload.text || "").trim();
      if (!transcript) throw new Error("Nie wykryto słów w nagraniu.");
      el.input.value = transcript;
      setBusy(false);
      await sendText(transcript);
      el.input.value = "";
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nie udało się przetworzyć audio.");
      setWorking("Nagranie nie zostało przetworzone", false);
      setAvatarState("idle");
    } finally {
      setBusy(false);
      if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
      el.mic.classList.remove("recording");
      el.mic.setAttribute("aria-label", "Rozpocznij nagrywanie");
      el.micSupport.textContent = "Mikrofon: wymaga zgody";
    }
  }
  async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      showError("Ta przeglądarka nie obsługuje nagrywania. Możesz nadal pisać wiadomości.");
      return;
    }
    try {
      showError("");
      mediaStream = await navigator.mediaDevices.getUserMedia({audio:true});
      recordedChunks = [];
      const options = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? {mimeType:"audio/webm;codecs=opus"} : undefined;
      recorder = options ? new MediaRecorder(mediaStream, options) : new MediaRecorder(mediaStream);
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) recordedChunks.push(event.data);
      };
      recorder.onerror = () => {
        showError("Nagrywanie audio zakończyło się błędem.");
        stopRecording();
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunks, {type:recorder && recorder.mimeType ? recorder.mimeType : "audio/webm"});
        recording = false;
        clearTimeout(autoStopTimer);
        autoStopTimer = null;
        setWorking("Nagranie zakończone", false);
        setAvatarState("thinking");
        uploadRecording(blob);
      };
      recorder.start(300);
      recording = true;
      setAvatarState("listening");
      setWorking("Słucham — kliknij mikrofon, aby zakończyć", true);
      el.mic.classList.add("recording");
      el.mic.setAttribute("aria-label", "Zakończ nagrywanie");
      el.micSupport.textContent = "NAGRYWANIE AKTYWNE";
      autoStopTimer = window.setTimeout(stopRecording, 30000);
    } catch (_) {
      recording = false;
      setAvatarState("idle");
      setWorking("Mikrofon nieaktywny", false);
      showError("Nie uzyskano dostępu do mikrofonu. Sprawdź zgodę przeglądarki i użyj localhost lub HTTPS.");
      if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
      el.mic.classList.remove("recording");
    }
  }
  function stopRecording() {
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else {
      recording = false;
      if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
      el.mic.classList.remove("recording");
      setAvatarState("idle");
    }
    el.micSupport.textContent = "Mikrofon: wymaga zgody";
  }
  el.realtimeButton.addEventListener("click", () => {
    if (realtimeActive) {
      cleanupRealtime();
      return;
    }
    startRealtime();
  });
  el.realtimeVoice.addEventListener("change", () => {
    const voice = el.realtimeVoice.value;
    byId("voice-label").textContent = "VOICE · " + voice.toUpperCase();
  });
  el.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = el.input.value;
    el.input.value = "";
    el.input.style.height = "auto";
    await sendText(text);
  });
  el.input.addEventListener("input", () => {
    el.input.style.height = "auto";
    el.input.style.height = Math.min(el.input.scrollHeight, 120) + "px";
  });
  el.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      el.form.requestSubmit();
    }
  });
  if (el.realtimeEmotionOptIn) {
    el.realtimeEmotionOptIn.addEventListener("change", () => {
      if (el.realtimeEmotionOptIn.checked) {
        if (el.realtimeEmotionStatus) {
          el.realtimeEmotionStatus.textContent = realtimeActive
            ? "EMOTION HINTS: WAITING FOR TRANSCRIPT"
            : "EMOTION HINTS: ON AFTER CONNECT";
        }
      } else {
        void resetRealtimeEmotion();
      }
    });
  }

  el.mic.addEventListener("click", () => {
    if (busy) return;
    if (recording) stopRecording();
    else startRecording();
  });
  el.clear.addEventListener("click", async () => {
    if (busy && !realtimeActive) return;
    if (realtimeActive || realtimeConnecting) cleanupRealtime();
    if (recording) stopRecording();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    try {
      await fetch("/api/session/clear", {
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({session_id:sessionId})
      });
    } catch (_) {}
    sessionId = newSession();
    el.chatLog.replaceChildren();
    addMessage("assistant", "Nowa sesja gotowa. Poprzednia historia została usunięta z pamięci tej instancji, jeśli serwer był osiągalny.");
    el.latency.textContent = "WAITING";
    setWorking("Czekam na wiadomość", false);
    setAvatarState("idle");
    setAvatarTone("neutral");
    showError("");
  });
  if (!("speechSynthesis" in window)) {
    el.voiceOutput.checked = false;
    el.voiceOutput.disabled = true;
    el.voiceOutput.parentElement.lastElementChild.textContent = "Mowa niedostępna";
    byId("voice-label").textContent = "NOT AVAILABLE";
  }
  fetch("/api/health").then((response) => {
    if (!response.ok) throw new Error("offline");
    return response.json();
  }).then(() => {el.connection.textContent = "SYSTEM ONLINE";})
    .catch(() => {el.connection.textContent = "API OFFLINE";showError("Nie można połączyć się z serwerem Cortany.");});
  setAvatarState("idle");
  el.realtimeButton.dataset.connected = "false";
  el.realtimeVoice.value = "marin";
})();
