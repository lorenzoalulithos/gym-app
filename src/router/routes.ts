import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      { path: '', name: 'today', component: () => import('@/pages/TodayPage.vue') },
      { path: 'calendario', name: 'calendar', component: () => import('@/pages/CalendarPage.vue') },
      { path: 'storico', redirect: '/calendario' },
      { path: 'esercizi', name: 'exercises', component: () => import('@/pages/ExercisesPage.vue') },
      {
        path: 'esercizi/:id',
        name: 'exercise',
        component: () => import('@/pages/ExercisePage.vue'),
        props: true,
      },
      { path: 'schede', name: 'programs', component: () => import('@/pages/ProgramsPage.vue') },
      {
        path: 'schede/:id',
        name: 'program',
        component: () => import('@/pages/ProgramWizardPage.vue'),
        props: true,
      },
      {
        path: 'schede/:programId/giorno/:dayId',
        redirect: (to) => ({
          name: 'program',
          params: { id: to.params.programId },
          query: { passo: '2' },
        }),
      },
      { path: 'foto', name: 'photos', component: () => import('@/pages/PhotosPage.vue') },
      { path: 'altro', name: 'more', component: () => import('@/pages/MorePage.vue') },
      { path: 'report', name: 'report', component: () => import('@/pages/ReportPage.vue') },
      { path: 'corpo', name: 'body', component: () => import('@/pages/BodyPage.vue') },
    ],
  },
  {
    path: '/allenamento/:id',
    name: 'workout',
    component: () => import('@/pages/WorkoutPage.vue'),
    props: true,
  },
  {
    path: '/round/:id',
    name: 'rounds',
    component: () => import('@/pages/RoundsPage.vue'),
    props: true,
  },
  {
    path: '/:catchAll(.*)*',
    redirect: '/',
  },
];

export default routes;
