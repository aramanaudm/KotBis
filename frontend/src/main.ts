import { provideHttpClient } from '@angular/common/http';
import { inject, provideAppInitializer } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  RouteReuseStrategy,
  provideRouter,
  withComponentInputBinding,
  withPreloading,
  PreloadAllModules,
} from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { AUTH_GATEWAY } from './app/core/auth/auth.gateway';
import { AuthService } from './app/core/auth/auth.service';
import { HttpAuthGateway } from './app/core/auth/http-auth.gateway';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    { provide: AUTH_GATEWAY, useExisting: HttpAuthGateway },
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
    provideAppInitializer(() => inject(AuthService).restore()),
  ],
});
