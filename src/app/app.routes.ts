import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'biblioteca',
    pathMatch: 'full',
  },
  {
    path: 'biblioteca',
    loadComponent: () =>
      import('./features/library/library.component').then(m => m.LibraryComponent),
    title: 'Biblioteca · Intervala',
  },
  {
    path: 'rutina/nueva',
    loadComponent: () =>
      import('./features/routine-editor/routine-editor.component').then(
        m => m.RoutineEditorComponent
      ),
    title: 'Nueva rutina · Intervala',
  },
  {
    path: 'rutina/:id/editar',
    loadComponent: () =>
      import('./features/routine-editor/routine-editor.component').then(
        m => m.RoutineEditorComponent
      ),
    title: 'Editar rutina · Intervala',
  },
  {
    path: 'temporizador/:id',
    loadComponent: () =>
      import('./features/timer-runner/timer-runner.component').then(
        m => m.TimerRunnerComponent
      ),
    title: 'Temporizador · Intervala',
  },
  {
    path: 'temporizador-rapido',
    loadComponent: () =>
      import('./features/timer-runner/timer-runner.component').then(
        m => m.TimerRunnerComponent
      ),
    title: 'Temporizador rápido · Intervala',
  },
  {
    path: 'historial',
    loadComponent: () =>
      import('./features/history/history.component').then(m => m.HistoryComponent),
    title: 'Historial · Intervala',
  },
  {
    path: 'ajustes',
    loadComponent: () =>
      import('./features/settings/settings.component').then(m => m.SettingsComponent),
    title: 'Ajustes · Intervala',
  },
  {
    path: '**',
    redirectTo: 'biblioteca',
  },
];
