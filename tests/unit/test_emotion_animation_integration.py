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
    assert "cortana:emotion-transition" in app
    assert "version: \"1.1.0\"" in engine


def test_engine_has_fallback_and_bounded_transition_parameters():
    static_dir = Path(app_module.__file__).resolve().parent / "static"
    engine = (static_dir / "emotion-animation.js").read_text(encoding="utf-8")
    assert ' ? id : "calm"' in engine
    assert "clamp(Number(options.transitionSeconds) || 0.42, 0.08, 2.5)" in engine
    assert "clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.1)" in engine
