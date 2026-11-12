import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FavorisPage } from './favoris.page';

describe('FavorisPage', () => {
  beforeEach(() => {
    localStorage.removeItem('kotbis.favoris');
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('affiche les deux états et retire les trajets de la liste', () => {
    const fixture = TestBed.createComponent(FavorisPage);
    const page: HTMLElement = fixture.nativeElement;

    fixture.detectChanges();
    expect(page.querySelector('h2')?.textContent).toContain('Aucun favori enregistré');

    fixture.componentRef.setInput('etat', 'liste');
    fixture.detectChanges();
    expect(page.querySelectorAll('li')).toHaveLength(2);

    page.querySelectorAll<HTMLButtonElement>('li button').forEach((button) => button.click());
    fixture.detectChanges();
    expect(page.querySelectorAll('li')).toHaveLength(0);
    expect(page.querySelector('h2')?.textContent).toContain('Aucun favori enregistré');
  });

  it('enregistre le trajet une seule fois et le retrouve à la réouverture', () => {
    const fixture = TestBed.createComponent(FavorisPage);
    const page: HTMLElement = fixture.nativeElement;
    fixture.componentRef.setInput('vue', 'recherche');
    fixture.componentRef.setInput('trajet', '1');
    fixture.detectChanges();

    const ajouter = page.querySelector<HTMLButtonElement>('button.action')!;
    ajouter.click();
    ajouter.click();
    fixture.detectChanges();

    expect(page.querySelector('.feedback')?.textContent).toContain('Trajet enregistré');
    expect(localStorage.getItem('kotbis.favoris')).toBe('[1]');
    fixture.destroy();

    const favoris = TestBed.createComponent(FavorisPage);
    favoris.detectChanges();
    const liste: HTMLElement = favoris.nativeElement;
    expect(liste.querySelectorAll('li')).toHaveLength(1);
  });

  it('affiche une erreur si le stockage refuse l’enregistrement', () => {
    const stockage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Stockage indisponible');
    });
    try {
      const fixture = TestBed.createComponent(FavorisPage);
      const page: HTMLElement = fixture.nativeElement;
      fixture.componentRef.setInput('vue', 'recherche');
      fixture.componentRef.setInput('trajet', '1');
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
