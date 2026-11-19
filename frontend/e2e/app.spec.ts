import { expect, test } from '@playwright/test';

test('gère les favoris depuis l’accueil sans navigation intermédiaire', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole('link', { name: 'Favoris', exact: true }).click();
  await expect(page).toHaveURL(/\/favoris$/);
  await page.getByRole('button', { name: /Ajouter aux favoris le trajet de Port-Louis/ }).click();
  const favoris = page.getByRole('list', { name: 'Trajets favoris enregistrés' });
  await expect(favoris).toContainText('Port-Louis → Curepipe');
  await expect(page).toHaveURL(/\/favoris$/);

  await page.reload();
  await expect(favoris).toContainText('Port-Louis → Curepipe');
  await favoris.getByRole('button', { name: /Retirer le trajet de Port-Louis/ }).click();
  await expect(page.getByRole('heading', { name: 'Aucun favori enregistré' })).toBeVisible();
  await expect(page).toHaveURL(/\/favoris$/);

  await page.getByRole('link', { name: 'Retour à l’accueil' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/home$/);
});
