"""Interactive terminal runtime for Cortana."""
from __future__ import annotations
import argparse
import sys
from uuid import uuid4
from cortana.core import AgentRequest, CortanaAgent, EchoModel
from cortana.llm import OpenAIResponsesModel

def main() -> int:
    parser = argparse.ArgumentParser(description="Uruchom rozmowę z Cortaną.")
    parser.add_argument("--offline", action="store_true", help="Uruchom demonstrację bez wywołań API.")
    parser.add_argument(
        "--emotion", action="store_true",
        help="Włącz Emotion Core 1.3 (jego pakiet musi być dostępny na PYTHONPATH).",
    )
    args = parser.parse_args()
    if args.offline:
        model = EchoModel()
    else:
        try:
            model = OpenAIResponsesModel()
        except (ImportError, RuntimeError, ValueError) as exc:
            print(f"Nie można uruchomić modelu LLM: {exc}", file=sys.stderr)
            print('Zainstaluj `python -m pip install -e ".[llm]"` i ustaw OPENAI_API_KEY,', file=sys.stderr)
            print("albo uruchom demonstrację: python -m cortana --offline", file=sys.stderr)
            return 2
    emotion_provider = None
    if args.emotion:
        try:
            from cortana.emotion.emotion_core_v1_3 import EmotionCoreV13Provider
            emotion_provider = EmotionCoreV13Provider()
        except (ImportError, RuntimeError, ValueError) as exc:
            print(f"Nie można włączyć Emotion Core: {exc}", file=sys.stderr)
            return 2
    agent = CortanaAgent(model=model, emotion_provider=emotion_provider)
    session_id = str(uuid4())
    print("Cortana gotowa. Wpisz /exit, aby zakończyć.")
    try:
        while True:
            try:
                user_text = input("Ty> ").strip()
            except EOFError:
                break
            if user_text.casefold() in {"/exit", "/quit", "koniec"}:
                break
            if not user_text:
                continue
            response = agent.respond(AgentRequest(user_text, session_id=session_id))
            print(f"Cortana> {response.text}")
    except KeyboardInterrupt:
        print("\nZamykanie rozmowy.")
    finally:
        agent.clear_session(session_id)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
