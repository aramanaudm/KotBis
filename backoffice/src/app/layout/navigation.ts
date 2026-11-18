import type { IconName } from '../shared/components/icon/icon';

export interface NavItem {
  readonly label: string;
  readonly route: string;
  readonly icon: IconName;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'nav.dashboard', route: '/tableau-de-bord', icon: 'grid' },
  { label: 'nav.buses', route: '/bus', icon: 'bus' },
  { label: 'nav.stops', route: '/arrets', icon: 'pin' },
  { label: 'nav.routes', route: '/trajets', icon: 'route' },
  { label: 'nav.zones', route: '/zones', icon: 'zone' },
  { label: 'nav.staff', route: '/personnel', icon: 'users' },
  { label: 'nav.users', route: '/utilisateurs', icon: 'users' },
  { label: 'nav.reports', route: '/signalements', icon: 'flag' },
  { label: 'nav.reviews', route: '/avis', icon: 'chat' },
  { label: 'nav.points', route: '/points', icon: 'points' },
];
