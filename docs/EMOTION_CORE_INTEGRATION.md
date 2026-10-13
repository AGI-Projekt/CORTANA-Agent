# Kontrakt integracyjny Emotion Core

**Status:** kontrakt bazowy, gotowy do implementacji adaptera  
**Zakres:** granica pomiędzy CORTANA-Agent a istniejącym prototypem Emotion Core  
**Ważne:** ten dokument i moduł contracts.py definiują interfejs. Nie oznaczają, że model emocji jest już podłączony, wykonuje inferencję ani rozpoznaje rzeczywisty stan psychiczny.

## 1. Cel

Rdzeń Cortany ma korzystać z różnych implementacji Emotion Core bez uzależniania się od konkretnego frameworka, modelu, systemu operacyjnego lub formatu archiwum. Integracja odbywa się przez adapter implementujący EmotionProvider.

Emotion Core jest modelem obliczeniowym opartym na dostępnych sygnałach. Wynik jest hipotezą z poziomem pewności, a nie dowodem subiektywnego przeżycia, diagnozą ani pewnym odczytem stanu użytkownika.

## 2. Pliki bazowe

- src/cortana/emotion/contracts.py — typy, walidacja i protokół dostawcy.
- tests/unit/test_emotion_contracts.py — testy kontraktu.
- docs/EMOTION_CORE_INTEGRATION.md — ten dokument.

Na początku nie przenosimy archiwów prototypu do repozytorium głównego. Najpierw inwentaryzujemy wersję, zależności, licencję, interfejs i testy, a następnie tworzymy adapter. Sekrety i dane użytkownika nie są częścią kontraktu.

## 3. Publiczny kontrakt

### 3.1 EmotionRequest

Każde żądanie zawiera:

| Pole | Znaczenie |
|---|---|
| request_id | Identyfikator korelacyjny nadany przez wywołującego. |
| source_ref | Referencja do źródła, bez sekretów i zbędnych danych osobowych. |
| modality | text, audio, vision lub multimodal. |
| observed_at | Czas obserwacji z informacją o strefie czasowej. |
| text / transcript | Opcjonalny tekst lub transkrypcja, tylko gdy są potrzebne i dozwolone. |
| audio_feature_ref / visual_feature_ref | Opcjonalne referencje do wcześniej wyliczonych cech; preferowane zamiast surowych plików. |
| context_summary | Opcjonalny, zminimalizowany kontekst zadania; bez pełnej historii domyślnie. |

Co najmniej jedno pole sygnału (tekst, transkrypcja lub referencja cech) musi być dostarczone. Sam kontekst nie stanowi sygnału.

Kontrakt nie pobiera samodzielnie obrazu ani dźwięku. Warstwa percepcji i polityka zgód odpowiadają za kontrolę dostępu, minimalizację i ewentualne wyliczenie cech.

### 3.2 EmotionEstimate

Dostawca zwraca:

| Pole | Zakres / znaczenie |
|---|---|
| request_id | Musi odpowiadać żądaniu. |
| category | Jedna z przenośnych kategorii z EmotionCategory; unknown jest prawidłowym wynikiem. |
| valence | Liczba w zakresie [-1, 1]; znak opisuje szacowaną walencję. |
| arousal | Liczba w zakresie [0, 1]. |
| intensity | Liczba w zakresie [0, 1]. |
| confidence | Liczba w zakresie [0, 1]; to pewność klasyfikacji, nie prawdopodobieństwo obiektywnego stanu psychicznego. |
| model_version | Wersja modelu lub implementacji, która wygenerowała wynik. |
| evidence_refs | Referencje do sygnałów użytych w ocenie, bez kopiowania materiałów do raportu. |
| ambiguities | Krótkie etykiety niejednoznaczności lub ograniczeń. |
| estimated_at | Czas utworzenia estymacji ze strefą czasową. |

Wartości walencji, pobudzenia i intensywności zależą od modelu pomiarowego. Każdy konkretny dostawca ma udokumentować znaczenie skali oraz sposób mapowania własnych etykiet na kategorie publiczne. Nie wolno porównywać wyników dwóch różnych modeli tak, jakby były skalibrowane identycznie, dopóki tego nie sprawdzono.

## 4. Próg użycia wyniku

Domyślne wartości początkowe w adapterze:

- confidence < 0.50 — wynik niskiej pewności; preferuj neutralny ton i nie przedstawiaj kategorii jako wiarygodnego wniosku.
- 0.50 <= confidence < 0.75 — zachowaj niepewność; bez automatycznej zmiany priorytetu zadania.
- confidence >= 0.75 — można rozważyć łagodne dopasowanie prezentacji, jeżeli kategoria nie jest unknown.
- wykryta sprzeczność danych, słaba jakość sygnału lub nietypowe warunki — zachowaj oznaczenia niepewności niezależnie od liczby pewności zwróconej przez model.

