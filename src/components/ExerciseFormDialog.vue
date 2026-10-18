<template>
  <q-dialog
    ref="dialogRef"
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
    @hide="onDialogHide"
  >
    <q-card class="column no-wrap form-card">
      <div class="row items-center q-pa-md head">
        <q-btn flat round icon="close" @click="onDialogCancel" />
        <div class="text-h6 col q-ml-sm">
          {{ isNew ? 'Nuovo esercizio' : 'Modifica esercizio' }}
        </div>
        <q-btn
          unelevated
          no-caps
          color="primary"
          text-color="dark"
          label="Salva"
          :disable="!form.name.trim()"
          @click="save"
        />
      </div>

      <div class="col scroll q-pa-md q-gutter-y-md">
        <!-- Foto -->
        <div class="row items-center no-wrap q-gutter-x-md">
          <div class="photo" @click="fileInput?.click()">
            <img v-if="form.images[0]" :src="photoSrc" alt="" />
            <q-icon v-else name="add_a_photo" size="28px" color="grey-6" />
          </div>
          <div class="col text-caption text-muted">
            Una foto (anche della macchina in palestra) ti aiuta a riconoscerlo al volo.
            <div>
              <q-btn
                flat
                dense
                no-caps
                color="primary"
                :label="form.images[0] ? 'Cambia foto' : 'Aggiungi foto'"
                @click="fileInput?.click()"
              />
              <q-btn
                v-if="form.images[0]"
                flat
                dense
                no-caps
                color="grey-5"
                label="Togli"
                @click="form.images = []"
              />
            </div>
          </div>
        </div>

        <q-input
          v-model="form.name"
          outlined
          label="Nome *"
          autofocus
          hint="Come lo chiami in palestra"
        />
        <q-input v-model="form.nameIt" outlined label="Nome alternativo (facoltativo)" />

        <div>
          <div class="text-caption text-muted q-mb-xs">Cosa registri</div>
          <q-btn-toggle
            v-model="form.measure"
            spread
            no-caps
            unelevated
            toggle-color="primary"
            toggle-text-color="dark"
            color="grey-9"
            :options="measureOpts"
            class="wrap-toggle"
          />
        </div>

        <div>
          <div class="text-caption text-muted q-mb-xs">Attrezzo</div>
          <div class="chips">
            <q-chip
              v-for="(label, key) in EQUIPMENT"
              :key="key"
              clickable
              :outline="form.equipment !== key"
              :color="form.equipment === key ? 'primary' : 'grey-7'"
              :text-color="form.equipment === key ? 'dark' : undefined"
              @click="setEquipment(key)"
            >
              {{ label }}
            </q-chip>
          </div>
        </div>

        <div v-if="usesWeight">
          <div class="text-caption text-muted q-mb-xs">Il carico che scrivi è…</div>
          <q-option-group v-model="form.loadMode" :options="loadOpts" color="primary" />
        </div>

        <div>
          <div class="text-caption text-muted q-mb-xs">Muscoli principali</div>
          <div class="chips">
            <q-chip
              v-for="(label, key) in MUSCLES"
              :key="key"
              clickable
              :outline="!form.primaryMuscles.includes(key)"
              :color="form.primaryMuscles.includes(key) ? 'primary' : 'grey-7'"
              :text-color="form.primaryMuscles.includes(key) ? 'dark' : undefined"
              @click="toggleMuscle(key)"
            >
              {{ label }}
            </q-chip>
          </div>
        </div>

        <q-toggle v-model="form.perSide" label="Un lato alla volta (ripetizioni per lato)" />
        <q-toggle
          v-if="form.loadMode === 'per_implement'"
          :model-value="form.implements === 2"
          label="Due attrezzi insieme (es. due manubri)"
          @update:model-value="(v: boolean) => (form.implements = v ? 2 : 1)"
        />

        <q-input v-model="form.videoUrl" outlined label="Link a un video (facoltativo)" />
        <q-input v-model="form.notes" outlined autogrow label="Note (regolazioni, esecuzione…)" />
      </div>
      <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onPhoto" />
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useDialogPluginComponent, useQuasar } from 'quasar';
import type { Exercise, LoadMode, Measure } from '@/db/types';
import { EQUIPMENT, LOAD_MODES, MUSCLES } from '@/domain/labels';
import { compressImage } from '@/services/photos';
import { useExercisesStore } from '@/stores/exercises';

