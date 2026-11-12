import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { COMMUNITY_SESSION } from './community-session';
import type { CommunityUser } from './community-session';
import { ReportFormPage } from './report-form.page';
import { ReportService } from './report.service';

describe('SCRUM-64 — formulaire de signalement', () => {
  const session = signal<CommunityUser | null>(null);
  beforeEach(() => {
    session.set({ id: 'user123', pseudo: 'Maya974' });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: COMMUNITY_SESSION, useValue: session }],
    });
  });

  it('bloque les visiteurs et propose une sortie vers la carte', () => {
    session.set(null);
    const fixture = TestBed.createComponent(ReportFormPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('a[aria-label="Retour"]').getAttribute('href')).toBe('/home');
  });

  it('affiche une erreur si aucun bus n’est sélectionné', async () => {
    const fixture = TestBed.createComponent(ReportFormPage);
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#report-bus-error').textContent).toContain('Sélectionnez un bus.');
    expect(TestBed.inject(ReportService).reports()).toHaveLength(0);
  });

  it('enregistre une seule fois et affiche le reçu', async () => {
    const fixture = TestBed.createComponent(ReportFormPage);
    const page = fixture.componentInstance;
    page.form.setValue({ busId: 'b1' });
    await Promise.all([page.submit(), page.submit()]);
    fixture.detectChanges();
    expect(TestBed.inject(ReportService).reports()).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Statut : À vérifier');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    page.startAgain();
    expect(page.form.controls.busId.value).toBe('');
    expect(page.receipt()).toBeNull();
  });

  it('conserve la sélection lors d’une erreur', async () => {
    const fixture = TestBed.createComponent(ReportFormPage);
    const page = fixture.componentInstance;
    page.form.setValue({ busId: 'b1' });
    vi.spyOn(TestBed.inject(ReportService), 'createReport').mockRejectedValue(new Error('Indisponible'));
    await page.submit();
    expect(page.form.controls.busId.value).toBe('b1');
    expect(page.error()).toBe('Indisponible');
    expect(page.busy()).toBe(false);
  });
});
