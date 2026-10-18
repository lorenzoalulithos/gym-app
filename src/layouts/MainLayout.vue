<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container>
      <router-view />
    </q-page-container>

    <q-footer class="nav-footer">
      <nav class="nav">
        <router-link
          v-for="t in tabs"
          :key="t.to"
          :to="t.to"
          class="nav-tab"
          :class="{ active: isActive(t.to) }"
        >
          <q-icon :name="t.icon" size="24px" />
          <span>{{ t.label }}</span>
        </router-link>
      </nav>
    </q-footer>
  </q-layout>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();

const tabs = [
  { to: '/', icon: 'bolt', label: 'Oggi' },
  { to: '/calendario', icon: 'calendar_month', label: 'Calendario' },
  { to: '/esercizi', icon: 'fitness_center', label: 'Esercizi' },
  { to: '/schede', icon: 'view_list', label: 'Schede' },
  { to: '/altro', icon: 'more_horiz', label: 'Altro' },
];

// Le sottopagine (es. /schede/:id) tengono acceso il tab della sezione; Foto sta sotto Altro.
function isActive(to: string) {
  const p = route.path;
  if (to === '/') return p === '/';
  if (to === '/altro') return p.startsWith('/altro') || p.startsWith('/foto');
  return p.startsWith(to);
}
</script>

<style scoped lang="scss">
.nav-footer {
  background: rgba(11, 12, 15, 0.92);
  backdrop-filter: blur(12px);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: env(safe-area-inset-bottom);
}
.nav {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
}
.nav-tab {
  min-height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  min-width: 0;
  &.active {
    color: $primary;
  }
  span {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
