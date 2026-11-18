import { computed, inject, Injectable } from '@angular/core';
import { BusesService } from '../../buses/services/buses.service';
import { REPORT_TYPE_LABELS } from '../../reports/models/report';
import { ReportsService } from '../../reports/services/reports.service';
import { ReviewsService } from '../../reviews/services/reviews.service';
import { RoutesService } from '../../routes/services/routes.service';
import { StopsService } from '../../stops/services/stops.service';
import { UsersService } from '../../users/services/users.service';
import { ZonesService } from '../../zones/services/zones.service';
import type { AttentionItem, DashboardMetric } from '../models/dashboard';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly buses = inject(BusesService);
  private readonly zones = inject(ZonesService);
  private readonly users = inject(UsersService);
  private readonly reports = inject(ReportsService);
  private readonly reviews = inject(ReviewsService);
  private readonly stops = inject(StopsService);
  private readonly routes = inject(RoutesService);

  readonly fleet = computed(() => this.buses.all().slice(0, 4));
  readonly activeBusCount = computed(
    () => this.buses.all().filter((bus) => bus.status === 'active').length,
  );
  readonly stopCount = this.stops.total;
  readonly routeCount = this.routes.total;

  readonly metrics = computed<readonly DashboardMetric[]>(() => [
    {
      label: 'Bus en service',
      value: this.activeBusCount(),
      hint: `${this.buses.total()} bus dans la flotte`,
      icon: 'bus',
      link: '/bus',
    },
    {
      label: 'Zones actives',
      value: this.zones.active().length,
      hint: `${this.zones.total()} zones configurées`,
      icon: 'zone',
      link: '/zones',
    },
    {
      label: 'Utilisateurs',
      value: this.users.total(),
      hint: 'Comptes enregistrés',
      icon: 'users',
      link: '/utilisateurs',
    },
    {
      label: 'Signalements à traiter',
      value: this.reports.pending().length,
      hint: 'En attente de vérification',
      icon: 'flag',
      link: '/signalements',
    },
  ]);

  readonly attention = computed<readonly AttentionItem[]>(() => {
    const items: AttentionItem[] = this.reports
      .pending()
      .slice(0, 2)
      .map((report) => ({
        id: report.id,
        title: report.bus,
        subtitle: `${REPORT_TYPE_LABELS[report.type]} · ${report.date}`,
        icon: 'flag',
        tone: report.type === 'breakdown' ? 'red' : 'orange',
      }));

    const pendingReviews = this.reviews.pending().length;

    if (pendingReviews > 0) {
      items.push({
        id: 'reviews',
        title: `${pendingReviews} avis à modérer`,
        subtitle: 'Consultez les contributions',
        icon: 'chat',
        tone: 'orange',
      });
    }

    return items;
  });
}
