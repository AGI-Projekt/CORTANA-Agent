# Model provider and interactive runtime

## Provider boundary

OpenAIResponsesModel implements the official OpenAI SDK Responses API. No tools are exposed to the model. The adapter sends store=False and Cortana keeps history in volatile process memory, scoped to a session.

The default model ID is gpt-6-luna. Set CORTANA_LLM_MODEL to a model available to your API account. Provider access and quotas depend on the account.

## Install and configure

Python 3.12+ is required.

```bash
python -m pip install -e ".[llm,test]"
# Linux/macOS:
export OPENAI_API_KEY="your-key-from-the-provider"
python -m cortana
```

Windows PowerShell:

```powershell
python -m pip install -e ".[llm,test]"
$env:OPENAI_API_KEY = "your-key-from-the-provider"
python -m cortana
```

The adapter also accepts CORTANA_LLM_API_KEY. An optional CORTANA_LLM_BASE_URL can select an endpoint implementing the OpenAI Responses API. For custom endpoints, verify that they support /responses, message-array input, and store=False. A service that only implements Chat Completions is not compatible with this adapter.

Do not put real API keys in .env.example, source code, commits, issues, screenshots, or logs. The CLI reads environment variables directly and does not automatically load a local .env file.

## Run

```bash
python -m cortana
```

Offline demo with no network/API key:

```bash
python -m cortana --offline
```

Type /exit to finish. The interactive runtime reuses one session ID for the conversation and clears that session's volatile memory when it exits.

## Emotion Core 1.3 integration

The orchestration core accepts an EmotionProvider implementation. The optional --emotion flag loads EmotionCoreV13Provider; the separate Emotion Core 1.3 package must already be importable on PYTHONPATH. It is not silently copied into this repository.

```bash
python -m cortana --emotion
```

Emotion output is a computational estimate, not a diagnosis or a statement of the user's inner state. Only mapped labels with confidence at or above the contract threshold may modify tone; the estimate never changes permissions or triggers actions. Provider failure falls back to neutral tone.

## Memory and privacy

Conversation history is volatile, bounded by message count, age, and a cap on cached sessions. It is not written to disk by this runtime. On each turn, the configured provider receives the current user message plus that session's recent messages. Choose the provider and endpoint accordingly; do not send confidential text without appropriate authorization.
