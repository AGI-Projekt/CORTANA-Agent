from pathlib import Path

import cortana.web.app as app_module


def test_avatar_loads_emotion_animation_engine_and_uses_interpolated_state():
    static_dir = Path(app_module.__file__).resolve().parent / "static"
    avatar = (static_dir / "avatar3d.js").read_text(encoding="utf-8")
    engine = (static_dir / "emotion-animation.js").read_text(encoding="utf-8")
    app = (static_dir / "app.js").read_text(encoding="utf-8")

    assert 'import "./emotion-animation.js";' in avatar
    assert "createEmotionAnimationEngine" in avatar
    assert "emotionEngine.update(deltaSeconds)" in avatar
    assert "emotionProfile.bodySway" in avatar
    assert "emotionProfile.breath" in avatar
    assert "createArm" in avatar
    assert "emotionProfile.armLift" in avatar
    assert "emotionEngine.setVoiceActivity" in avatar
    assert "cortana:voice-state" in app
    assert "setVoiceActivity(level, speaking)" in engine
    assert "cortana:audio-aligned-visemes" in app
    assert "scheduleAudioAlignedTimeline" in app
    assert "playAudioAlignedTimeline" in (static_dir / "visemes.js").read_text(encoding="utf-8")
    assert "CortanaLipSyncCalibration" in (static_dir / "lipsync-calibration.js").read_text(encoding="utf-8")
    assert "getOffsetMs()" in (static_dir / "visemes.js").read_text(encoding="utf-8")
    assert "lipsync-calibration.js" in (static_dir / "index.html").read_text(encoding="utf-8")
    assert "CortanaPredictiveLipSync" in (static_dir / "predictive-lipsync.js").read_text(encoding="utf-8")
    assert "adjustAnchor" in (static_dir / "visemes.js").read_text(encoding="utf-8")
    assert "actualTimeMs: performance.now()" in (static_dir / "visemes.js").read_text(encoding="utf-8")
    assert "predictive-lipsync.js" in (static_dir / "index.html").read_text(encoding="utf-8")
    assert "phoneme-alignment.js" in (static_dir / "index.html").read_text(encoding="utf-8")
    assert "neural-viseme-predictor.js" in (static_dir / "index.html").read_text(encoding="utf-8")
    assert "CortanaPhonemeAlignment" in (static_dir / "phoneme-alignment.js").read_text(encoding="utf-8")
    assert "CortanaNeuralVisemePredictor" in (static_dir / "neural-viseme-predictor.js").read_text(encoding="utf-8")
    assert "event.phonemes" in (static_dir / "viseme-provider.js").read_text(encoding="utf-8")
    assert "CortanaEmotionProsodySync" in (static_dir / "emotion-prosody-sync.js").read_text(encoding="utf-8")
    assert "emotion-prosody-sync.js" in (static_dir / "index.html").read_text(encoding="utf-8")
    sequencer = (static_dir / "gesture-sequencer.js").read_text(encoding="utf-8")
    assert "CortanaGestureSequencer" in sequencer
    assert "cortana:gesture-frame" in sequencer
    assert "cortana:emotion-transition" in app
    assert 'version: "1.2.0"' in engine


def test_engine_has_fallback_and_bounded_transition_parameters():
    static_dir = Path(app_module.__file__).resolve().parent / "static"
    engine = (static_dir / "emotion-animation.js").read_text(encoding="utf-8")
    assert ' ? id : "calm"' in engine
    assert "clamp(Number(options.transitionSeconds) || 0.42, 0.08, 2.5)" in engine
    assert "clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.1)" in engine


def test_multimodal_emotion_prosody_sync_is_loaded_and_documented():
    static_dir = Path(app_module.__file__).resolve().parent / "static"
    index = (static_dir / "index.html").read_text(encoding="utf-8")
    sync = (static_dir / "emotion-prosody-sync.js").read_text(encoding="utf-8")
    avatar = (static_dir / "avatar3d.js").read_text(encoding="utf-8")
    assert "emotion-prosody-sync.js" in index
    assert "CortanaEmotionProsodySync" in sync
    assert "performanceTimeForContextTime" in sync
    assert "cortana:multimodal-emotion" in sync
    assert 'addEventListener("cortana:emotion-transition"' in avatar
    assert "responseId" in sync
    assert "cancel()" in sync
