<template>
  <q-page class="page-pad stagger">
    <div class="row items-center q-mb-md q-mt-sm">
      <div class="text-h5 text-weight-bold col">Schede</div>
    </div>

    <!-- tre modi per inserire una scheda -->
    <div class="row q-col-gutter-sm q-mb-lg">
      <div class="col-4">
        <button type="button" class="new-tile primary" @click="create">
          <q-icon name="add" size="28px" />
          <span>Crea</span>
        </button>
      </div>
      <div class="col-4">
        <button type="button" class="new-tile" @click="paste()">
          <q-icon name="content_paste" size="26px" />
          <span>Incolla testo</span>
        </button>
      </div>
      <div class="col-4">
        <button type="button" class="new-tile" @click="fileInput?.click()">
          <q-icon name="upload_file" size="26px" />
          <span>Importa file</span>
        </button>
      </div>
    </div>

    <div v-if="!sorted.length" class="text-muted text-center q-pa-xl">Nessuna scheda.</div>

    <div v-for="p in sorted" :key="p.id" class="card q-pa-md q-mb-md prog" @click="open(p.id)">
      <div class="row items-center no-wrap">
        <div class="col" style="min-width: 0">
          <div class="row items-center no-wrap q-gutter-x-sm">
            <div class="text-h6 ellipsis">{{ p.name }}</div>
            <q-badge v-if="p.id === active?.id" color="primary" text-color="dark" label="attiva" />
            <q-badge v-else-if="p.draft" color="grey-8" label="bozza" />
            <q-badge
              v-else-if="p.startDate > today"
              color="info"
              text-color="dark"
              label="in arrivo"
            />
          </div>
          <div class="text-caption text-muted">
            dal {{ formatDate(p.startDate)
            }}<template v-if="p.endDate"> al {{ formatDate(p.endDate) }}</template> ·
            {{ p.days.length }} giorni
          </div>
        </div>
        <q-btn flat round icon="more_vert" color="grey-6" @click.stop>
          <q-menu auto-close>
            <q-list style="min-width: 230px">
              <q-item clickable @click="open(p.id, 0)">
                <q-item-section avatar><q-icon name="edit" /></q-item-section>
                <q-item-section>Modifica</q-item-section>
              </q-item>
              <q-item clickable @click="duplicate(p)">
                <q-item-section avatar><q-icon name="content_copy" /></q-item-section>
                <q-item-section>
                  <q-item-label>Duplica come nuova</q-item-label>
                  <q-item-label caption>Per la scheda del mese dopo</q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable @click="shareText(p)">
                <q-item-section avatar><q-icon name="share" /></q-item-section>
                <q-item-section>Condividi come testo</q-item-section>
              </q-item>
              <q-item clickable @click="exportProgramFile(p)">
                <q-item-section avatar><q-icon name="download" /></q-item-section>
                <q-item-section>Esporta file</q-item-section>
              </q-item>
              <q-item clickable class="text-negative" @click="remove(p)">
                <q-item-section avatar><q-icon name="delete" /></q-item-section>
                <q-item-section>Elimina</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </div>
      <div class="q-mt-sm">
        <q-chip
          v-for="(d, i) in p.days"
          :key="d.id"
          dense
          outline
          color="grey-6"
          class="q-ml-none q-mr-xs"
        >
          <b class="text-primary q-mr-xs">{{ String.fromCharCode(65 + i) }}</b> {{ d.name }}
        </q-chip>
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".json,.txt,application/json,text/plain"
      class="hidden"
      @change="onFile"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import TextImportDialog from '@/components/TextImportDialog.vue';
import { useLiveQuery } from '@/composables/useLiveQuery';
import { useToday } from '@/composables/useToday';
import { db, newId } from '@/db';
import type { Program } from '@/db/types';
import { formatDate } from '@/domain/format';
import { activeProgram } from '@/domain/session';
import type { ParsedDay } from '@/domain/textImport';
import {
  cloneProgram,
  exportProgramFile,
  importProgramFile,
  programFromParsed,
  readProgramFile,
  shareProgramText,
} from '@/services/programFile';
import { useExercisesStore } from '@/stores/exercises';
import { useSettingsStore } from '@/stores/settings';

const $q = useQuasar();
const router = useRouter();
const exercises = useExercisesStore();
const settings = useSettingsStore();
const { today } = useToday();
const { data: programs } = useLiveQuery(() => db.programs.toArray(), [], []);

const sorted = computed(() =>
  [...(programs.value ?? [])].sort(
    (a, b) => Number(!!b.draft) - Number(!!a.draft) || b.startDate.localeCompare(a.startDate),
  ),
);
const active = computed(() => activeProgram(programs.value ?? [], today.value));

/** Apre il percorso guidato; senza passo indicato: riepilogo per le schede esistenti. */
const open = (id: string, passo?: number) =>
  void router.push({
    name: 'program',
    params: { id },
    query: passo !== undefined ? { passo: String(passo) } : {},
  });

async function create() {
  const p: Program = {
    id: newId(),
    name: 'Nuova scheda',
    startDate: today.value,
    source: 'user',
    draft: true,
    days: [],
    updatedAt: Date.now(),
  };
  await db.programs.add(p);
  open(p.id, 0);
}

function paste(initialText = '') {
  $q.dialog({ component: TextImportDialog, componentProps: { mode: 'program', initialText } }).onOk(
    (days: ParsedDay[]) => void fromText(days),
  );
}

async function fromText(days: ParsedDay[]) {
  const id = await programFromParsed(
    days,
    'Scheda incollata',
    settings.defaultRestSec,
    exercises.byId,
  );
  open(id, 0);
}

const fileInput = ref<HTMLInputElement>();
async function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const r = await readProgramFile(file);
    if (r.kind === 'text') return paste(r.text);
    const id = await importProgramFile(r.file);
    $q.notify({
      message: 'Scheda importata: controllala e attivala',
      color: 'positive',
      textColor: 'dark',
      icon: 'check',
    });
    open(id, 3);
  } catch (err) {
    $q.notify({ message: `Errore: ${(err as Error).message}`, color: 'negative' });
  }
}

/** Copia con id nuovi: le sessioni restano legate alla scheda originale. */
async function duplicate(p: Program) {
  const copy = cloneProgram(p, { name: `${p.name} (copia)`, startDate: today.value, draft: true });
  delete copy.endDate;
  await db.programs.add(copy);
  open(copy.id, 0);
}

async function shareText(p: Program) {
  const r = await shareProgramText(p, exercises.nameOf);
  if (r === 'copied')
    $q.notify({
      message: 'Scheda copiata negli appunti',
      color: 'positive',
      textColor: 'dark',
      icon: 'content_copy',
    });
}

function remove(p: Program) {
  $q.dialog({
    title: `Eliminare "${p.name}"?`,
    message: 'Gli allenamenti già fatti restano nello storico.',
    cancel: { flat: true, label: 'Annulla' },
    ok: { label: 'Elimina', color: 'negative', unelevated: true },
  }).onOk(() => void db.programs.delete(p.id));
}
</script>

<style scoped lang="scss">
.new-tile {
  width: 100%;
  min-height: 86px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  background: $dark;
  color: rgba(255, 255, 255, 0.85);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: transform 0.08s ease;
  &:active {
    transform: scale(0.96);
  }
  &.primary {
    background: $primary;
    color: $dark-page;
    border-color: $primary;
  }
}
.prog {
  cursor: pointer;
}
</style>
