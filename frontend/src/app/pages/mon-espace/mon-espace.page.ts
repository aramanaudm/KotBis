import { Component, computed, inject } from '@angular/core';
import { IonContent, IonIcon, NavController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  chatbubbleEllipsesOutline,
  chevronBackOutline,
  chevronForwardOutline,
  closeOutline,
  flagOutline,
  logOutOutline,
  notificationsOutline,
  optionsOutline,
  personOutline,
  starOutline,
  timeOutline,
} from 'ionicons/icons';

import { AuthModalService } from '../../core/auth/auth-modal.service';
import type { AccountCounters, PublicAccount } from '../../core/auth/auth.models';
import { EMPTY_COUNTERS } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { countLabel } from '../../core/format';
import { SectionNavigator } from '../../core/navigation/section-navigator.service';
import { FavorisService } from '../../favoris/favoris.service';

interface MenuRow {
  icon: string;
  title: string;
  /** Sous-ligne : compteur du compte, ou texte fixe. */
  subtitle: (counters: AccountCounters) => string;
  /** Route de la section (déclarée par l'epic concerné). */
  path: string;
}

/** Une ligne par rubrique du compte, avec son compteur (BUS-FE-035). */
const ACCOUNT_ROWS: MenuRow[] = [
  { icon: 'star-outline', title: 'Favoris', path: 'favoris', subtitle: (c) => countLabel(c.favoris, 'enregistré') },
  { icon: 'notifications-outline', title: 'Alertes', path: 'alertes', subtitle: (c) => countLabel(c.alertes, 'programmée') },
  { icon: 'flag-outline', title: 'Signalements', path: 'signalements', subtitle: (c) => countLabel(c.signalements, 'envoyé') },
  { icon: 'chatbubble-ellipses-outline', title: 'Mes avis', path: 'avis', subtitle: (c) => countLabel(c.avis, 'publié') },
  { icon: 'time-outline', title: 'Historique des points', path: 'points', subtitle: (c) => countLabel(c.points, 'point') },
];

const SETTINGS_ROW = { icon: 'options-outline', title: 'Paramètres', subtitle: 'Langue et apparence', path: 'parametres' };

/**
 * « Mon espace » : BUS-FE-034 (profil), 035 (informations et compteurs), 036 (déconnexion).
 * Un seul écran, deux états : visiteur et connecté. Il ne lit que le compte de la session
 * courante (`AuthService.user`) : aucune donnée d'un autre compte n'est accessible ici.
 */
