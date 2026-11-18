import { Component, computed, inject, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { SessionService } from '../../core/auth/session.service';
import { ThemeService } from '../../core/theme/theme.service';
import { Icon } from '../../shared/components/icon/icon';
import { NAV_ITEMS } from '../navigation';

@Component({
  selector: 'app-header',
  imports: [Icon],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly router = inject(Router);

  protected readonly session = inject(SessionService);
  protected readonly theme = inject(ThemeService);

  readonly menuToggle = output<void>();

  protected readonly language = signal<'fr' | 'en'>('fr');

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

    return item?.label ?? 'Tableau de bord';
  });

  protected setLanguage(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    if (value === 'fr' || value === 'en') {
      this.language.set(value);
    }
  }
}
