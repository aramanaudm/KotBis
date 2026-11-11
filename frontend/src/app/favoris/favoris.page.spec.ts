import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { FavorisPage } from './favoris.page';

describe('FavorisPage', () => {
  it('affiche les deux états et retire les trajets de la liste', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
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
});
