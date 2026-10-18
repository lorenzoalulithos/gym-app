# Gym App — brief di progetto

App personale per gestire schede di allenamento e tracciare gli allenamenti, stile Everfit ma per **un solo utente**, **offline**, senza account né server. Uso: telefono **Android**, in palestra.

## Stack (deciso)

- **Quasar (Vue 3 + TypeScript + Pinia + Vite)**: lo stesso stack che l'utente usa al lavoro, quindi codice idiomatico Quasar/Vue 3 `<script setup lang="ts">`.
- **Modalità PWA** come primo target: installabile da Chrome su Android, funziona offline (service worker), si aggiorna da sola quando c'è rete. Deploy statico gratuito (Vercel o GitHub Pages).
- **Capacitor (APK Android)** solo in un secondo momento, se servono notifiche affidabili a schermo spento (timer di recupero). Tenere il codice compatibile con entrambe le modalità.
- **Persistenza**: IndexedDB tramite **Dexie**. Tutti i dati restano sul dispositivo.
- **Backup**: export/import di un file JSON con tutti i dati (serve anche per passare lo storico a Claude e farsi proporre le schede successive).
- Lingua dell'interfaccia: italiano.

## UX

- **Tema scuro**, mobile-first, tasti grandi, usabile con una mano in palestra.
- La modalità allenamento deve essere velocissima: precompilare carico e ripetizioni dell'ultima volta, un tap per segnare una serie fatta.

## Modello dati (bozza da validare)

- **Esercizio**: nome, gruppi muscolari, attrezzo, note, foto o link a un video.
- **Scheda (programma)**: nome, date, giorni (A/B/C…). Ogni giorno ha una lista ordinata di esercizi con serie, ripetizioni (anche range, es. 8-10), recupero, carico target, note. Prevedere le tecniche comuni: superserie/circuiti, piramidali, drop set, tempo sotto tensione, percentuali sul massimale. Va validato sugli screenshot delle schede reali.
- **Calendario**: assegnazione dei giorni della scheda alle date.
- **Sessione (allenamento svolto)**: data, giorno della scheda, e per ogni esercizio le serie effettivamente fatte (carico, ripetizioni, RPE facoltativo, note).

## Prima versione (MVP), in quest'ordine

1. Libreria esercizi (CRUD).
2. Schede: creazione e modifica di programma, giorni ed esercizi.
3. Modalità allenamento: spunta delle serie, timer di recupero, carichi dell'ultima volta precompilati.
4. Storico delle sessioni.
5. Export/import JSON.

Subito dopo: calendario completo, grafici dei progressi per esercizio (carichi, massimale stimato), peso corporeo e misure.

## Materiale in arrivo

Il vecchio coach non riesce a recuperare le schede. L'utente manderà **screenshot dell'ultimo mese e mezzo** di allenamenti. Usarli per:
1. validare e correggere il modello dati prima di scrivere troppo codice;
2. preparare un import iniziale (esercizi, scheda attuale, storico) così l'app parte già con i dati veri.

## Come lavorare

- Prima di implementare, proporre la struttura del progetto e il modello dati e farli confermare (l'utente preferisce "parliamo prima di fare").
- Inizializzare git nella cartella del progetto.
- Testare la PWA anche offline (service worker attivo nella build di produzione).
