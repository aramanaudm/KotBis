import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';

describe('Accueil KotBis et navigation après intégration', () => {
  // L'accueil lit le compte connecté (AuthService), qui dépend désormais de l'API.
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }),
  );

  it('conserve le partage de position et les deux accès communautaires sur la carte', async () => {
    const harness = await RouterTestingHarness.create('/home');
    const page = harness.routeNativeElement!;
    expect(page.textContent).toContain('KotBis');
    expect(page.querySelector('app-partage-position')).not.toBeNull();
    expect(page.querySelector('a[href="/home/avis"]')?.textContent).toContain('Les avis');
    expect(page.querySelector('a[href="/home/signaler"]')?.textContent).toContain('Signaler un bus');
    expect(page.querySelector('[aria-label="Ouvrir mon espace"]')).not.toBeNull();
  });

  it('ouvre les avis et le signalement au-dessus de la même carte', async () => {
    const harness = await RouterTestingHarness.create('/home');
    const map = harness.routeNativeElement!.querySelector('.map');
    await harness.navigateByUrl('/home/avis');
    expect(harness.routeNativeElement!.querySelector('dialog h1')?.textContent).toContain('Les avis');
    expect(harness.routeNativeElement!.querySelector('.map')).toBe(map);
    await harness.navigateByUrl('/home/signaler');
    expect(harness.routeNativeElement!.querySelector('dialog h1')?.textContent).toContain('Signaler un bus');
    expect(harness.routeNativeElement!.querySelector('.map')).toBe(map);
  });

  it('ouvre le formulaire et son compteur de 600 caractères depuis la route des avis', async () => {
    const harness = await RouterTestingHarness.create('/home/avis/nouveau');
    expect(harness.routeNativeElement!.textContent).toContain('600 caractères maximum');
    expect(harness.routeNativeElement!.querySelector('textarea')?.getAttribute('maxlength')).toBe('600');
  });
});