@Component({
  selector: 'app-mon-espace',
  imports: [IonContent, IonIcon],
  styles: `
    .page {
      min-height: 100%;
      padding: 0 20px 32px;
      background: var(--bm-bg);
    }
    .bm-screen-head {
      margin: 0 -20px;
    }
    .who {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-top: 34px;
    }
    .avatar {
      display: grid;
      place-items: center;
      flex: none;
      width: 65px;
      height: 65px;
      border-radius: 50%;
      background: var(--bm-navy);
      color: #fff;
      font-size: 26px;
    }
    .who h2 {
      margin: 0;
      font-size: 26px;
      line-height: 30px;
      font-weight: 700;
      letter-spacing: -0.01em;
      overflow-wrap: anywhere;
    }
    .who p {
      margin: 4px 0 0;
      font-size: 13px;
      line-height: 18px;
      color: var(--bm-muted);
      overflow-wrap: anywhere;
    }
    .lead {
      margin: 30px 0 13px;
      font-size: 13px;
      line-height: 21px;
      color: var(--bm-muted);
    }
    .center {
      display: flex;
      justify-content: center;
      margin-bottom: 1px;
    }
    .center .bm-btn {
      width: auto;
      min-height: 44px;
    }
    ul.menu {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    ul.menu.is-account {
      margin-top: 23px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 13px;
      width: 100%;
      padding: 16px 4px;
      border: 0;
      border-bottom: 1px solid var(--bm-sep);
      background: none;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }
    .row:active {
      background: var(--bm-tile);
    }
    .row .txt {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }
    .row strong {
      font-size: 15px;
      line-height: 18px;
      font-weight: 700;
      color: var(--bm-ink);
    }
    .row small {
      margin-top: 1px;
      font-size: 11px;
      line-height: 14px;
      color: var(--bm-caption);
    }
    .row .chev {
      flex: none;
      margin-right: 6px;
      font-size: 18px;
      color: var(--bm-ink);
    }
    .note {
      margin: 1px 0 0;
      padding: 15px 14px;
      border-radius: 12px;
      background: var(--bm-notice-bg);
      font-size: 12px;
      line-height: 17px;
      color: var(--bm-notice-ink);
    }
  `,
  template: `
    <ion-content class="bm-screen bm-theme-blue" [fullscreen]="true">
      <div class="page">
        <header class="bm-screen-head">
          <button class="bm-icon-btn" type="button" aria-label="Retour" (click)="close()">
            <ion-icon name="chevron-back-outline"></ion-icon>
          </button>
          <h1>Mon espace</h1>
          <button class="bm-icon-btn" type="button" aria-label="Fermer" (click)="close()">
            <ion-icon name="close-outline"></ion-icon>
          </button>
        </header>

        @if (user(); as account) {
          <section class="who" aria-label="Mon compte">
            <div class="avatar" aria-hidden="true"><ion-icon name="person-outline"></ion-icon></div>
            <div>
              <h2>{{ account.pseudo }}</h2>
              <p>{{ account.email }}</p>
              @if (details(account); as extra) {
                <p>{{ extra }}</p>
              }
            </div>
          </section>

          <ul class="menu is-account">
            @for (row of accountRows; track row.path) {
              <li>
                <button class="row" type="button" (click)="open(row.path)">
                  <span class="bm-tile"><ion-icon [name]="row.icon"></ion-icon></span>
                  <span class="txt">
                    <strong>{{ row.title }}</strong>
                    <small>{{ row.subtitle(counters()) }}</small>
                  </span>
                  <ion-icon class="chev" name="chevron-forward-outline"></ion-icon>
                </button>
              </li>
            }
            <li><p class="note">Pointage : fonctionnement à définir.</p></li>
            <li>
              <button class="row" type="button" (click)="open(settings.path)">
                <span class="bm-tile"><ion-icon [name]="settings.icon"></ion-icon></span>
                <span class="txt">
                  <strong>{{ settings.title }}</strong>
                  <small>{{ settings.subtitle }}</small>
                </span>
                <ion-icon class="chev" name="chevron-forward-outline"></ion-icon>
              </button>
            </li>
            <li>
              <button class="row" type="button" (click)="logout()">
                <span class="bm-tile"><ion-icon name="log-out-outline"></ion-icon></span>
                <span class="txt"><strong>Déconnexion</strong></span>
                <ion-icon class="chev" name="chevron-forward-outline"></ion-icon>
              </button>
            </li>
          </ul>
        } @else {
          <section class="who" aria-label="Visiteur">
            <div class="avatar" aria-hidden="true"><ion-icon name="person-outline"></ion-icon></div>
            <div>
              <h2>Visiteur</h2>
              <p>Explorez les trajets sans compte.</p>
            </div>
          </section>

          <p class="lead">Connectez-vous pour enregistrer vos trajets, créer des alertes et contribuer.</p>
          <button class="bm-btn bm-btn--blue bm-btn--lg" type="button" (click)="login()">Se connecter</button>
          <div class="center">
            <button class="bm-btn bm-btn--link" type="button" (click)="register()">Créer un compte</button>
          </div>

          <ul class="menu">
            <li>
              <button class="row" type="button" (click)="open(settings.path)">
                <span class="bm-tile"><ion-icon [name]="settings.icon"></ion-icon></span>
                <span class="txt">
                  <strong>{{ settings.title }}</strong>
                  <small>{{ settings.subtitle }}</small>
                </span>
                <ion-icon class="chev" name="chevron-forward-outline"></ion-icon>
              </button>
            </li>
          </ul>
        }
      </div>
    </ion-content>
  `,
})
export class MonEspacePage {
  private readonly auth = inject(AuthService);
  private readonly authModals = inject(AuthModalService);
  private readonly navigator = inject(SectionNavigator);
  private readonly nav = inject(NavController);
  private readonly favoris = inject(FavorisService);

  protected readonly user = this.auth.user;
  protected readonly counters = computed(() => ({
    ...(this.user()?.counters ?? EMPTY_COUNTERS),
    favoris: this.favoris.favoris().length,
  }));
  protected readonly accountRows = ACCOUNT_ROWS;
  protected readonly settings = SETTINGS_ROW;
  protected readonly isLoggedIn = computed(() => this.user() !== null);

  constructor() {
    addIcons({
      chatbubbleEllipsesOutline,
      chevronBackOutline,
      chevronForwardOutline,
      closeOutline,
      flagOutline,
      logOutOutline,
      notificationsOutline,
      optionsOutline,
      personOutline,
      starOutline,
      timeOutline,
    });
  }

  /** Ville et téléphone facultatifs, sur une même ligne ; rien s'ils n'ont pas été renseignés. */
  protected details(account: PublicAccount): string {
    return [account.city, account.phone].filter(Boolean).join(' · ');
  }

  protected open(path: string): Promise<void> {
    return this.navigator.open(path);
  }

  protected login(): Promise<boolean> {
    return this.authModals.openLogin();
  }

  protected register(): Promise<boolean> {
    return this.authModals.openRegister();
  }

  /** BUS-FE-036 : déconnecte ; l'écran repasse tout seul à l'état visiteur (la session est un signal). */
  protected async logout(): Promise<void> {
    await this.auth.logout();
  }

  protected close(): Promise<boolean> {
    return this.nav.navigateBack('/home');
  }
}
