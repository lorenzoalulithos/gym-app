<template>
  <q-dialog ref="dialogRef" position="bottom" @hide="onDialogHide">
    <q-card v-if="ex" class="info-card">
      <ExerciseImage :src="ex.images" :alt="ex.name" size="100%" animate class="info-img" />
      <q-card-section>
        <div class="text-h6">{{ ex.name }}</div>
        <div v-if="ex.nameIt" class="text-muted">{{ ex.nameIt }}</div>
        <div class="q-mt-sm">
          <q-chip v-for="m in ex.primaryMuscles" :key="m" dense color="primary" text-color="dark">
            {{ muscleLabel(m) }}
          </q-chip>
          <q-chip v-for="m in ex.secondaryMuscles" :key="m" dense outline color="grey-6">
            {{ muscleLabel(m) }}
          </q-chip>
          <q-chip dense outline color="grey-6" icon="sports_gymnastics">
            {{ equipmentLabel(ex.equipment) }}
          </q-chip>
        </div>
        <div v-if="ex.notes" class="q-mt-sm text-warning">{{ ex.notes }}</div>
        <ol v-if="ex.instructions.length" class="instructions q-mt-md">
          <li v-for="(s, i) in ex.instructions" :key="i">{{ s }}</li>
        </ol>
      </q-card-section>
      <q-card-actions align="between">
        <q-btn
          v-if="ex.videoUrl"
          flat
          no-caps
          icon="smart_display"
          label="Video"
          :href="ex.videoUrl"
          target="_blank"
        />
        <q-space />
        <q-btn flat no-caps label="Storico e dettagli" color="primary" @click="openPage" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDialogPluginComponent } from 'quasar';
import { useRouter } from 'vue-router';
import ExerciseImage from './ExerciseImage.vue';
import { equipmentLabel, muscleLabel } from '@/domain/labels';
import { useExercisesStore } from '@/stores/exercises';

const props = defineProps<{ exerciseId: string }>();
defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
const router = useRouter();
const ex = computed(() => useExercisesStore().get(props.exerciseId));

function openPage() {
  onDialogOK();
  void router.push({ name: 'exercise', params: { id: props.exerciseId } });
}
</script>

<style scoped lang="scss">
.info-card {
  width: 100%;
  max-width: 640px;
  max-height: 88vh;
  border-radius: 20px 20px 0 0;
}
.info-img {
  aspect-ratio: 4 / 3;
  height: auto !important;
  border-radius: 0;
}
.instructions {
  padding-left: 20px;
  color: rgba(255, 255, 255, 0.8);
  li {
    margin-bottom: 6px;
  }
}
</style>
