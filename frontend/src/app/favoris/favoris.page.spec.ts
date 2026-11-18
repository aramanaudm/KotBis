import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ModalController, ToastController } from '@ionic/angular';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_COUNTERS } from '../core/auth/auth.models';
import { AuthService } from '../core/auth/auth.service';
import { MonEspacePage } from '../pages/mon-espace/mon-espace.page';

import { FavorisPage } from './favoris.page';

describe('FavorisPage', () => {
  beforeEach(() => {
    localStorage.removeItem('kotbis.favoris');
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => localStorage.removeItem('kotbis.favoris'));

  it('affiche dans Mon espace le nombre de favoris déjà enregistrés et le met à jour', () => {
    localStorage.setItem('kotbis.favoris', '[1]');
    TestBed.configureTestingModule({
      providers: [
        { provide: ModalController, useValue: {} },
        { provide: ToastController, useValue: {} },
      ],
    });
    TestBed.overrideProvider(AuthService, {
      useValue: { user: () => ({ pseudo: 'Compte test', email: 'test@example.com', counters: EMPTY_COUNTERS }) },
    });
    const profil = TestBed.createComponent(MonEspacePage);
    const espace: HTMLElement = profil.nativeElement;
    profil.detectChanges();
    const compteur = espace.querySelector('.is-account li small');
    expect(compteur?.textContent?.trim()).toBe('1 enregistré');

    const favoris = TestBed.createComponent(FavorisPage);
    const page: HTMLElement = favoris.nativeElement;
    favoris.detectChanges();
    page.querySelector<HTMLButtonElement>('.remove')!.click();
    profil.detectChanges();
    expect(compteur?.textContent?.trim()).toBe('0 enregistré');

    favoris.detectChanges();
    page.querySelector<HTMLButtonElement>('button.action')!.click();
    profil.detectChanges();
    expect(compteur?.textContent?.trim()).toBe('1 enregistré');
  });

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

  it('retire le trajet visé et conserve la suppression à la réouverture', () => {
    localStorage.setItem('kotbis.favoris', '[1,2]');
    const fixture = TestBed.createComponent(FavorisPage);
    const page: HTMLElement = fixture.nativeElement;
    fixture.detectChanges();

    page.querySelector<HTMLButtonElement>('.remove')!.click();
    fixture.detectChanges();
    expect(page.querySelector('ul[aria-label]')?.textContent).toContain('Rose-Hill');
    expect(page.querySelectorAll('ul[aria-label] li')).toHaveLength(1);
    expect(localStorage.getItem('kotbis.favoris')).toBe('[2]');
    fixture.destroy();

    const nouvellePage = TestBed.createComponent(FavorisPage);
    const liste: HTMLElement = nouvellePage.nativeElement;
    nouvellePage.detectChanges();
    expect(liste.querySelectorAll('ul[aria-label] li')).toHaveLength(1);
    liste.querySelector<HTMLButtonElement>('.remove')!.click();
    nouvellePage.detectChanges();
    expect(liste.querySelector('#titre-vide')?.textContent).toContain('Aucun favori enregistré');
  });
});
