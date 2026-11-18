import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { COMMUNITY_SESSION } from './community-session';
import type { CommunityUser } from './community-session';
import { ReportService } from './report.service';

describe('SCRUM-64 — enregistrement des signalements', () => {
  const session = signal<CommunityUser | null>(null);
  beforeEach(() => {
    session.set({ id: 'user123', pseudo: 'Maya974' });
    TestBed.configureTestingModule({ providers: [{ provide: COMMUNITY_SESSION, useValue: session }] });
  });

  it('enregistre le bus sélectionné, la session et le statut initial', async () => {
    const service = TestBed.inject(ReportService);
    const report = await service.createReport({ busId: 'b2', categoryId: 'c1' });
    expect(report).toMatchObject({
      busId: 'b2',
      busLine: '12',
      userId: 'user123',
      userName: 'Maya974',
      status: 'A_VERIFIER',
    });
    expect(service.reports()).toEqual([report]);
  });

  it('refuse un visiteur et un bus inconnu', async () => {
    const service = TestBed.inject(ReportService);
    await expect(service.createReport({ busId: 'absent', categoryId: 'c1' })).rejects.toThrow('bus');
    session.set(null);
    await expect(service.createReport({ busId: 'b1', categoryId: 'c1' })).rejects.toThrow('connecté');
    expect(service.reports()).toHaveLength(0);
  });
});
