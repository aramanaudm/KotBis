import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FavorisPage } from './favoris.page';

describe('FavorisPage', () => {
  beforeEach(() => {
    localStorage.removeItem('kotbis.favoris');
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => localStorage.removeItem('kotbis.favoris'));

  it('affiche l’état vide et un lien direct vers l’accueil', () => {
    const fixture = TestBed.createComponent(FavorisPage);
    const page: HTMLElement = fixture.nativeElement;

    fixture.detectChanges();
    expect(page.querySelector('h2')?.textContent).toContain('Aucun favori enregistré');

    expect(page.querySelector('.topbar a')?.getAttribute('href')).toBe('/home');
  });

  it('enregistre le trajet une seule fois et le retrouve à la réouverture', () => {
    const fixture = TestBed.createComponent(FavorisPage);
    const page: HTMLElement = fixture.nativeElement;
    fixture.detectChanges();

    const ajouter = page.querySelector<HTMLButtonElement>('button.action')!;
    ajouter.click();
    ajouter.click();
    fixture.detectChanges();

    expect(page.querySelector('.feedback')?.textContent).toContain('Trajet enregistré');
    expect(page.querySelectorAll('ul[aria-label] li')).toHaveLength(1);
    expect(localStorage.getItem('kotbis.favoris')).toBe('[1]');
    fixture.destroy();

    const favoris = TestBed.createComponent(FavorisPage);
    favoris.detectChanges();
    const liste: HTMLElement = favoris.nativeElement;
    expect(liste.querySelectorAll('ul[aria-label] li')).toHaveLength(1);
  });

  it('affiche une erreur si le stockage refuse l’enregistrement', () => {
    const stockage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Stockage indisponible');
    });
    try {
      const fixture = TestBed.createComponent(FavorisPage);
      const page: HTMLElement = fixture.nativeElement;
      fixture.detectChanges();
      page.querySelector<HTMLButtonElement>('button.action')!.click();
      fixture.detectChanges();

      expect(page.querySelector('.feedback-error')?.textContent).toContain('Impossible d’enregistrer');
      expect(fixture.componentInstance.favoris()).toHaveLength(0);
    } finally {
      stockage.mockRestore();
    }
  });
});
