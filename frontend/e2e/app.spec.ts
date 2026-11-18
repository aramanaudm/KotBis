import { expect, test } from '@playwright/test';

test('accède aux états de notification depuis les favoris', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Favoris', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Gérer les alertes' }).click();
  await expect(page.getByRole('heading', { name: 'Gestion des alertes' })).toBeVisible();
  await page.getByText('Voir les exemples d’états').click();
  await expect(page.getByText('Notification programmée', { exact: true })).toBeVisible();
});
