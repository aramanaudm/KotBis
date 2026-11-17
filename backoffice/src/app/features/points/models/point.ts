export interface PointMovement {
  readonly id: string;
  readonly userId: string;
  readonly userName: string;
  readonly variation: number;
  readonly reason: string;
  readonly date: string;
}

export interface UserBalance {
  readonly id: string;
  readonly pseudo: string;
  readonly email: string;
  readonly points: number;
}
