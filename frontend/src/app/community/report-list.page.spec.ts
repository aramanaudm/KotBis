import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { COMMUNITY_SESSION } from './community-session';
import type { CommunityUser } from './community-session';
import { ReportListPage } from './report-list.page';
import { describeReportStatus } from './report-status';
import type { BusReport } from './report.model';
import { ReportService } from './report.service';

function rapport(id: string, userId: string, status: string): BusReport {
  return {
    id,
    busId: 'b1',
    busLine: '4A',
    categoryId: 'c1',
    categoryLabel: 'Retard important',
    userId,
    userName: 'Maya974',
    status: status as BusReport['status'],
    createdAt: '2026-11-12T08:00:00Z',
  };
}

describe('BUS-FE-052 — suivi des signalements', () => {
  const session = signal<CommunityUser | null>(null);
  const reports = signal<readonly BusReport[]>([]);

  beforeEach(() => {
    session.set({ id: 'user123', pseudo: 'Maya974' });
    reports.set([]);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: COMMUNITY_SESSION, useValue: session },
        { provide: ReportService, useValue: { reports } },
      ],
    });
  });

  function afficher(): HTMLElement {
    const fixture = TestBed.createComponent(ReportListPage);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('invite un visiteur à se connecter sans afficher de signalement', () => {
    session.set(null);
    reports.set([rapport('1', 'user123', 'A_VERIFIER')]);
    const page = afficher();
    expect(page.querySelector('[role="status"]')?.textContent).toContain('connecté');
    expect(page.querySelectorAll('li')).toHaveLength(0);
  });

  it('affiche un état vide quand le compte n’a aucun signalement', () => {
    const page = afficher();
    expect(page.querySelector('[role="status"]')?.textContent).toContain('aucun signalement');
    expect(page.querySelectorAll('li')).toHaveLength(0);
  });

  it('affiche le statut de chaque signalement du compte', () => {
    reports.set([
      rapport('1', 'user123', 'A_VERIFIER'),
      rapport('2', 'user123', 'CONFIRME'),
      rapport('3', 'user123', 'CLASSE_SANS_SUITE'),
    ]);
    const items = Array.from(afficher().querySelectorAll('li'));
    expect(items).toHaveLength(3);
    expect(items.map((li) => li.querySelector('.status')?.textContent)).toEqual([
      expect.stringContaining('À vérifier'),
      expect.stringContaining('Confirmé'),
      expect.stringContaining('Classé sans suite'),
    ]);
    items.forEach((li) => expect(li.textContent).toContain('Bus 4A'));
  });

  it('n’affiche pas les signalements d’un autre compte', () => {
    reports.set([rapport('1', 'user123', 'A_VERIFIER'), rapport('2', 'user456', 'CONFIRME')]);
    expect(afficher().querySelectorAll('li')).toHaveLength(1);
  });

  it('signale un statut inconnu ou absent comme indisponible', () => {
    reports.set([rapport('1', 'user123', 'INCONNU')]);
    expect(afficher().querySelector('.status')?.textContent).toContain('Statut indisponible');
    expect(describeReportStatus(undefined).label).toBe('Statut indisponible');
    expect(describeReportStatus('constructor').label).toBe('Statut indisponible');
  });

  it('propose un retour vers la carte', () => {
    expect(afficher().querySelector('a[aria-label="Retour à la carte"]')?.getAttribute('href')).toBe('/home');
  });
});