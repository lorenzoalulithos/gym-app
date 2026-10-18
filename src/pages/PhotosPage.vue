<template>
  <q-page class="page-pad">
    <div class="row items-center q-mb-md q-mt-sm">
      <q-btn flat round icon="arrow_back" aria-label="Indietro" @click="router.back()" />
      <div class="text-h5 text-weight-bold col">Foto progressi</div>
    </div>

    <!-- Mese corrente -->
    <div class="card q-pa-md q-mb-lg">
      <div class="row items-baseline q-mb-sm">
        <div class="text-h6 col">{{ formatMonth(month) }}</div>
        <div class="text-caption text-muted">stessa luce, stessa distanza</div>
      </div>
      <div class="row q-col-gutter-sm">
        <div v-for="pose in poses" :key="pose" class="col-4">
          <div class="slot" @click="pick(pose)">
            <img v-if="urlOf(month, pose)" :src="urlOf(month, pose)" :alt="POSES[pose]" />
            <div v-else class="empty column flex-center">
              <q-icon name="add_a_photo" size="28px" />
            </div>
            <div class="slot-label">{{ POSES[pose] }}</div>
          </div>
        </div>
      </div>
      <div class="row items-center q-mt-md q-gutter-x-sm">
        <q-input
          v-model.number="weight"
          dense
          outlined
          type="number"
          step="0.1"
          label="Peso di oggi (kg)"
          class="col"
        />
        <q-btn
          unelevated
          no-caps
          color="secondary"
          label="Salva peso"
          :disable="!weight"
          @click="saveWeight"
        />
      </div>
      <div v-if="lastWeight" class="text-caption text-muted q-mt-xs">
        Ultimo: {{ lastWeight.weightKg }} kg il {{ formatDate(lastWeight.date) }}
      </div>
    </div>

    <!-- Confronto -->
    <template v-if="months.length > 1">
      <div class="section-label q-mb-sm">Confronta</div>
      <div class="card q-pa-md q-mb-lg">
        <div class="row q-col-gutter-sm q-mb-sm">
          <div class="col">
            <q-select
              v-model="cmpA"
              dense
              outlined
              emit-value
              map-options
              :options="monthOpts"
              label="Prima"
            />
          </div>
          <div class="col">
            <q-select
              v-model="cmpB"
              dense
              outlined
              emit-value
              map-options
              :options="monthOpts"
              label="Dopo"
            />
          </div>
        </div>
        <q-btn-toggle
          v-model="cmpPose"
          spread
          no-caps
          unelevated
          toggle-color="primary"
          toggle-text-color="dark"
          color="grey-9"
          :options="poseOpts"
          class="q-mb-sm"
        />
        <div class="row q-col-gutter-sm">
          <div v-for="m in [cmpA, cmpB]" :key="m" class="col-6">
            <div class="slot tall">
              <img v-if="m && urlOf(m, cmpPose)" :src="urlOf(m, cmpPose)" alt="" />
              <div v-else class="empty column flex-center text-caption">nessuna foto</div>
              <div class="slot-label">{{ m ? formatMonth(m) : '' }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Archivio -->
    <div v-if="pastMonths.length" class="section-label q-mb-sm">Mesi precedenti</div>
    <div v-for="m in pastMonths" :key="m" class="q-mb-md">
      <div class="text-weight-bold q-mb-xs">{{ formatMonth(m) }}</div>
      <div class="row q-col-gutter-sm">
        <div v-for="pose in poses" :key="pose" class="col-4">
          <div class="slot small">
            <img v-if="urlOf(m, pose)" :src="urlOf(m, pose)" :alt="POSES[pose]" />
            <div v-else class="empty" />
          </div>
        </div>
      </div>
    </div>

    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFile" />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { useLiveQuery } from '@/composables/useLiveQuery';
import { db, newId } from '@/db';
import type { Pose, ProgressPhoto } from '@/db/types';
import { currentMonth, formatDate, formatMonth, todayIso } from '@/domain/format';
import { POSES } from '@/domain/labels';
import { savePhoto } from '@/services/photos';

const $q = useQuasar();
const router = useRouter();
const month = currentMonth();
const poses: Pose[] = ['front', 'side', 'back'];
const poseOpts = poses.map((p) => ({ label: POSES[p], value: p }));

const { data: photos } = useLiveQuery(() => db.photos.toArray(), [], [] as ProgressPhoto[]);
const { data: metrics } = useLiveQuery(
  () => db.bodyMetrics.orderBy('date').reverse().toArray(),
  [],
  [],
);

// Object URL per ogni foto, rilasciati quando cambiano o si esce dalla pagina.
const urls = ref(new Map<string, string>());
watch(photos, (list) => {
  urls.value.forEach((u) => URL.revokeObjectURL(u));
  urls.value = new Map((list ?? []).map((p) => [p.id, URL.createObjectURL(p.blob)]));
});
onBeforeUnmount(() => urls.value.forEach((u) => URL.revokeObjectURL(u)));
const urlOf = (m: string, pose: Pose) => urls.value.get(`${m}-${pose}`);

const months = computed(() =>
  [...new Set([month, ...(photos.value ?? []).map((p) => p.month)])].sort().reverse(),
);
const pastMonths = computed(() => months.value.filter((m) => m !== month));
const monthOpts = computed(() => months.value.map((m) => ({ value: m, label: formatMonth(m) })));

const cmpA = ref<string>();
const cmpB = ref<string>(month);
const cmpPose = ref<Pose>('front');
watch(months, (m) => (cmpA.value ??= m.at(-1)), { immediate: true });

const fileInput = ref<HTMLInputElement>();
let pendingPose: Pose = 'front';
function pick(pose: Pose) {
  pendingPose = pose;
  fileInput.value?.click();
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const dismiss = $q.notify({ message: 'Salvo la foto…', spinner: true, timeout: 0 });
  try {
    await savePhoto(month, pendingPose, file);
    dismiss();
    $q.notify({
      message: `${POSES[pendingPose]} salvata`,
      color: 'positive',
      textColor: 'dark',
      icon: 'check',
    });
  } catch (err) {
    dismiss();
    $q.notify({ message: `Errore: ${(err as Error).message}`, color: 'negative' });
  }
}

const weight = ref<number>();
const lastWeight = computed(() => metrics.value?.find((m) => m.weightKg));
async function saveWeight() {
  if (!weight.value) return;
  await db.bodyMetrics.add({ id: newId(), date: todayIso(), weightKg: weight.value });
  weight.value = undefined;
  $q.notify({ message: 'Peso salvato', color: 'positive', textColor: 'dark', icon: 'check' });
}
</script>

<style scoped lang="scss">
.slot {
  position: relative;
  aspect-ratio: 3 / 4;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  &.tall {
    aspect-ratio: 2 / 3;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .empty {
    width: 100%;
    height: 100%;
    color: rgba(255, 255, 255, 0.35);
  }
}
.slot-label {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 700;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
}
</style>
