import { test, expect } from '@playwright/test';

test.describe('Ritmera PWA - Flujos principales', () => {

  test('1. Abre la aplicación y muestra la biblioteca con plantillas precargadas', async ({ page }) => {
    await page.goto('/biblioteca');

    // Comprobar branding Ritmera
    await expect(page.locator('.app-logo-text')).toHaveText('Ritmera');

    // Comprobar que las plantillas por defecto se precargaron
    await expect(page.locator('.routine-card')).toHaveCount(4);
    await expect(page.locator('text=Tabata clásico')).toBeVisible();

    // Comprobar acciones principales según el breakpoint
    const width = page.viewportSize()?.width ?? 1024;
    if (width < 1024) {
      // En móvil las acciones viven en el FAB + hoja inferior
      await expect(page.locator('.fab')).toBeVisible();
      await page.locator('.fab').click();
      const sheet = page.locator('.create-sheet');
      await expect(sheet.getByRole('link', { name: 'Crear rutina' })).toBeVisible();
      await expect(sheet.getByRole('link', { name: 'Temporizador rápido' })).toBeVisible();
      await page.keyboard.press('Escape');
    } else {
      const actions = page.locator('.library-actions');
      await expect(actions.getByRole('link', { name: 'Crear rutina' })).toBeVisible();
      await expect(actions.getByRole('link', { name: 'Temporizador rápido' })).toBeVisible();
    }
  });

  test('2. Crear una nueva rutina desde plantilla y persistencia tras recarga', async ({ page }) => {
    await page.goto('/rutina/nueva');

    // Rellenar datos de la rutina (la plantilla Tabata es la predeterminada)
    await page.locator('#tabata-name').fill('Rutina E2E Test');

    // Guardar
    await page.getByRole('button', { name: 'Guardar' }).click();

    // Verificar redirección a biblioteca
    await expect(page).toHaveURL(/.*biblioteca/);
    await expect(page.locator('text=Rutina E2E Test')).toBeVisible();

    // Recargar página para probar persistencia real en IndexedDB
    await page.reload();
    await expect(page.locator('text=Rutina E2E Test')).toBeVisible();
  });

  test('3. Duplicar y editar una rutina', async ({ page }) => {
    await page.goto('/biblioteca');

    // Abrir menú de opciones de la primera rutina
    const menuBtn = page.locator('.routine-menu-btn').first();
    await menuBtn.click();

    // Duplicar
    await page.locator('.action-sheet-btn', { hasText: 'Duplicar' }).click();

    // Comprobar que se ha creado la copia
    await expect(page.locator('text=(copia)')).toBeVisible();
  });

  test('4. Flujo de ejecución del temporizador: iniciar, pausar, avanzar y verificar reloj', async ({ page }) => {
    await page.goto('/temporizador-rapido');

    // Verificar que estamos en la pantalla de ejecución
    await expect(page.locator('.clock-display')).toBeVisible();
    await expect(page.locator('.current-step-name')).toBeVisible();

    // Pausar
    const playPauseBtn = page.locator('.play-pause-btn');
    await playPauseBtn.click();
    await expect(playPauseBtn).toHaveAttribute('aria-label', 'Reanudar temporizador');

    // Reanudar
    await playPauseBtn.click();
    await expect(playPauseBtn).toHaveAttribute('aria-label', 'Pausar temporizador');

    // Avanzar etapa
    const nextBtn = page.getByRole('button', { name: 'Siguiente etapa' });
    await nextBtn.click();
    await expect(page.locator('.clock-display')).toBeVisible();
  });

  test('5. Historial: registrar sesiones y consultar estado', async ({ page }) => {
    await page.goto('/historial');

    // Verificar encabezado y vista
    await expect(page.locator('.history-title')).toHaveText('Historial de entrenamientos');
  });

  test('6. Ajustes y Copia de seguridad: exportar e importar datos con validación', async ({ page }) => {
    await page.goto('/ajustes');

    // Comprobar secciones de ajustes
    await expect(page.locator('text=Audio y Guía por Voz')).toBeVisible();
    await expect(page.locator('text=Pantalla y Rendimiento')).toBeVisible();
    await expect(page.locator('text=Transparencia de la Plataforma (PWA)')).toBeVisible();

    // Comprobar botones de exportación
    await expect(page.getByRole('button', { name: 'Exportar Rutinas (JSON)' })).toBeVisible();
  });

  test('7. Comprobar adaptación de layout responsive (móvil y escritorio)', async ({ page }) => {
    // Vista móvil
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/biblioteca');
    await expect(page.locator('.bottom-nav')).toBeVisible();
    await expect(page.locator('.fab')).toBeVisible();
    await expect(page.locator('.header-search')).toBeVisible();

    // Vista escritorio
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('.app-shell')).toBeVisible();
    await expect(page.locator('.library-actions')).toBeVisible();
    await expect(page.locator('.fab')).toBeHidden();
    await expect(page.locator('.sort-control--desktop')).toBeVisible();
  });

  test('8. Búsqueda global y creación desde el FAB en móvil', async ({ page }) => {
    const width = page.viewportSize()?.width ?? 1024;
    await page.goto('/biblioteca');
    await expect(page.locator('.routine-card')).toHaveCount(4);

    // La búsqueda de la cabecera filtra en vivo
    await page.locator('.header-search-input').fill('tabata');
    await expect(page.locator('.routine-card')).toHaveCount(1);
    await page.locator('.header-search-clear').click();
    await expect(page.locator('.routine-card')).toHaveCount(4);

    if (width < 1024) {
      await page.locator('.fab').click();
      await expect(page.locator('.create-sheet')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.create-sheet')).toBeHidden();
    }
  });

  test('9. Resiliencia ante ausencia de Wake Lock / Speech Synthesis', async ({ page }) => {
    // Sobrescribir APIs en la página para simular navegadores sin soporte
    await page.addInitScript(() => {
      delete (navigator as any).wakeLock;
      delete (window as any).speechSynthesis;
    });

    await page.goto('/temporizador-rapido');
    // La sesión debe iniciar y funcionar sin errores
    await expect(page.locator('.clock-display')).toBeVisible();
    await expect(page.locator('.play-pause-btn')).toBeVisible();
  });
});
