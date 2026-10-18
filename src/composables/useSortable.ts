import Sortable from 'sortablejs';
import { onBeforeUnmount, watch, type Ref } from 'vue';

/**
 * Riordino trascinando (anche col dito) gli elementi figli di `el`.
 * Sortable sposta i nodi nel DOM: lo spostamento viene annullato e rifatto sull'array,
 * così è Vue a ridisegnare la lista e i due non vanno mai in conflitto.
 */
export function useSortable(
  el: Ref<HTMLElement | undefined | null>,
  getList: () => unknown[] | undefined,
  handle = '.drag-handle',
) {
  let sortable: Sortable | undefined;

  watch(
    el,
    (node) => {
      sortable?.destroy();
      sortable = undefined;
      if (!node) return;
      sortable = Sortable.create(node, {
        handle,
        animation: 160,
        delay: 0,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: (e) => {
          const { oldIndex, newIndex, item, from } = e;
          if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
          from.removeChild(item);
          from.insertBefore(item, from.children[oldIndex] ?? null);
          const list = getList();
          if (!list) return;
          const [moved] = list.splice(oldIndex, 1);
          list.splice(newIndex, 0, moved);
        },
      });
    },
    { immediate: true, flush: 'post' },
  );

  onBeforeUnmount(() => sortable?.destroy());
}
