import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ToastController } from '@ionic/angular';

import { ADMIN_ACCESS_DENIED_MESSAGE, adminAccessGuard } from './admin-access.guard';

@Component({ template: 'accueil' })
class FakeHomePage {}

describe('BUS-FE-053 — administration des signalements inaccessible aux voyageurs', () => {
  const present = vi.fn().mockResolvedValue(undefined);
  const create = vi.fn().mockResolvedValue({ present });

  beforeEach(() => {
    present.mockClear();
    create.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'admin', canMatch: [adminAccessGuard], children: [] },
          { path: 'home', component: FakeHomePage },
        ]),
        { provide: ToastController, useValue: { create } },
      ],
    });
  });

  it.each(['/admin', '/admin/reports', '/admin/reports/42/status'])(
    'redirige %s vers l’accueil avec un message de refus',
    async (url) => {
      const router = TestBed.inject(Router);
      await router.navigateByUrl(url);

      expect(router.url).toBe('/home');
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ message: ADMIN_ACCESS_DENIED_MESSAGE }));
      expect(present).toHaveBeenCalled();
    },
  );
});