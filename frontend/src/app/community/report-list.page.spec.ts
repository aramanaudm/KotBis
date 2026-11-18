import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { COMMUNITY_SESSION } from './community-session';
import type { CommunityUser } from './community-session';
import { ReportListPage } from './report-list.page';
import type { BusReport, ReportStatus } from './report.model';
import { ReportService } from './report.service';

function report(id: string, status: ReportStatus, createdAt: string, userId = 'user123'): BusReport {
  return {
    id,
    busId: 'b1',
    busLine: '4A',
    categoryId: 'c1',
    categoryLabel: 'Retard important',
    userId,
    userName: 'Maya974',
    status,
    createdAt,
  };
}

describe('SCRUM-67 — suivi de mes signalements', () => {
  const session = signal<CommunityUser | null>(null);

  beforeEach(() => {
    session.set({ id: 'user123', pseudo: 'Maya974' });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: COMMUNITY_SESSION, useValue: session }],
    });
  });

  function render(reports: readonly BusReport[] = []): HTMLElement {
    TestBed.overrideProvider(ReportService, { useValue: { myReports: signal(reports) } });
    const fixture = TestBed.createComponent(ReportListPage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('invite un visiteur à se connecter, sans liste', () => {
    session.set(null);
    const page = render();
    expect(page.textContent).toContain('Connectez-vous pour suivre vos signalements.');
    expect(page.querySelector('ul')).toBeNull();
  });

  it('affiche un état vide explicite', () => {
    const page = render();
    expect(page.textContent).toContain("Vous n'avez envoyé aucun signalement pour le moment.");
  });

  it('affiche le statut de chaque signalement en texte, pas seulement en couleur', () => {
    const page = render([
      report('r1', 'A_VERIFIER', '2026-11-18T10:00:00.000Z'),
      report('r2', 'CONFIRME', '2026-11-17T10:00:00.000Z'),
      report('r3', 'REJETE', '2026-11-16T10:00:00.000Z'),
      report('r4', 'CLOTURE', '2026-11-15T10:00:00.000Z'),
    ]);
    const statuses = Array.from(page.querySelectorAll('.community-status'), (el) => el.textContent?.trim());
    expect(statuses).toEqual([
      expect.stringContaining('Statut : À vérifier'),
      expect.stringContaining('Statut : Confirmé'),
      expect.stringContaining('Statut : Rejeté'),
      expect.stringContaining('Statut : Clôturé'),
    ]);
    expect(page.textContent).toContain('Bus 4A');
    expect(page.textContent).toContain('Retard important');
    expect(page.textContent).toContain('Envoyé le 18/11/2026 14:00');
  });

  it('affiche « À vérifier » pour un statut inconnu, jamais « Confirmé »', () => {
    const page = render([report('r1', 'INCONNU' as ReportStatus, '2026-11-18T10:00:00.000Z')]);
    expect(page.querySelector('.community-status')?.textContent).toContain('À vérifier');
  });
});

describe('SCRUM-67 — ReportService.myReports', () => {
  const session = signal<CommunityUser | null>(null);

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: COMMUNITY_SESSION, useValue: session }] });
  });

  it('ne montre que les signalements du compte connecté, du plus récent au plus ancien', async () => {
    const service = TestBed.inject(ReportService);
    session.set({ id: 'user123', pseudo: 'Maya974' });
    const first = await service.createReport({ busId: 'b1', categoryId: 'c1' });
    session.set({ id: 'other', pseudo: 'Kevin' });
    await service.createReport({ busId: 'b2', categoryId: 'c2' });
    session.set({ id: 'user123', pseudo: 'Maya974' });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await service.createReport({ busId: 'b2', categoryId: 'c3' });

    expect(service.myReports().map((r) => r.id)).toEqual([second.id, first.id]);
    expect(service.myReports().every((r) => r.status === 'A_VERIFIER')).toBe(true);

    session.set(null);
    expect(service.myReports()).toEqual([]);
  });
});