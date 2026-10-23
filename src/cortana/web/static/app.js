(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const el = {
    avatar: byId("avatar"), avatarState: byId("avatar-state"), chatLog: byId("chat-log"),
    form: byId("composer-form"), input: byId("message-input"), send: byId("send-button"),
    mic: byId("mic-button"), clear: byId("clear-button"), voiceOutput: byId("voice-output-toggle"),
    working: byId("working-state"), workingText: byId("working-text"), error: byId("error-banner"),
    latency: byId("latency-label"), micSupport: byId("mic-support"), connection: byId("connection-label")
  };
  const newSession = () => (window.crypto && typeof window.crypto.randomUUID === "function")
    ? window.crypto.randomUUID()
    : "session-" + Date.now().toString(36) + Math.random().toString(36).slice(2);
  let sessionId = newSession(), recorder = null, mediaStream = null, recordedChunks = [];
  let autoStopTimer = null, busy = false, recording = false, voiceCounter = 0;
  const labels = { idle:"READY", listening:"LISTENING", thinking:"PROCESSING", speaking:"SPEAKING" };
  function setAvatarState(state) {
    el.avatar.dataset.state = state;
    el.avatarState.textContent = labels[state] || "READY";
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
    el.send.disabled = value;
    el.input.disabled = value;
    el.mic.disabled = value;
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
        el.latency.textContent = "VOICE OUTPUT";
      };
      utterance.onboundary = () => {
        voiceCounter += 1;
        const mouth = document.getElementById("mouth");
        if (mouth) mouth.style.transform = voiceCounter % 2 ? "scaleY(2.5)" : "scaleY(1)";
      };
      utterance.onend = () => {
        const mouth = document.getElementById("mouth");
        if (mouth) mouth.style.transform = "";
        setAvatarState("idle");
        resolve();
      };
      utterance.onerror = () => {
        setAvatarState("idle");
        resolve();
      };
      window.speechSynthesis.speak(utterance);
    });
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
  el.mic.addEventListener("click", () => {
    if (busy) return;
    if (recording) stopRecording();
    else startRecording();
  });
  el.clear.addEventListener("click", async () => {
    if (busy) return;
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
})();
