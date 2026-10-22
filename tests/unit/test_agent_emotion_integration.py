from cortana.core import AgentRequest, CortanaAgent
from cortana.emotion.contracts import EmotionCategory, EmotionEstimate

class RecordingModel:
    def __init__(self):
        self.calls = []
    def generate(self, prompt, *, instructions=None, history=()):
        self.calls.append({"prompt": prompt, "instructions": instructions, "history": tuple(history)})
        return "Jestem tutaj. Co będzie pomocne?"

class FakeEmotionProvider:
    def __init__(self, estimate=None, error=None):
        self.estimate = estimate
        self.error = error
        self.requests = []
    def analyze(self, request):
        self.requests.append(request)
        if self.error:
            raise self.error
        return self.estimate

def make_estimate(category=EmotionCategory.ANXIETY, confidence=0.91, request_id="session-a"):
    return EmotionEstimate(
        request_id=request_id, category=category, valence=-0.2, arousal=0.7,
        intensity=0.6, confidence=confidence, model_version="fake/1",
    )

def test_high_confidence_emotion_changes_tone_without_becoming_a_fact():
    model = RecordingModel()
    emotion = FakeEmotionProvider(make_estimate())
    agent = CortanaAgent(model=model, emotion_provider=emotion)
    response = agent.respond(AgentRequest("Mam dużo na głowie.", session_id="session-a"))
    assert response.text.startswith("Jestem tutaj")
    assert emotion.requests[0].text == "Mam dużo na głowie."
    assert response.metadata["tone_adjusted"] is True
    assert "krótkimi krokami" in model.calls[0]["instructions"]
    assert "Nie informuj użytkownika" in model.calls[0]["instructions"]

def test_low_confidence_emotion_does_not_change_tone():
    model = RecordingModel()
    emotion = FakeEmotionProvider(make_estimate(confidence=0.42))
    agent = CortanaAgent(model=model, emotion_provider=emotion)
    response = agent.respond(AgentRequest("Proszę wyjaśnij.", session_id="session-a"))
    assert response.metadata["tone_adjusted"] is False
    assert "Opcjonalna wskazówka stylu" not in model.calls[0]["instructions"]

def test_emotion_provider_failure_falls_back_to_neutral_and_keeps_chat_working():
    model = RecordingModel()
    emotion = FakeEmotionProvider(error=RuntimeError("provider unavailable"))
    agent = CortanaAgent(model=model, emotion_provider=emotion)
    response = agent.respond(AgentRequest("Cześć.", session_id="session-a"))
    assert response.text.startswith("Jestem tutaj")
    assert response.metadata["emotion_status"] == "unavailable"
    assert "Opcjonalna wskazówka stylu" not in model.calls[0]["instructions"]

def test_history_is_limited_to_same_session_and_clearable():
    model = RecordingModel()
    agent = CortanaAgent(model=model, max_history_messages=4)
    agent.respond(AgentRequest("Sekret pierwszej sesji", session_id="session-a"))
    agent.respond(AgentRequest("Inna rozmowa", session_id="session-b"))
    agent.respond(AgentRequest("Kontynuacja", session_id="session-a"))
    history = model.calls[-1]["history"]
    assert [message.content for message in history] == [
        "Sekret pierwszej sesji", "Jestem tutaj. Co będzie pomocne?",
    ]
    assert all("Inna rozmowa" not in message.content for message in history)
    agent.clear_session("session-a")
    agent.respond(AgentRequest("Nowa rozmowa po wyczyszczeniu", session_id="session-a"))
    assert model.calls[-1]["history"] == ()

def test_invalid_emotion_correlation_is_ignored():
    model = RecordingModel()
    emotion = FakeEmotionProvider(make_estimate(request_id="different-session"))
    agent = CortanaAgent(model=model, emotion_provider=emotion)
    response = agent.respond(AgentRequest("Cześć.", session_id="session-a"))
    assert response.metadata["emotion_status"] == "invalid_response"
    assert "Opcjonalna wskazówka stylu" not in model.calls[0]["instructions"]
