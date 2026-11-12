export interface Review {
  readonly id: string;
  readonly busId: string;
  readonly busLine: string;
  readonly userId: string;
  readonly userName: string;
  readonly text: string;
  readonly createdAt: string;
  readonly updatedAt?: string;
}