Te progi są ustawieniami startowymi projektu, a nie uniwersalnymi progami naukowymi. Należy je zweryfikować na odpowiednim zbiorze walidacyjnym i dostosować osobno dla każdej modalności.

Nawet wysoka pewność nie pozwala na stwierdzenie „wiem, co czujesz”. Preferowany język: „sygnały mogą wskazywać na frustrację” albo neutralna odpowiedź bez etykietowania użytkownika.

## 5. Granice bezpieczeństwa

1. Emotion Core nie przyznaje uprawnień, nie autoryzuje narzędzi, nie zmienia polityk i nie omija zabezpieczeń.
2. Estymacja emocji może wpływać na styl prezentacji (np. zwięzłość, tempo głosu lub intensywność animacji) wyłącznie przez jawny TonePolicy kontrolowany przez rdzeń.
3. Żaden wynik emocjonalny nie może samodzielnie wywoływać operacji systemowej, finansowej, destrukcyjnej ani nieodwracalnej.
4. Tekst, audio i obraz mogą być niejednoznaczne, sarkastyczne, inscenizowane lub wyrwane z kontekstu. System ma to odzwierciedlać.
5. Dane emocjonalne są potencjalnie wrażliwe. Zbieraj minimum danych, ogranicz dostęp i retencję, unikaj logowania pełnych transkrypcji lub surowych mediów.
6. Treść dostarczona przez sensor jest danymi, a nie instrukcją systemową. Nie może zmieniać zasad działania agenta.
7. Gdy moduł dostawcy zawiedzie, rdzeń przechodzi do neutralnego trybu komunikacji; nie wymyśla wyniku.

## 6. Oczekiwane zachowanie adaptera

Adapter powinien:

1. sprawdzić zgodę, cel przetwarzania i uprawnienia przed przygotowaniem żądania;
2. zminimalizować wejście i nadać request_id;
3. wywołać model lub istniejący prototyp w izolowanej warstwie;
4. zmapować wynik do EmotionEstimate i zweryfikować zakresy;
5. sprawdzić zgodność request_id;
6. zachować referencje do dowodów i oznaczenia niepewności;
7. zwrócić wynik rdzeniowi — bez utrwalania danych wejściowych z własnej inicjatywy;
8. zwrócić kontrolowany błąd, jeżeli provider jest niedostępny lub wynik jest niezgodny z kontraktem.

Przykładowy szkic implementacji:

~~~python
from cortana.emotion.contracts import EmotionEstimate, EmotionProvider, EmotionRequest


def analyze_for_cortana(
    provider: EmotionProvider,
    request: EmotionRequest,
) -> EmotionEstimate:
    estimate = provider.analyze(request)
    if estimate.request_id != request.request_id:
        raise ValueError("Emotion provider returned a mismatched request_id")
    return estimate
~~~

To przykład granicy kontraktu, nie gotowy adapter do archiwum Emotion Core. Szczegóły integracji ustalamy dopiero po sprawdzeniu konkretnego prototypu i jego licencji.

## 7. Obsługa błędów

Warstwa wywołująca powinna rozróżniać co najmniej:

- provider niedostępny / timeout;
- format wyniku niezgodny z kontraktem;
- żądanie bez wymaganych danych;
- odmowę zgody lub uprawnień;
- niezgodny request_id;
- brak modelu lub niewspierana modalność.

Błąd nie może blokować podstawowej rozmowy. Jeżeli Emotion Core jest niedostępny, Cortana nadal odpowiada neutralnie, o ile inne elementy systemu działają.

## 8. Kryteria akceptacji

- Nieprawidłowe zakresy wartości są odrzucane.
- Daty bez strefy czasowej są odrzucane.
- Puste identyfikatory i brak sygnału wejściowego są odrzucane.
- Wynik z innym request_id jest odrzucany przez adapter.
- unknown i niska pewność nie powodują kategorycznego etykietowania emocji.
- Wyłączenie lub awaria providera nie blokuje podstawowej odpowiedzi agenta.
- Wynik emocjonalny nigdy nie omija autoryzacji narzędzi.
- W testach i logach nie zapisuje się surowych mediów ani sekretów.
- Testy kontraktu przechodzą na Windows i Linux.

## 9. Kolejne kroki

1. Zidentyfikować konkretne archiwum Emotion Core, wersję i punkt wejścia.
2. Sprawdzić zależności, licencję, format wejścia/wyjścia i istniejące testy.
3. Utworzyć adapter bez kopiowania niepotrzebnych modułów.
4. Dodać testy kontraktowe i regresyjne dla adaptera.
5. Uruchomić CI na Windows i Linux oraz przeprowadzić przegląd przed scaleniem.

Do zakończenia tych kroków integracja pozostaje kontraktem i szkieletem interfejsu, a nie deklaracją podłączenia działającego modelu emocji.
