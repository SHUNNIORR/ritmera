import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { SettingsRepository } from './core/persistence/settings.repository';
import { RoutineRepository } from './core/persistence/routine.repository';
import { ThemePreference } from './core/timer-engine/timer-engine.types';
import { LibrarySearchService } from './core/ui/library-search.service';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, RouterLink, RouterLinkActive],
    template: `
    <div class="app-shell">
      <!-- Encabezado -->
      <header class="app-header" role="banner">
        <a routerLink="/biblioteca" class="app-logo" aria-label="Inicio · Ritmera">
          <img
            src="icons/icon.svg"
            alt=""
            class="app-logo-icon"
            width="32"
            height="32"
            aria-hidden="true"
          />
          <span class="app-logo-text">Ritmera</span>
          <span class="app-logo-beat" aria-hidden="true"></span>
        </a>

        @if (isLibrary()) {
          <div class="header-search">
            <svg class="header-search-icon" width="18" height="18" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              #headerSearch
              type="search"
              class="header-search-input"
              placeholder="Buscar rutinas..."
              aria-label="Buscar rutinas"
              aria-keyshortcuts="/"
              autocomplete="off"
              [value]="search.query()"
              (input)="onSearchInput($event)"
            />
            @if (search.query()) {
              <button
                type="button"
                class="header-search-clear"
                aria-label="Borrar búsqueda"
                (click)="clearSearch()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            } @else {
              <kbd class="header-search-kbd" aria-hidden="true">/</kbd>
            }
          </div>
        }

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

      <!-- Navegación inferior (móvil) / lateral (escritorio) -->
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

        <span class="nav-tagline" aria-hidden="true">Entrena a tu ritmo</span>
      </nav>
    </div>
  `,
    styles: [`
    .app-shell {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }

    /* ── Cabecera ────────────────────────────────── */
    .app-header {
      position: sticky;
      top: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-2) var(--space-3);
      min-height: var(--header-height);
      padding: var(--space-2) var(--space-4);
      background: var(--color-bg-secondary);
      background: color-mix(in srgb, var(--color-bg-secondary) 88%, transparent);
      -webkit-backdrop-filter: blur(14px);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--color-border);
    }

    .app-logo {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      text-decoration: none;
      color: var(--color-text-primary);
      flex: none;
    }
    .app-logo:hover { text-decoration: none; }
    .app-logo-icon {
      width: 32px;
      height: 32px;
      flex: none;
      border-radius: 9px;
      box-shadow: 0 2px 10px rgb(0 0 0 / 28%);
      transition: transform var(--duration-normal) var(--easing-default);
    }
    .app-logo-text {
      font-family: var(--font-brand);
      font-style: italic;
      font-weight: 800;
      font-stretch: 112%;
      font-size: 1.55rem;
      line-height: 1;
      letter-spacing: -0.025em;
      padding-right: 1px;
      transition:
        font-stretch var(--duration-slow) var(--easing-default),
        letter-spacing var(--duration-slow) var(--easing-default);
    }
    .app-logo-beat {
      width: 5px;
      height: 5px;
      margin-left: 1px;
      border-radius: var(--radius-full);
      background: var(--color-accent);
      box-shadow: 0 0 0 3px var(--color-accent-muted);
      animation: brandBeat 2.6s ease-in-out infinite;
      flex: none;
    }
    @keyframes brandBeat {
      0%, 100% { transform: scale(0.85); opacity: 0.75; }
      50%      { transform: scale(1.25); opacity: 1; }
    }
    .app-logo:hover .app-logo-icon {
      transform: scale(1.04) rotate(-3deg);
    }
    .app-logo:hover .app-logo-text {
      font-stretch: 118%;
      letter-spacing: 0.005em;
    }

    /* ── Buscador global (biblioteca) ────────────── */
    .header-search {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex: 1 1 100%;
      order: 3;
      height: 42px;
      padding: 0 var(--space-2) 0 var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-full);
      background: var(--color-surface-2);
      transition:
        border-color var(--duration-normal) var(--easing-default),
        background-color var(--duration-normal) var(--easing-default),
        box-shadow var(--duration-normal) var(--easing-default);
    }
    .header-search:focus-within {
      background: var(--color-surface-1);
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px var(--color-accent-muted);
    }
    .header-search-icon {
      color: var(--color-text-muted);
      flex: none;
    }
    .header-search-input {
      flex: 1;
      min-width: 0;
      height: 100%;
      border: none;
      background: transparent;
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      outline: none;
    }
    .header-search-input::placeholder {
      color: var(--color-text-muted);
    }
    .header-search-input::-webkit-search-cancel-button,
    .header-search-input::-webkit-search-decoration {
      -webkit-appearance: none;
      appearance: none;
    }
    .header-search-clear {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      flex: none;
      border-radius: var(--radius-full);
      color: var(--color-text-secondary);
      transition: background var(--duration-fast), color var(--duration-fast);
    }
    .header-search-clear:hover {
      background: var(--color-surface-3);
      color: var(--color-text-primary);
    }
    .header-search-kbd {
      display: none;
      flex: none;
      min-width: 22px;
      height: 22px;
      padding: 0 5px;
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-sm);
      color: var(--color-text-muted);
      font-family: var(--font-mono);
      font-size: 11px;
      line-height: 20px;
      text-align: center;
    }

    .header-offline-badge {
      margin-left: auto;
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      padding: var(--space-1) var(--space-3);
      background: var(--color-warning);
      color: #1a1a1e;
      border-radius: var(--radius-full);
    }

    /* ── Contenido principal ─────────────────────── */
    .app-main {
      flex: 1;
      overflow-y: auto;
      padding-bottom: calc(var(--nav-height) + env(safe-area-inset-bottom));
    }

    /* ── Navegación inferior (móvil) ─────────────── */
    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: calc(var(--nav-height) + env(safe-area-inset-bottom));
      padding-bottom: env(safe-area-inset-bottom);
      display: flex;
      align-items: stretch;
      justify-content: space-around;
      background: var(--color-bg-secondary);
      border-top: 1px solid var(--color-border);
      z-index: 40;
    }

    .nav-item {
      position: relative;
      display: flex;
      flex: 1;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      padding: var(--space-1) var(--space-2);
      min-height: var(--touch-target);
      color: var(--color-text-muted);
      text-decoration: none;
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      transition:
        color var(--duration-normal) var(--easing-default),
        background-color var(--duration-normal) var(--easing-default);
    }
    .nav-item:hover,
    .nav-item.active {
      color: var(--color-accent);
      text-decoration: none;
    }
    .nav-item.active {
      background: var(--color-accent-muted);
    }

    .nav-tagline {
      display: none;
    }

    /* ── Tablet: navegación inferior centrada ─────── */
    @media (min-width: 640px) and (max-width: 1023px) {
      .bottom-nav {
        justify-content: center;
        gap: var(--space-4);
      }
      .nav-item {
        flex: 0 1 132px;
        border-radius: var(--radius-md) var(--radius-md) 0 0;
      }
    }

    /* ── Escritorio: cabecera + nav lateral ──────── */
    @media (min-width: 1024px) {
      .app-shell {
        display: grid;
        grid-template-columns: 236px 1fr;
        grid-template-rows: var(--header-height) 1fr;
        grid-template-areas:
          "header header"
          "nav    main";
      }

      .app-header {
        grid-area: header;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(220px, 440px) minmax(0, 1fr);
        gap: var(--space-6);
        height: var(--header-height);
        padding: 0 var(--space-6);
      }
      .app-logo {
        justify-self: start;
      }
      .app-logo-text {
        font-size: 1.7rem;
      }
      .header-search {
        order: 0;
        width: 100%;
        height: 38px;
        background: var(--color-surface-2);
      }
      .header-search-kbd {
        display: inline-block;
      }
      .header-offline-badge {
        justify-self: end;
        margin-left: 0;
      }

      .app-main {
        grid-area: main;
        padding-bottom: 0;
      }

      .bottom-nav {
        grid-area: nav;
        position: sticky;
        top: var(--header-height);
        height: calc(100dvh - var(--header-height));
        padding: var(--space-4) var(--space-3);
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        gap: var(--space-1);
        border-top: none;
        border-right: 1px solid var(--color-border);
        overflow-y: auto;
      }
      .nav-item {
        flex: none;
        flex-direction: row;
        justify-content: flex-start;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        font-size: var(--font-size-sm);
        border-radius: var(--radius-md);
      }
      .nav-item.active::before {
        content: '';
        position: absolute;
        left: 4px;
        top: 50%;
        width: 3px;
        height: 18px;
        border-radius: var(--radius-full);
        background: var(--color-accent);
        transform: translateY(-50%);
      }
      .nav-tagline {
        display: block;
        margin-top: auto;
        padding: var(--space-4) var(--space-4) var(--space-2);
        border-top: 1px solid var(--color-border);
        font-family: var(--font-brand);
        font-style: italic;
        font-weight: 500;
        font-size: 0.95rem;
        letter-spacing: 0.01em;
        color: var(--color-text-muted);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .app-logo-beat {
        animation: none;
      }
      .app-logo-text,
      .app-logo-icon {
        transition: none;
      }
    }
  `]
})
export class AppComponent implements OnInit {
  private settingsRepo = inject(SettingsRepository);
  private routineRepo = inject(RoutineRepository);
  private router = inject(Router);
  readonly search = inject(LibrarySearchService);

  @ViewChild('headerSearch') private headerSearch?: ElementRef<HTMLInputElement>;

  isOffline = false;
  readonly isLibrary = signal(false);

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => this.updateRouteContext());
  }

  ngOnInit(): void {
    this.updateRouteContext();
    this.applyTheme();
    this.seedData();
    this.watchOnlineStatus();
  }

  @HostListener('document:keydown', ['$event'])
  handleShortcut(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const isTyping =
      !!target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    const isSearchShortcut =
      event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k');

    if (this.isLibrary() && !isTyping && isSearchShortcut) {
      event.preventDefault();
      this.headerSearch?.nativeElement.focus();
      this.headerSearch?.nativeElement.select();
      return;
    }

    if (event.key === 'Escape' && this.search.query()) {
      this.search.clear();
    }
  }

  onSearchInput(event: Event): void {
    this.search.setQuery((event.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    this.search.clear();
    this.headerSearch?.nativeElement.focus();
  }

  private updateRouteContext(): void {
    const url = this.router.url.split('?')[0];
    this.isLibrary.set(url === '/biblioteca' || url.startsWith('/biblioteca/'));
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
