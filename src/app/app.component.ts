import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SettingsRepository } from './core/persistence/settings.repository';
import { RoutineRepository } from './core/persistence/routine.repository';
import { ThemePreference } from './core/timer-engine/timer-engine.types';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      <!-- Encabezado -->
      <header class="app-header" role="banner">
        <a routerLink="/biblioteca" class="app-logo" aria-label="Inicio · Intervala">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <circle cx="14" cy="14" r="12" stroke="var(--color-accent)" stroke-width="2.5"/>
            <path d="M14 8v6l4 2" stroke="var(--color-accent)" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="app-logo-text">Intervala</span>
        </a>

        @if (isOffline) {
          <span class="header-offline-badge" role="status" aria-live="polite">
            Sin conexión
          </span>
        }
      </header>

      <!-- Contenido principal -->
      <main class="app-main" id="main-content" tabindex="-1">
        <router-outlet />
      </main>

      <!-- Navegación inferior (móvil) -->
      <nav class="bottom-nav" aria-label="Navegación principal">
        <a routerLink="/biblioteca" routerLinkActive="active"
           class="nav-item" aria-label="Biblioteca de rutinas">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span>Rutinas</span>
        </a>

        <a routerLink="/historial" routerLinkActive="active"
           class="nav-item" aria-label="Historial de sesiones">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 8v4l3 3"/>
            <circle cx="12" cy="12" r="9"/>
          </svg>
          <span>Historial</span>
        </a>

        <a routerLink="/ajustes" routerLinkActive="active"
           class="nav-item" aria-label="Ajustes">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
          </svg>
          <span>Ajustes</span>
        </a>
      </nav>
    </div>
  `,
  styles: [`
    .app-shell {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }

    .app-header {
      position: sticky;
      top: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: var(--header-height);
      padding: 0 var(--space-4);
      background: var(--color-bg-secondary);
      border-bottom: 1px solid var(--color-border);
    }

    .app-logo {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      text-decoration: none;
      color: var(--color-text-primary);
    }
    .app-logo-text {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-bold);
      letter-spacing: -0.02em;
    }

    .header-offline-badge {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      padding: var(--space-1) var(--space-3);
      background: var(--color-warning);
      color: #1a1a1e;
      border-radius: var(--radius-full);
    }

    .app-main {
      flex: 1;
      overflow-y: auto;
      padding-bottom: calc(var(--nav-height) + env(safe-area-inset-bottom));
    }

    /* ── Navegación inferior ─────────────────────── */
    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: calc(var(--nav-height) + env(safe-area-inset-bottom));
      padding-bottom: env(safe-area-inset-bottom);
      display: flex;
      align-items: flex-start;
      justify-content: space-around;
      background: var(--color-bg-secondary);
      border-top: 1px solid var(--color-border);
      z-index: 40;
    }

    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      padding: var(--space-2) var(--space-4);
      min-height: var(--touch-target);
      color: var(--color-text-muted);
      text-decoration: none;
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      transition: color var(--duration-normal) var(--easing-default);
      border-radius: var(--radius-md);
    }
    .nav-item:hover,
    .nav-item.active {
      color: var(--color-accent);
    }

    /* ── Escritorio: nav lateral ─────────────────── */
    @media (min-width: 768px) {
      .app-shell {
        display: grid;
        grid-template-columns: 220px 1fr;
        grid-template-rows: var(--header-height) 1fr;
        grid-template-areas:
          "header header"
          "nav    main";
      }
      .app-header {
        grid-area: header;
      }
      .app-main {
        grid-area: main;
        padding-bottom: 0;
      }
      .bottom-nav {
        position: sticky;
        top: var(--header-height);
        grid-area: nav;
        height: calc(100dvh - var(--header-height));
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        gap: var(--space-1);
        padding: var(--space-4) var(--space-3);
        border-top: none;
        border-right: 1px solid var(--color-border);
        overflow-y: auto;
      }
      .nav-item {
        flex-direction: row;
        justify-content: flex-start;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        font-size: var(--font-size-sm);
        border-radius: var(--radius-md);
      }
    }
  `],
})
export class AppComponent implements OnInit {
  private settingsRepo = inject(SettingsRepository);
  private routineRepo = inject(RoutineRepository);
  isOffline = false;

  ngOnInit(): void {
    this.applyTheme();
    this.seedData();
    this.watchOnlineStatus();
  }

  private async applyTheme(): Promise<void> {
    const settings = await this.settingsRepo.get();
    this.setTheme(settings.theme);
  }

  private setTheme(pref: ThemePreference): void {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = pref === 'dark' || (pref === 'system' && prefersDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }

  private async seedData(): Promise<void> {
    await this.routineRepo.seedDefaultTemplates();
  }

  private watchOnlineStatus(): void {
    this.isOffline = !navigator.onLine;
    window.addEventListener('online', () => (this.isOffline = false));
    window.addEventListener('offline', () => (this.isOffline = true));
  }
}