// Esercizi propri, che non sono nella libreria: si creano da qui (anche al volo dal
// selettore o dall'incolla testo) e poi si usano come tutti gli altri.

const props = defineProps<{ exerciseId?: string; name?: string; muscle?: string }>();
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent();
const $q = useQuasar();
const store = useExercisesStore();

const existing = props.exerciseId ? store.get(props.exerciseId) : undefined;
const isNew = !existing;

const form = reactive<Exercise>(
  existing
    ? (JSON.parse(JSON.stringify(existing)) as Exercise)
    : {
        id: '',
        name: props.name ?? '',
        aliases: [],
        category: 'strength',
        equipment: 'dumbbell',
        primaryMuscles: props.muscle ? [props.muscle] : [],
        secondaryMuscles: [],
        instructions: [],
        images: [],
        measure: 'weight_reps',
        loadMode: 'per_implement',
        perSide: false,
        implements: 2,
        source: 'custom',
        updatedAt: 0,
      },
);

const measureOpts: { label: string; value: Measure }[] = [
  { label: 'Kg × rip', value: 'weight_reps' },
  { label: 'Ripetizioni', value: 'reps' },
  { label: 'Tempo', value: 'time' },
  { label: 'Kg × tempo', value: 'weight_time' },
];
const usesWeight = computed(
  () =>
    form.measure === 'weight_reps' || form.measure === 'weight_time' || form.loadMode === 'added',
);
const loadOpts = (Object.keys(LOAD_MODES) as LoadMode[]).map((k) => ({
  label: LOAD_MODES[k],
  value: k,
}));

const DEFAULT_LOAD: Record<string, LoadMode> = {
  dumbbell: 'per_implement',
  kettlebells: 'per_implement',
  barbell: 'total',
  'e-z curl bar': 'total',
  cable: 'stack',
  machine: 'stack',
  'body only': 'added',
  bands: 'none',
};

function setEquipment(key: string) {
  form.equipment = key;
  form.loadMode = DEFAULT_LOAD[key] ?? 'total';
  form.implements = key === 'dumbbell' ? 2 : 1;
  if (key === 'body only' && form.measure === 'weight_reps') form.measure = 'reps';
}

function toggleMuscle(m: string) {
  const i = form.primaryMuscles.indexOf(m);
  if (i >= 0) form.primaryMuscles.splice(i, 1);
  else form.primaryMuscles.push(m);
}

const photoSrc = computed(() => form.images[0] ?? '');

const fileInput = ref<HTMLInputElement>();
async function onPhoto(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const blob = await compressImage(file, 480, 0.8);
  const reader = new FileReader();
  reader.onload = () => (form.images = [reader.result as string]);
  reader.readAsDataURL(blob);
}

async function save() {
  const out: Exercise = JSON.parse(JSON.stringify(form)) as Exercise;
  out.name = out.name.trim();
  if (isNew) out.id = store.newIdFor(out.name);
  for (const k of ['nameIt', 'videoUrl', 'notes'] as const) if (!out[k]?.trim()) delete out[k];
  await store.save(out);
  $q.notify({
    message: `${out.name} salvato`,
    color: 'positive',
    textColor: 'dark',
    icon: 'check',
  });
  onDialogOK(out.id);
}
</script>

<style scoped lang="scss">
.form-card {
  background: $dark-page;
}
.head {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.photo {
  width: 84px;
  height: 84px;
  flex: none;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
.chips {
  display: flex;
  flex-wrap: wrap;
  .q-chip {
    margin: 0 6px 6px 0;
  }
}
</style>
