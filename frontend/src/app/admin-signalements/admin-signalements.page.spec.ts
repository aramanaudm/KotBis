import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { AdminSignalementsPage } from './admin-signalements.page';
import { STAFF_ROLE, staffGuard } from './staff.guard';
import type { StaffRole } from './staff.guard';

function executerGuard(role: StaffRole | null): boolean | UrlTree {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: STAFF_ROLE, useValue: signal(role) }],
  });
  return TestBed.runInInjectionContext(
    () => staffGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as boolean | UrlTree,
  );
}

describe('staffGuard', () => {
  it('refuse un visiteur ou un voyageur et redirige vers /home', () => {
    const resultat = executerGuard(null);
    expect(resultat).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(resultat as UrlTree)).toBe('/home');
  });

  it.each<StaffRole>(['administrateur', 'operateur', 'moderateur'])('autorise le rôle %s', (role) => {
    expect(executerGuard(role)).toBe(true);
  });
});

describe('AdminSignalementsPage', () => {
  it('annonce une interface en préparation, sans action de traitement', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(AdminSignalementsPage);
    fixture.detectChanges();
    const page: HTMLElement = fixture.nativeElement;

    expect(page.querySelector('h1')?.textContent).toContain('Administration des signalements');
    expect(page.querySelector('[role="status"]')?.textContent).toContain('en préparation');
    expect(page.querySelectorAll('li')).toHaveLength(3);
    expect(page.querySelector('button')).toBeNull();
  });
});