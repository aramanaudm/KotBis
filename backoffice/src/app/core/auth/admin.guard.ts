import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';

import { environment } from '../../../environments/environment';
import { SessionService } from './session.service';

export const adminGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  if (session.isAdmin()) return true;
  window.location.assign(environment.frontendUrl);
  return false;
};
