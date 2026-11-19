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
    protected readonly accountView = signal<'profile' | 'security'>('profile');

  // Données de démonstration de la maquette Figma.
  protected readonly profileName = signal('Anaïs David');
  protected readonly profileEmail = signal('anais.david@kotbis.mu');

  protected readonly roleLabels = {
    administrateur: 'Administrateur',
    operateur: 'Opérateur',
    moderateur: 'Modérateur',
  };

  protected readonly accountMessage = signal('');

  protected openAccount(
    view: 'profile' | 'security',
    menu: HTMLElement,
    panel: HTMLDialogElement,
  ): void {
    menu.hidePopover();
    this.accountMessage.set('');
    this.accountView.set(view);
    panel.showModal();
  }

  protected saveProfile(name: HTMLInputElement, email: HTMLInputElement): void {
    const fullName = name.value.trim();
    name.setCustomValidity(fullName ? '' : 'Saisis ton nom complet.');

    if (!name.reportValidity() || !email.reportValidity()) return;

    this.profileName.set(fullName);
    this.profileEmail.set(email.value.trim());

    const initials = fullName.split(/\s+/)
      .filter((_, index, words) => index === 0 || index === words.length - 1)
      .map(word => word.charAt(0).toUpperCase())
      .join('');

    this.session.currentUser.update(user => ({
      ...user,
      name: fullName,
      initials,
    }));

    this.accountMessage.set('Profil enregistré pour cette session.');
  }

  protected seDeconnecter(): void {
    window.location.replace('about:blank');
  }  
}
