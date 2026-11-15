import type { IconName } from '../../../shared/components/icon/icon';
import type { StatusTone } from '../../../shared/models/status';

export interface DashboardMetric {
  readonly label: string;
  readonly value: number;
  readonly hint: string;
  readonly icon: IconName;
  readonly link: string;
}

export interface AttentionItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: IconName;
  readonly tone: StatusTone;
}
