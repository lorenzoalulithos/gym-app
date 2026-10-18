<template>
  <!-- Allenamento: entra dal basso; tra le sezioni con le tab: dissolvenza (vedi MainLayout) -->
  <router-view #default="{ Component, route }">
    <transition :name="route.name === 'workout' ? 'sheet-up' : 'fade'" mode="out-in">
      <component :is="Component" :key="route.matched[0]?.path" />
    </transition>
  </router-view>
</template>
