import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AlertesPage } from './alertes.page';

describe('AlertesPage', () => {
  it('valide la création et conserve l’état lors d’une modification', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(AlertesPage);
    const page: HTMLElement = fixture.nativeElement;
    fixture.detectChanges();

    const formulaire = page.querySelector<HTMLFormElement>('form')!;
    const dialogue = page.querySelector<HTMLDialogElement>('dialog')!;
    // jsdom ne fournit pas les méthodes natives de la boîte de dialogue.
    dialogue.showModal = () => {
      dialogue.open = true;
    };
    dialogue.close = () => {
      dialogue.open = false;
    };
    const destination = page.querySelector<HTMLSelectElement>('#destination-alerte')!;
    const heure = page.querySelector<HTMLInputElement>('#heure-alerte')!;
    const repetition = page.querySelector<HTMLSelectElement>('#repetition-alerte')!;
    page.querySelector<HTMLButtonElement>('button.primary')!.click();
    expect(dialogue.open).toBe(true);

    formulaire.requestSubmit();
    expect(fixture.componentInstance.alertes()).toHaveLength(2);

    destination.value = 'Rose Hill';
    heure.value = '07:30';
    repetition.value = 'Lundi à vendredi';
    for (const champ of [destination, heure, repetition]) {
      const valeur = champ.value;
      champ.value = '';
      expect(champ.validity.valueMissing).toBe(true);
      formulaire.requestSubmit();
      expect(fixture.componentInstance.alertes()).toHaveLength(2);
      champ.value = valeur;
    }

    formulaire.requestSubmit();
    fixture.detectChanges();
    expect(dialogue.open).toBe(false);
    const alerte = page.querySelector('li:last-child');
    expect(alerte?.textContent).toContain('Rose Hill');
    expect(alerte?.textContent).toContain('07:30 · Lundi à vendredi');
    expect(alerte?.querySelector('.etat')?.textContent?.trim()).toBe('Active');
    expect(page.querySelector('[role="status"]')?.textContent).toContain('Aucune notification programmée');
    const exemples = page.querySelector('.notifications details');
    expect(exemples?.querySelector('summary')?.textContent).toContain('Voir les exemples d’états');
    expect(Array.from(exemples?.querySelectorAll('dt') ?? [], (etat) => etat.textContent)).toEqual([
      'Alerte enregistrée',
      'Notification programmée',
      'Échec d’envoi',
    ]);
    const detail = alerte?.querySelector('details');
    detail?.querySelector('summary')?.click();
    expect(detail?.open).toBe(true);
    expect(detail?.textContent).toContain('Non programmée');
    expect(detail?.querySelector('.etat')?.textContent?.trim()).toBe('Active');

    const [modifier, changerEtat] = page.querySelectorAll<HTMLButtonElement>('li:last-child .actions button');
    changerEtat.click();
    fixture.detectChanges();
    expect(alerte?.querySelector('.etat')?.textContent?.trim()).toBe('Inactive');
    expect(detail?.querySelector('.etat')?.textContent?.trim()).toBe('Inactive');

    modifier.click();
    expect(destination.value).toBe('Rose Hill');
    expect(heure.value).toBe('07:30');
    expect(repetition.value).toBe('Lundi à vendredi');
    heure.value = '08:15';
    formulaire.requestSubmit();
    fixture.detectChanges();
    expect(fixture.componentInstance.alertes()).toHaveLength(3);
    expect(alerte?.textContent).toContain('08:15 · Lundi à vendredi');
    expect(alerte?.querySelector('.etat')?.textContent?.trim()).toBe('Inactive');

    changerEtat.click();
    fixture.detectChanges();
    expect(alerte?.querySelector('.etat')?.textContent?.trim()).toBe('Active');
    expect(detail?.querySelector('.etat')?.textContent?.trim()).toBe('Active');
  });
});
