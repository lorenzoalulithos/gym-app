<template>
  <q-dialog ref="dialogRef" position="bottom" @hide="onDialogHide">
    <q-card class="share-card">
      <q-card-section class="row items-center q-pb-sm">
        <div class="text-h6 col">Condividi il riepilogo</div>
        <q-btn flat round icon="close" @click="onDialogCancel" />
      </q-card-section>
      <q-card-section class="q-pt-none">
        <div class="preview">
          <img v-if="url" :src="url" alt="Riepilogo dell'allenamento" />
          <q-spinner v-else color="primary" size="40px" />
        </div>
      </q-card-section>
      <q-card-actions class="q-pa-md q-gutter-sm">
        <q-btn
          outline
          no-caps
          icon="download"
          label="Salva"
          class="col"
          :disable="!blob"
          @click="save"
        />
        <q-btn
          unelevated
          no-caps
          color="primary"
          text-color="dark"
          icon="ios_share"
          label="Condividi"
          class="col text-weight-bold"
          :disable="!blob"
          @click="share"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useDialogPluginComponent, useQuasar } from 'quasar';
import { shareOrDownload } from '@/services/backup';
import { renderShareCard, type ShareCardData } from '@/services/shareCard';

const props = defineProps<{ data: ShareCardData; filename: string }>();
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogCancel } = useDialogPluginComponent();
const $q = useQuasar();

const blob = ref<Blob>();
const url = ref('');

onMounted(async () => {
  try {
    blob.value = await renderShareCard(props.data);
    url.value = URL.createObjectURL(blob.value);
  } catch (e) {
    $q.notify({ message: `Errore: ${(e as Error).message}`, color: 'negative' });
  }
});
onBeforeUnmount(() => url.value && URL.revokeObjectURL(url.value));

const share = () => blob.value && void shareOrDownload(blob.value, props.filename);

function save() {
  if (!blob.value) return;
  const a = document.createElement('a');
  a.href = url.value;
  a.download = props.filename;
  a.click();
}
</script>

<style scoped lang="scss">
.share-card {
  width: 100%;
  max-width: 640px;
  border-radius: 20px 20px 0 0;
  padding-bottom: env(safe-area-inset-bottom);
}
.preview {
  aspect-ratio: 1080 / 1350;
  max-height: 60vh;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  img {
    max-width: 100%;
    max-height: 60vh;
    border-radius: 14px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
  }
}
</style>
