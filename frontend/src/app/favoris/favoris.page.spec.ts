import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FavorisPage } from './favoris.page';

describe('FavorisPage', () => {
  beforeEach(() => {
    localStorage.removeItem('kotbis.favoris');
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => localStorage.removeItem('kotbis.favoris'));

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

  it('retire uniquement le favori choisi et conserve la suppression à la réouverture', () => {
    localStorage.setItem('kotbis.favoris', '[1,2]');
    const fixture = TestBed.createComponent(FavorisPage);
    const page: HTMLElement = fixture.nativeElement;
    fixture.detectChanges();
    const [premier] = page.querySelectorAll<HTMLButtonElement>('li button');

    premier.click();
    fixture.detectChanges();
    expect(page.querySelectorAll('li')).toHaveLength(1);
    expect(page.querySelector('li')?.textContent).toContain('Rose-Hill');
    expect(localStorage.getItem('kotbis.favoris')).toBe('[2]');
    fixture.destroy();

    const nouvellePage = TestBed.createComponent(FavorisPage);
    const liste: HTMLElement = nouvellePage.nativeElement;
    nouvellePage.detectChanges();
    expect(liste.querySelectorAll('li')).toHaveLength(1);
    const [dernier] = liste.querySelectorAll<HTMLButtonElement>('li button');
    dernier.click();
    nouvellePage.detectChanges();
    expect(liste.querySelector('h2')?.textContent).toContain('Aucun favori enregistré');
  });
});
