<template>
  <q-dialog ref="dialogRef" position="bottom" @hide="onDialogHide">
    <q-card class="move-card">
      <q-card-section>
        <div class="text-h6">Sposta "{{ dayName }}"</div>
        <div class="text-caption text-muted">Da {{ formatDate(from) }}</div>
      </q-card-section>
      <q-card-section class="q-pt-none">
        <div class="row q-gutter-sm q-mb-md">
          <q-btn
            v-for="q in quick"
            :key="q.date"
            unelevated
            no-caps
            :color="target === q.date ? 'primary' : 'grey-9'"
            :text-color="target === q.date ? 'dark' : 'grey-4'"
            :label="q.label"
            @click="target = q.date"
          />
        </div>
        <q-date
          v-model="target"
          mask="YYYY-MM-DD"
          minimal
          flat
          first-day-of-week="1"
          :events="busyDates"
          event-color="secondary"
          :options="(d: string) => d.replaceAll('/', '-') >= today"
          class="full-width"
          color="primary"
          text-color="dark"
        />
        <div v-if="conflict" class="text-warning text-caption q-mt-sm">
          Quel giorno c'è già "{{ conflict }}": verrà sostituito.
        </div>
      </q-card-section>
      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat no-caps label="Annulla" @click="onDialogCancel" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          text-color="dark"
          label="Sposta"
          :disable="!target || target === from"
          @click="onDialogOK(target)"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useDialogPluginComponent } from 'quasar';
import { addDays } from '@/domain/calendar';
import { formatDate, todayIso } from '@/domain/format';

const props = defineProps<{
  from: string;
  dayName: string;
  /** Date (YYYY-MM-DD) che hanno già un allenamento previsto, con il nome. */
  busy: Record<string, string>;
}>();
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const today = todayIso();
const firstFree = [0, 1, 2, 3]
  .map((n) => addDays(today, n))
  .find((d) => !props.busy[d] && d !== props.from);
const target = ref(firstFree ?? addDays(today, 1));

const quick = [
  { date: today, label: 'Oggi' },
  { date: addDays(today, 1), label: 'Domani' },
  { date: addDays(today, 2), label: 'Dopodomani' },
].filter((q) => q.date !== props.from);

const busyDates = computed(() => Object.keys(props.busy).map((d) => d.replaceAll('-', '/')));
const conflict = computed(() =>
  target.value !== props.from ? props.busy[target.value] : undefined,
);
</script>

<style scoped lang="scss">
.move-card {
  width: 100%;
  max-width: 640px;
  border-radius: 20px 20px 0 0;
}
</style>
