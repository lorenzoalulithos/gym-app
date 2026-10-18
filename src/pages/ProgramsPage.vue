<template>
  <q-page class="page-pad">
    <div class="row items-center q-mb-md q-mt-sm">
      <div class="text-h5 text-weight-bold col">Schede</div>
      <q-btn
        unelevated
        round
        color="primary"
        text-color="dark"
        icon="add"
        aria-label="Nuova scheda"
        @click="create"
      />
    </div>

    <div v-if="!sorted.length" class="text-muted text-center q-pa-xl">Nessuna scheda.</div>

    <div v-for="p in sorted" :key="p.id" class="card q-pa-md q-mb-md" @click="open(p.id)">
      <div class="row items-center no-wrap">
        <div class="col" style="min-width: 0">
          <div class="row items-center q-gutter-x-sm">
            <div class="text-h6 ellipsis">{{ p.name }}</div>
            <q-badge v-if="p.id === active?.id" color="primary" text-color="dark" label="attiva" />
          </div>
          <div class="text-caption text-muted">
            dal {{ formatDate(p.startDate)
            }}<template v-if="p.endDate"> al {{ formatDate(p.endDate) }}</template> ·
            {{ p.days.length }} giorni
          </div>
        </div>
        <q-btn flat round icon="more_vert" color="grey-6" @click.stop>
          <q-menu auto-close>
            <q-list style="min-width: 220px">
              <q-item clickable @click="duplicate(p)">
                <q-item-section avatar><q-icon name="content_copy" /></q-item-section>
                <q-item-section>
                  <q-item-label>Duplica come nuova</q-item-label>
                  <q-item-label caption>Per la scheda del mese dopo</q-item-label>
                </q-item-section>
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
        <q-chip v-for="d in p.days" :key="d.id" dense outline color="grey-6">{{ d.name }}</q-chip>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { useLiveQuery } from '@/composables/useLiveQuery';
import { db, newId } from '@/db';
import type { Program } from '@/db/types';
import { formatDate, todayIso } from '@/domain/format';
import { activeProgram } from '@/domain/session';

const $q = useQuasar();
const router = useRouter();
const { data: programs } = useLiveQuery(() => db.programs.toArray(), [], []);

const sorted = computed(() =>
  [...(programs.value ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate)),
);
const active = computed(() => activeProgram(programs.value ?? [], todayIso()));

const open = (id: string) => void router.push({ name: 'program', params: { id } });

async function create() {
  const p: Program = {
    id: newId(),
    name: 'Nuova scheda',
    startDate: todayIso(),
    source: 'user',
    days: [{ id: newId(), name: 'Giorno A', blocks: [] }],
    updatedAt: Date.now(),
  };
  await db.programs.add(p);
  open(p.id);
}

/** Copia con id nuovi: le sessioni restano legate alla scheda originale. */
async function duplicate(p: Program) {
  const copy: Program = JSON.parse(JSON.stringify(p)) as Program;
  copy.id = newId();
  copy.name = `${p.name} (copia)`;
  copy.startDate = todayIso();
  delete copy.endDate;
  copy.source = 'user';
  copy.updatedAt = Date.now();
  for (const d of copy.days) {
    d.id = newId();
    for (const b of d.blocks) {
      b.id = newId();
      for (const i of b.items) i.id = newId();
    }
  }
  await db.programs.add(copy);
  open(copy.id);
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
