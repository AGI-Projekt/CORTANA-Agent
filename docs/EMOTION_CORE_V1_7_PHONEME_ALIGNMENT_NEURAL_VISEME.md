# Emotion Core v1.7.0 — Phoneme-Level Alignment & Neural Viseme Prediction

## Scope

v1.7 adds a timestamped phoneme alignment boundary and a compact, trainable neural predictor to the browser viseme pipeline.

### Phoneme alignment

`window.CortanaPhonemeAlignment` exposes:

- `align(events)`: validates provider-supplied phoneme start/end timestamps and converts them into audio-clock viseme events.
- `toViseme(ipa)`: maps a bounded IPA token to a supported viseme class.
- `normalizePhoneme(ipa)`: normalizes short IPA tokens using Unicode NFC.
- Unknown phonemes safely map to `neutral`.

Input events use `{ startTimeSeconds, endTimeSeconds, phoneme, character? }`. The aligner sorts events by audio time, preserves boundaries, and enforces 512-event, 24-hour timestamp, and 5-second phoneme-duration limits.

This is a timestamp adapter, not a forced aligner. Accurate phoneme boundaries must come from an upstream speech recognizer/forced aligner or a provider that supplies aligned phoneme events. Transcript text alone is not treated as phoneme timing.

### Neural viseme prediction

`window.CortanaNeuralVisemePredictor` is a small feed-forward MLP with a two-phoneme context, one hidden layer, and seven viseme classes. It supports bounded online supervised training from aligned phoneme/viseme examples and exposes:

- `train(sequence, { epochs?, learningRate? })`
- `predictNext(context)` — returns a candidate viseme, confidence, and training-step count.
- `getState()` and `reset()`.

The model is initialized locally and is not a pretrained neural speech model. Its quality depends on the aligned examples supplied during the session. It predicts a candidate for downstream rendering; it does not synthesize missing audio timestamps or overwrite the authoritative aligned timeline.

### Provider integration

The response-scoped `CortanaVisemeProvider.accept()` accepts either the existing timestamped viseme event format or a `phonemes` array. For phoneme input it aligns the events, updates the online predictor, emits `cortana:predicted-viseme` with the candidate, and schedules only the aligned phoneme-derived viseme events. Response ID checks and existing scheduler/audio-clock calibration remain in force.

### Accuracy and safety boundaries

- No phoneme recognition is performed on raw audio in the browser.
- No forced alignment is inferred from transcript character timing.
- The predictor is a small online MLP, not an external foundation model or pretrained acoustic network.
- Predicted candidates are advisory; timestamped aligned events remain the source of truth.
- Invalid, stale, oversized, or out-of-range provider payloads are rejected before scheduling.

## Tests

Node tests cover IPA mapping, timestamp ordering, validation limits, predictor training/inference/reset, and invalid inputs. GitHub Actions runs these tests on Windows and Ubuntu alongside the existing Python and browser suites.
