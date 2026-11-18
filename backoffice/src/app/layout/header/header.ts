import { Component, computed, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { SessionService } from '../../core/auth/session.service';
import { LanguageService, type Language } from '../../core/i18n/language.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ThemeService } from '../../core/theme/theme.service';
import { Icon } from '../../shared/components/icon/icon';
import { NAV_ITEMS } from '../navigation';

@Component({
  selector: 'app-header',
  imports: [Icon, TranslatePipe],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly router = inject(Router);

  protected readonly session = inject(SessionService);
  protected readonly theme = inject(ThemeService);
  protected readonly i18n = inject(LanguageService);

  readonly menuToggle = output<void>();

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly pageTitle = computed(() => {
    const url = this.currentUrl();
    const item = NAV_ITEMS.find(
      (navItem) => url === navItem.route || url.startsWith(`${navItem.route}/`),
    );

    return item?.label ?? 'nav.dashboard';
  });

  protected setLanguage(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    if (value === 'fr' || value === 'en') {
      this.i18n.set(value as Language);
    }
  }
}
