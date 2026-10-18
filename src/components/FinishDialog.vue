<template>
  <q-dialog ref="dialogRef" position="bottom" @hide="onDialogHide">
    <q-card class="finish-card">
      <q-card-section>
        <div class="text-h6">Com'è andata?</div>
        <div v-if="pending > 0" class="text-caption text-warning q-mt-xs">
          {{ pending }} serie non segnate verranno scartate.
        </div>
      </q-card-section>
      <q-card-section class="q-pt-none">
        <div class="row q-col-gutter-sm">
          <div v-for="d in 5" :key="d" class="col">
            <q-btn
              unelevated
              stack
              no-caps
              class="full-width diff-btn"
              :color="difficulty === d ? 'primary' : 'grey-9'"
              :text-color="difficulty === d ? 'dark' : 'grey-4'"
              @click="difficulty = d"
            >
              <div class="text-h6">{{ d }}</div>
              <div class="text-caption">{{ DIFFICULTY[d] }}</div>
            </q-btn>
          </div>
        </div>
        <q-input v-model="notes" outlined autogrow class="q-mt-md" label="Note (facoltative)" />
      </q-card-section>
      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat no-caps label="Continua allenamento" @click="onDialogCancel" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          text-color="dark"
          label="Salva allenamento"
          class="text-weight-bold"
          @click="onDialogOK({ difficulty, notes })"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useDialogPluginComponent } from 'quasar';
import { DIFFICULTY } from '@/domain/labels';

defineProps<{ pending: number }>();
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const difficulty = ref<number | undefined>();
const notes = ref('');
</script>

<style scoped lang="scss">
.finish-card {
  width: 100%;
  max-width: 640px;
  border-radius: 20px 20px 0 0;
}
.diff-btn {
  padding: 8px 0;
  border-radius: 12px;
}
</style>
