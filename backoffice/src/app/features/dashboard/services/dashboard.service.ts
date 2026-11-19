import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { BusStatus } from '../../buses/models/bus';
import type { AttentionItem, DashboardMetric } from '../models/dashboard';
import { apiError, apiUrl } from '../../../core/services/api';

interface ApiIndicateurs {
  bus_en_service: number;
  zones_actives: number;
  comptes_voyageurs: number;
  signalements_a_verifier: number;
}

interface ApiBusFlotte {
  id: string;
  plaque: string;
  etat: string;
  ligne_code: string | null;
  direction: string | null;
}

interface ApiDashboard {
  success: boolean;
  data: {
    indicateurs: ApiIndicateurs;
    flotte: ApiBusFlotte[];
    avis_a_moderer: number;
    arrets_actifs: number;
    trajets_actifs: number;
  };
}

const ETAT_TO_LABEL: Record<string, string> = {
  actif: 'Actif',
  inactif: 'Inactif',
  en_panne: 'En panne',
};

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly donnees = signal<ApiDashboard['data'] | null>(null);
  private readonly erreur = signal('');

  readonly error = this.erreur.asReadonly();

  load(): void {
    this.http.get<ApiDashboard>(`${apiUrl}/api/admin/dashboard`).subscribe({
      next: (res) => {
        this.erreur.set('');
        this.donnees.set(res.data);
      },
      error: (err) => this.erreur.set(apiError(err)),
    });
  }

  readonly metrics = computed<readonly DashboardMetric[]>(() => {
    const data = this.donnees();
    const indicateurs = data?.indicateurs;
    return [
      {
        label: 'Bus en service',
        value: Number(indicateurs?.bus_en_service ?? 0),
        hint: `${data?.flotte.length ?? 0} bus dans la flotte`,
        icon: 'bus',
        link: '/bus',
      },
      {
        label: 'Zones actives',
        value: Number(indicateurs?.zones_actives ?? 0),
        hint: 'Zones de couverture actives',
        icon: 'zone',
        link: '/zones',
      },
      {
        label: 'Comptes voyageurs',
        value: Number(indicateurs?.comptes_voyageurs ?? 0),
        hint: 'Comptes enregistrés',
        icon: 'users',
        link: '/utilisateurs',
      },
      {
        label: 'Signalements à traiter',
        value: Number(indicateurs?.signalements_a_verifier ?? 0),
        hint: 'En attente de vérification',
        icon: 'flag',
        link: '/signalements',
      },
    ];
  });

  readonly attention = computed<readonly AttentionItem[]>(() => {
    const data = this.donnees();
    const items: AttentionItem[] = [];
    if (data && data.avis_a_moderer > 0) {
      items.push({
        id: 'reviews',
        title: `${data.avis_a_moderer} avis à modérer`,
        subtitle: 'Consultez les contributions',
        icon: 'chat',
        tone: 'orange',
      });
    }
    return items;
  });

  readonly fleet = computed(() =>
    (this.donnees()?.flotte ?? []).map((bus) => ({
      id: bus.id,
      plate: bus.plaque,
      line: bus.ligne_code ?? '—',
      direction: bus.direction ?? '—',
      status: (ETAT_TO_LABEL[bus.etat] ? bus.etat : 'inactif') as BusStatus,
    })),
  );

  readonly activeBusCount = computed(() => Number(this.donnees()?.indicateurs.bus_en_service ?? 0));
  readonly stopCount = computed(() => Number(this.donnees()?.arrets_actifs ?? 0));
  readonly routeCount = computed(() => Number(this.donnees()?.trajets_actifs ?? 0));
}
