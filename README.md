# Gym

PWA personale per schede e allenamenti: offline, dati solo sul telefono (IndexedDB/Dexie).
Stack: Quasar 2 (Vue 3 + TS + Pinia), modalità PWA. Vedi `BRIEF.md` per il contesto.

## Comandi

```bash
npm run dev          # sviluppo (http://localhost:9000)
npm run build:pwa    # build di produzione in dist/pwa (service worker attivo)
npm test             # test della logica (Vitest)
npm run typecheck
npm run lint
npm run library      # rigenera libreria esercizi + immagini da free-exercise-db
```

Per provare la build offline: `cd dist/pwa && python3 -m http.server 4173`, apri la pagina una volta, poi togli la rete.

## Pubblicazione

Ogni push su `main` esegue i test, builda la PWA e la pubblica su GitHub Pages
(`.github/workflows/deploy.yml`). Sul telefono: apri il link in Chrome → menu → _Aggiungi a schermata Home_.
L'app si aggiorna da sola quando c'è rete (compare "Nuova versione disponibile").

## Struttura

```
src/
  db/          tipi e schema Dexie
  domain/      logica pura e testata: e1RM (Epley), record, precompilazione, rotazione, trend
  seed/        dati inclusi nella build: libreria esercizi, schede, storico Everfit
  stores/      Pinia: esercizi, sessione aperta, timer, impostazioni
  services/    backup JSON/ZIP, foto, suono/vibrazione/notifiche
  components/  SetRow, ExerciseCard, TimerBar, WorkOverlay, picker e dialoghi
  pages/       Oggi, Calendario, Allenamento, Esercizi, Schede, Giorno, Foto, Altro
src-pwa/sw/custom-sw.ts   service worker: precache, cache immagini, promemoria
scripts/build-library.mjs
```

## Convenzioni dei dati

- **Carico**: `per_implement` = kg di un manubrio/kettlebell; `total` = bilanciere compreso;
  `stack` = pila di macchine e cavi; `added` = zavorra sul corpo libero.
- **perSide**: ripetizioni e tempo sono per lato.
- Una sessione contiene una copia di ciò che è stato fatto (con il target accanto),
  quindi modificare o cancellare una scheda non tocca lo storico.

## Calendario e promemoria

- Ogni giorno della scheda ha un giorno della settimana (Schede → icona calendario): da lì nasce il calendario.
- Uno spostamento o un salto è un'eccezione per quella data (tabella `schedule`); lo schema settimanale non cambia.
- Un giorno previsto e passato senza allenamento risulta **saltato**: la pagina Oggi propone _Fallo oggi_, _Sposta_ o _Lascia perdere_.
- Promemoria (Altro → Promemoria allenamenti): il service worker controlla il calendario con
  Periodic Background Sync e notifica l'allenamento del giorno o quello saltato, una volta al giorno tra le 8 e le 22.
  Funziona solo con l'app installata su Chrome/Android e la frequenza la decide il browser:
  per promemoria a orario preciso serve l'APK con Capacitor (notifiche locali).

## Inserire una scheda

Schede → **Crea** (percorso guidato: scheda, giorni, esercizi, riepilogo), **Incolla testo** o
**Importa file**. Il testo si scrive come su un foglio, una riga per esercizio:

```
# A Push (lunedì)
Panca piana 4x8-10 @60 r2:00
SS Croci ai cavi 3x12 + Push-down 3x12 r60
Squat 12/10/8/6 @80
Plank 3x45s
```

`4x8-10` serie e ripetizioni · `12/10/8/6` piramide · `3x45s` a tempo · `@60` kg · `@75%` del
massimale · `r90` / `r2:00` recupero · `SS … + …` superset · `(note)`. I nomi si riconoscono in
italiano, inglese o col nome del coach (`src/domain/textImport.ts`); quelli non trovati si scelgono
o si creano come esercizi personalizzati.

## Ciclo mensile

1. Altro → **Esporta dati (JSON)**: allenamenti, schede e un riepilogo dell'andamento per esercizio.
2. Si decide la scheda nuova (con Claude, partendo dall'export o dagli screenshot del coach).
3. La scheda nuova arriva come testo o file JSON (formato di _Schede → Esporta file_) e si importa
   dall'app: Schede → Incolla testo / Importa file → controllo nel riepilogo → Attiva.
   (Resta possibile includerla nella build in `src/seed/programs/` e `SEED_PROGRAMS`.)

In alternativa la scheda si può creare direttamente nell'app (Schede → Duplica come nuova).
