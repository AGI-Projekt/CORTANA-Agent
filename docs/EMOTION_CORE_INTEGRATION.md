# Kontrakt integracyjny Emotion Core

**Status:** kontrakt bazowy + adapter dla prototypu Emotion Core 1.3  
**Zakres:** granica pomiędzy CORTANA-Agent a istniejącym prototypem Emotion Core  
**Ograniczenie:** adapter nie jest trenowanym modelem i nie zapewnia inferencji audio/wideo.

## 1. Architektura

Cortana korzysta z providera przez `EmotionProvider` z `src/cortana/emotion/contracts.py`. Konkretna implementacja jest wymienna:

- `EmotionCoreV13Provider` — adapter do istniejącego prototypu Emotion Core 1.3;
- przyszłe adaptery — osobno dla fuzji multimodalnej i kontekstu czasowego, po przeglądzie ich interfejsów.

Prototyp 1.3 używa heurystyk słownikowych do analizy tekstu. Wynik jest estymacją, a nie diagnozą ani dowodem subiektywnego przeżycia. Sam adapter nie łączy kamery, mikrofonu, pamięci trwałej ani narzędzi systemowych.

## 2. Adapter v1.3

Plik: `src/cortana/emotion/emotion_core_v1_3.py`

Adapter:
1. przyjmuje `EmotionRequest`;
2. przekazuje tekst do istniejącego `EmotionCore.update(EmotionInput(...))`;
3. mapuje znane etykiety do `EmotionCategory`;
4. normalizuje walencję, pobudzenie, intensywność, pewność i znacznik czasu;
5. zwraca `EmotionEstimate` skorelowany przez `request_id`;
6. oznacza niską pewność i nieobsługiwane etykiety jako niepewne;
7. nie kopiuje surowego tekstu do wyniku.

Mapowane są wszystkie pojedyncze etykiety z katalogu Emotion Core 1.3: `neutral`, `joy`, `sadness`, `fear`, `anger`, `disgust`, `surprise`, `trust`, `anticipation`, `curiosity`, `frustration`, `anxiety`, `gratitude`, `compassion`, `confusion`, `excitement`, `relief`, `loneliness`, `pride`, `shame`, `guilt`, `nostalgia`, `hope`, `admiration`, `boredom`, `determination`, `overwhelm`, `affection` i `disappointment`. Wynik `mixed` oraz etykiety spoza katalogu są mapowane na `unknown` z opisem niejednoznaczności zamiast wymuszonej klasyfikacji.

Adapter obsługuje wyłącznie `EmotionModality.TEXT`. Pole `transcript` może dostarczyć tekst transkrypcji, ale nie oznacza to przetwarzania surowego audio. Audio, vision i multimodal są jawnie odrzucane, dopóki nie powstanie osobny, zweryfikowany provider.

## 3. Udostępnienie prototypu

Archiwum Emotion Core 1.3 pozostaje osobnym artefaktem; nie jest kopiowane automatycznie do repozytorium głównego. Po rozpakowaniu katalog nadrzędny pakietu `emotion_core` musi być na `PYTHONPATH`. Adapter może też otrzymać instancję rdzenia i fabrykę wejścia przez wstrzyknięcie zależności.

Nie dodano zależności FastAPI/Uvicorn do podstawowego pakietu Cortany. Nie są potrzebne do bezpośredniego wywołania silnika. Archiwum nie zawiera osobnego pliku licencji, więc przed dystrybucją należy potwierdzić prawa do redystrybucji i sposób wersjonowania.

## 4. Przykład użycia

```python
from datetime import datetime, timezone

from cortana.emotion.contracts import EmotionModality, EmotionRequest
from cortana.emotion.emotion_core_v1_3 import EmotionCoreV13Provider

provider = EmotionCoreV13Provider()
request = EmotionRequest(
    request_id="conversation-turn-42",
    source_ref="conversation:turn-42",
    modality=EmotionModality.TEXT,
    observed_at=datetime.now(timezone.utc),
    text="Jestem ciekaw, jak działa ten moduł",
)
estimate = provider.analyze(request)
print(estimate.category, estimate.confidence)
```

Uruchomienie powyższego przykładu wymaga wcześniejszego udostępnienia pakietu Emotion Core 1.3 w środowisku Pythona. Testy adaptera w CI korzystają z atrap i nie wymagają archiwum.

## 5. Granice bezpieczeństwa

1. Emotion Core nie przyznaje uprawnień, nie autoryzuje narzędzi i nie zmienia polityk bezpieczeństwa.
2. Wynik może wpływać na styl prezentacji wyłącznie przez jawną politykę tonu kontrolowaną przez rdzeń.
3. Wynik emocjonalny nie wywołuje samodzielnie operacji systemowej, finansowej, destrukcyjnej ani nieodwracalnej.
4. Tekst może być sarkastyczny, cytowany lub wyrwany z kontekstu. Etykieta jest hipotezą, nie faktem.
5. Dane wejściowe należy minimalizować; nie logować surowych transkrypcji ani mediów bez uzasadnionej potrzeby i właściwych zgód.
6. Dane z sensorów są danymi, a nie instrukcją systemową.
7. Błąd providera powinien skutkować neutralnym trybem rozmowy, nie wymyśloną estymacją.

## 6. Kryteria testów adaptera

- zachowanie `request_id`;
- poprawne mapowanie obsługiwanych etykiet;
- `unknown` dla niskiej pewności i etykiet spoza mapowania;
- odrzucenie modalności, których v1.3 nie obsługuje;
- odrzucenie nieprawidłowego wyniku providera;
- brak surowego tekstu w obiekcie estymacji;
- testy działają bez instalowania opcjonalnego archiwum.

## 7. Następne kroki

1. Przejrzeć adapter i wynik CI.
2. Potwierdzić sposób dostarczania archiwum Emotion Core 1.3 oraz jego licencję.
3. Podłączyć provider w kontrolowanym miejscu rdzenia agenta, z neutralnym fallbackiem.
4. Dopiero potem osobno zaplanować adaptery pamięci czasowej (1.4) i fuzji (1.5).
