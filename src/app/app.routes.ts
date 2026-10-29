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
    title: 'Biblioteca · Ritmera',
  },
  {
    path: 'rutina/nueva',
    loadComponent: () =>
      import('./features/routine-editor/routine-editor.component').then(
        m => m.RoutineEditorComponent
      ),
    title: 'Nueva rutina · Ritmera',
  },
  {
    path: 'rutina/:id/editar',
    loadComponent: () =>
      import('./features/routine-editor/routine-editor.component').then(
        m => m.RoutineEditorComponent
      ),
    title: 'Editar rutina · Ritmera',
  },
  {
    path: 'temporizador/:id',
    loadComponent: () =>
      import('./features/timer-runner/timer-runner.component').then(
        m => m.TimerRunnerComponent
      ),
    title: 'Temporizador · Ritmera',
  },
  {
    path: 'temporizador-rapido',
    loadComponent: () =>
      import('./features/timer-runner/timer-runner.component').then(
        m => m.TimerRunnerComponent
      ),
    title: 'Temporizador rápido · Ritmera',
  },
  {
    path: 'historial',
    loadComponent: () =>
      import('./features/history/history.component').then(m => m.HistoryComponent),
    title: 'Historial · Ritmera',
  },
  {
    path: 'ajustes',
    loadComponent: () =>
      import('./features/settings/settings.component').then(m => m.SettingsComponent),
    title: 'Ajustes · Ritmera',
  },
  {
    path: '**',
    redirectTo: 'biblioteca',
  },
];
