import type { IconName } from '../shared/components/icon/icon';

export interface NavItem {
  readonly label: string;
  readonly route: string;
  readonly icon: IconName;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Tableau de bord', route: '/tableau-de-bord', icon: 'grid' },
  { label: 'Bus', route: '/bus', icon: 'bus' },
  { label: 'Arrêts', route: '/arrets', icon: 'pin' },
  { label: 'Trajets', route: '/trajets', icon: 'route' },
  { label: 'Zones', route: '/zones', icon: 'zone' },
  { label: 'Personnel', route: '/personnel', icon: 'users' },
  { label: 'Utilisateurs', route: '/utilisateurs', icon: 'users' },
  { label: 'Signalements', route: '/signalements', icon: 'flag' },
  { label: 'Avis', route: '/avis', icon: 'chat' },
  { label: 'Points', route: '/points', icon: 'points' },
];
