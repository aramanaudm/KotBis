import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonIcon, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline, eyeOffOutline, eyeOutline, lockClosedOutline } from 'ionicons/icons';
import { AuthError } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { identifierValidator } from '../../core/auth/auth.validators';
import { BrandLogoComponent } from '../brand-logo/brand-logo.component';
import { FieldErrorComponent } from '../field-error/field-error.component';
import { IDENTIFIER_MESSAGES, LOGIN_PASSWORD_MESSAGES } from '../field-error/field-messages';

/** BUS-FE-031 (écran de connexion) et BUS-FE-032 (e-mail ou pseudo comme identifiant). */
@Component({
  selector: 'app-login-modal',
  imports: [ReactiveFormsModule, IonIcon, BrandLogoComponent, FieldErrorComponent],
  template: `
    <div class="bm-card bm-theme-blue">
      <button class="bm-card-close" type="button" aria-label="Fermer" (click)="dismiss('cancel')">
        <ion-icon name="close-outline"></ion-icon>
      </button>

      <header class="bm-card-head">
        <app-brand-logo class="bm-brand" />
        <h2 class="bm-title">Connectez-vous pour plus de fonctionnalités</h2>
        <p class="bm-subtitle">Retrouvez vos trajets et vos préférences.</p>
      </header>

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="bm-field">
          <label class="bm-label" for="login-identifier">Email ou pseudo</label>
          <input
            id="login-identifier"
            class="bm-input"
            formControlName="identifier"
            type="text"
            inputmode="email"
            autocomplete="username"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="next"
            placeholder="votre@email.com"
            aria-describedby="login-identifier-error"
          />
          <app-field-error errorId="login-identifier-error" [control]="form.controls.identifier" [messages]="identifierMessages" />
        </div>

        <div class="bm-field">
          <label class="bm-label" for="login-password">Mot de passe</label>
          <div class="bm-input-wrap">
            <ion-icon class="bm-input-icon" name="lock-closed-outline"></ion-icon>
            <input
              id="login-password"
              class="bm-input"
              formControlName="password"
              [type]="showPassword() ? 'text' : 'password'"
              autocomplete="current-password"
              enterkeyhint="go"
              placeholder="Votre mot de passe"
              aria-describedby="login-password-error"
            />
            <button
              class="bm-input-action"
              type="button"
              [attr.aria-label]="showPassword() ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
              (click)="showPassword.set(!showPassword())"
            >
              <ion-icon [name]="showPassword() ? 'eye-off-outline' : 'eye-outline'"></ion-icon>
            </button>
          </div>
          <app-field-error errorId="login-password-error" [control]="form.controls.password" [messages]="passwordMessages" />
        </div>

        <div class="bm-forgot">
          <button class="bm-btn bm-btn--link is-blue" type="button" (click)="dismiss('forgot')">Mot de passe oublié ?</button>
        </div>

        @if (serverError(); as message) {
          <p class="bm-feedback is-error" role="alert">{{ message }}</p>
        }

        <button class="bm-btn bm-btn--blue" type="submit" [disabled]="submitting()">
          {{ submitting() ? 'Connexion…' : 'Se connecter' }}
        </button>
      </form>

      <div class="bm-divider"><span>ou</span></div>

      <button class="bm-btn bm-btn--outline" type="button" (click)="dismiss('register')">Créer un compte</button>

      <div class="bm-center-links">
        <button class="bm-btn bm-btn--link is-blue" type="button" (click)="dismiss('cancel')">
          Continuer en tant que visiteur →
        </button>
      </div>
    </div>
  `,
})
export class LoginModalComponent {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthService);
  private readonly modals = inject(ModalController);

  protected readonly identifierMessages = IDENTIFIER_MESSAGES;
  protected readonly passwordMessages = LOGIN_PASSWORD_MESSAGES;

  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    identifier: ['', [Validators.required, identifierValidator]],
    password: ['', [Validators.required]],
  });

  constructor() {
    addIcons({ closeOutline, eyeOutline, eyeOffOutline, lockClosedOutline });
  }

  protected async submit(): Promise<void> {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { identifier, password } = this.form.getRawValue();
    this.submitting.set(true);
    try {
      await this.auth.login(identifier, password);
      await this.modals.dismiss(null, 'done');
    } catch (error) {
      this.serverError.set(
        error instanceof AuthError ? error.message : 'La connexion a échoué. Réessayez plus tard.',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  /** `role` indique à AuthModalService quelle carte afficher ensuite (ou 'cancel' pour fermer). */
  protected dismiss(role: 'cancel' | 'register' | 'forgot'): Promise<boolean> {
    return this.modals.dismiss(null, role);
  }
}