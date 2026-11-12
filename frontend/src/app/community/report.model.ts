export interface BusReport {
  readonly id: string;
  readonly busId: string;
  readonly busLine: string;
  readonly userId: string;
  readonly userName: string;
  readonly status: 'A_VERIFIER';
  readonly createdAt: string;
}
