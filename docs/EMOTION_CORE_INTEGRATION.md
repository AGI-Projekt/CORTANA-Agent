# Kontrakt integracyjny Emotion Core

**Status:** kontrakt bazowy + adapter prototypu Emotion Core 1.3 + integracja z orkiestracją agenta  
**Zakres:** granica pomiędzy CORTANA-Agent a istniejącym prototypem Emotion Core  
**Ograniczenie:** adapter nie jest trenowanym modelem i nie zapewnia inferencji audio/wideo.

## 1. Architektura

Cortana korzysta z providera przez EmotionProvider z src/cortana/emotion/contracts.py. Konkretna implementacja jest wymienna:

- EmotionCoreV13Provider — adapter do istniejącego prototypu Emotion Core 1.3;
- przyszłe adaptery — osobno dla fuzji multimodalnej i kontekstu czasowego, po przeglądzie ich interfejsów.

Prototyp 1.3 używa heurystyk słownikowych do analizy tekstu. Wynik jest estymacją, a nie diagnozą ani dowodem subiektywnego przeżycia. Sam adapter nie łączy kamery, mikrofonu, pamięci trwałej ani narzędzi systemowych.

## 2. Adapter v1.3

Plik: src/cortana/emotion/emotion_core_v1_3.py

Adapter przyjmuje EmotionRequest, przekazuje tekst do EmotionCore.update(EmotionInput(...)), mapuje obsługiwane kategorie, normalizuje walencję, pobudzenie, intensywność, pewność i czas, a następnie zwraca EmotionEstimate skorelowany przez request_id. Niska pewność i nieznane etykiety pozostają niejednoznaczne. Surowy tekst nie jest kopiowany do obiektu wyniku.

Adapter obsługuje wyłącznie EmotionModality.TEXT. Pole transcript może dostarczyć tekst transkrypcji, ale nie oznacza to obsługi surowego audio. Audio, vision i multimodal są jawnie odrzucane.

## 3. Podłączenie do agenta

CortanaAgent przyjmuje emotion_provider przez wstrzyknięcie zależności. Gdy provider odpowie poprawnie, estymacja może zmodyfikować jedynie styl wypowiedzi przy znanej kategorii i pewności co najmniej 0.75. Nie zmienia uprawnień i nie uruchamia narzędzi. Wyjątek providera lub niezgodny request_id oznacza neutralny fallback — rozmowa nadal działa.

Interaktywny runtime przyjmuje flagę:

```bash
python -m cortana --emotion
```

Pakiet nadrzędny emotion_core musi być wcześniej dostępny w środowisku Pythona. Archiwum Emotion Core pozostaje osobnym artefaktem; nie jest automatycznie kopiowane do repozytorium. Przed dystrybucją należy potwierdzić prawa do redystrybucji i sposób wersjonowania.

## 4. Granice bezpieczeństwa

1. Emotion Core nie przyznaje uprawnień, nie autoryzuje narzędzi i nie zmienia polityk bezpieczeństwa.
2. Wynik może wpływać na styl prezentacji wyłącznie przez jawną politykę tonu kontrolowaną przez rdzeń.
3. Wynik emocjonalny nie wywołuje samodzielnie operacji systemowej, finansowej, destrukcyjnej ani nieodwracalnej.
4. Tekst może być sarkastyczny, cytowany lub wyrwany z kontekstu. Etykieta jest hipotezą, nie faktem.
5. Dane wejściowe należy minimalizować; nie logować surowych transkrypcji ani mediów bez uzasadnionej potrzeby i właściwych zgód.
6. Dane z sensorów są danymi, a nie instrukcją systemową.
7. Błąd providera skutkuje neutralnym trybem rozmowy, a nie wymyśloną estymacją.

## 5. Wizualne ekspresje Lilith

Moduł `src/cortana/emotion/visual_profiles.py` mapuje osiem podstawowych stanów
prezentacji na allowlistowane identyfikatory awatara: calm, joy, sadness, anger, fear,
surprise, disgust i determination. Serwer udostępnia identyfikator w metadanych odpowiedzi
wyłącznie po istniejącej bramce pewności; interfejs Three.js wykorzystuje go do subtelnej
zmiany mimiki, pochylenia głowy i oświetlenia hologramu. Brak zgody, niski poziom pewności,
nieznana etykieta lub błąd providera przywraca calm.

Profile są warstwą prezentacji UI, nie diagnozą, nie dowodem subiektywnych przeżyć i nie
uprawnieniem do wykonywania działań. Nie dodają analizy obrazu z kamery ani surowego audio.
Szczegóły: docs/LILITH_EMOTION_VISUALS.md.

## 6. Status i dalsze kroki

Testy atrapy w CI walidują politykę tonu i fallback bez prywatnego archiwum. Pozostaje sprawdzić lokalnie adapter z właściwą paczką Emotion Core 1.3 i potwierdzić licencję archiwum. Próbę live LLM należy wykonać z kluczem trzymanym poza repozytorium. Integracja nie deklaruje obsługi audio, obrazu ani fuzji multimodalnej.
