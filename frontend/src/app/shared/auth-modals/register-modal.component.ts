import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonIcon, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { AuthError } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import {
  emailValidator,
  matchFields,
  passwordValidator,
  phoneValidator,
  pseudoValidator,
} from '../../core/auth/auth.validators';
import { BrandLogoComponent } from '../brand-logo/brand-logo.component';
import { FieldErrorComponent } from '../field-error/field-error.component';
import {
  CITY_MESSAGES,
  CONFIRM_PASSWORD_MESSAGES,
  EMAIL_MESSAGES,
  PASSWORD_MESSAGES,
  PHONE_MESSAGES,
  PSEUDO_MESSAGES,
  TERMS_MESSAGES,
} from '../field-error/field-messages';

/**
 * BUS-FE-028 (écran d'inscription), 029 (pseudo, e-mail, mot de passe + champs facultatifs),
 * 030 (confirmation du mot de passe et validations).
 */
@Component({
  selector: 'app-register-modal',
  imports: [ReactiveFormsModule, IonIcon, BrandLogoComponent, FieldErrorComponent],
  template: `
    <div class="bm-card">
      <button class="bm-card-close" type="button" aria-label="Fermer" (click)="dismiss('cancel')">
        <ion-icon name="close-outline"></ion-icon>
      </button>

      <header class="bm-card-head">
        <app-brand-logo class="bm-brand" />
        <p class="bm-eyebrow">Inscription gratuite</p>
        <h2 class="bm-title">Créer mon compte</h2>
        <p class="bm-subtitle">Quelques informations pour personnaliser vos trajets.</p>
      </header>

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="bm-field">
          <label class="bm-label" for="reg-pseudo">Pseudo *</label>
          <input
            id="reg-pseudo"
            class="bm-input"
            formControlName="pseudo"
            type="text"
            autocomplete="username"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="next"
            maxlength="20"
            placeholder="Ex. Maya974"
            aria-describedby="reg-pseudo-error"
          />
          <app-field-error errorId="reg-pseudo-error" [control]="form.controls.pseudo" [messages]="pseudoMessages" />
        </div>

        <div class="bm-field">
          <label class="bm-label" for="reg-email">Email *</label>
          <input
            id="reg-email"
            class="bm-input"
            formControlName="email"
            type="email"
            inputmode="email"
            autocomplete="email"
            autocapitalize="off"
            spellcheck="false"
            enterkeyhint="next"
            placeholder="maya@email.com"
            aria-describedby="reg-email-error"
          />
          <app-field-error errorId="reg-email-error" [control]="form.controls.email" [messages]="emailMessages" />
        </div>

        <div class="bm-field">
          <label class="bm-label" for="reg-city">Ville ou zone</label>
          <input
            id="reg-city"
            class="bm-input"
            formControlName="city"
            type="text"
            autocomplete="address-level2"
            enterkeyhint="next"
            maxlength="60"
            placeholder="Quatre Bornes"
            aria-describedby="reg-city-error"
          />
          <app-field-error errorId="reg-city-error" [control]="form.controls.city" [messages]="cityMessages" />
        </div>

        <div class="bm-field">
          <label class="bm-label" for="reg-phone">Téléphone</label>
          <input
            id="reg-phone"
            class="bm-input"
            formControlName="phone"
            type="tel"
            inputmode="tel"
            autocomplete="tel"
            enterkeyhint="next"
            placeholder="+230 ..."
            aria-describedby="reg-phone-error"
          />
          <app-field-error errorId="reg-phone-error" [control]="form.controls.phone" [messages]="phoneMessages" />
        </div>

        <div class="bm-field">
          <label class="bm-label" for="reg-password">Mot de passe *</label>
          <input
            id="reg-password"
            class="bm-input"
            formControlName="password"
            type="password"
            autocomplete="new-password"
            enterkeyhint="next"
            placeholder="8 caractères minimum"
            aria-describedby="reg-password-error"
          />
          <app-field-error errorId="reg-password-error" [control]="form.controls.password" [messages]="passwordMessages" />
        </div>

        <div class="bm-field">
          <label class="bm-label" for="reg-confirm">Confirmation *</label>
          <input
            id="reg-confirm"
            class="bm-input"
            formControlName="confirmPassword"
            type="password"
            autocomplete="new-password"
            enterkeyhint="done"
            placeholder="Répétez le mot de passe"
            aria-describedby="reg-confirm-error"
          />
          <app-field-error errorId="reg-confirm-error" [control]="form.controls.confirmPassword" [messages]="confirmMessages" />
        </div>

        <label class="bm-check">
          <input type="checkbox" formControlName="terms" aria-describedby="reg-terms-error" />
          <span>J’accepte les conditions d’utilisation.</span>
        </label>
        <app-field-error errorId="reg-terms-error" [control]="form.controls.terms" [messages]="termsMessages" />

        @if (serverError(); as message) {
          <p class="bm-feedback is-error" role="alert">{{ message }}</p>
        }

        <div class="bm-row-actions">
          <button class="bm-btn bm-btn--outline" type="button" (click)="dismiss('cancel')">Annuler</button>
          <button class="bm-btn bm-btn--green" type="submit" [disabled]="submitting()">
            {{ submitting() ? 'Création…' : 'Créer mon compte' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class RegisterModalComponent {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthService);
  private readonly modals = inject(ModalController);

  protected readonly pseudoMessages = PSEUDO_MESSAGES;
  protected readonly emailMessages = EMAIL_MESSAGES;
  protected readonly cityMessages = CITY_MESSAGES;
  protected readonly phoneMessages = PHONE_MESSAGES;
  protected readonly passwordMessages = PASSWORD_MESSAGES;
  protected readonly confirmMessages = CONFIRM_PASSWORD_MESSAGES;
  protected readonly termsMessages = TERMS_MESSAGES;

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.group(
    {
      pseudo: ['', [Validators.required, pseudoValidator]],
      email: ['', [Validators.required, emailValidator]],
      city: ['', [Validators.maxLength(60)]],
      phone: ['', [phoneValidator]],
      password: ['', [Validators.required, passwordValidator]],
      confirmPassword: ['', [Validators.required]],
      terms: [false, [Validators.requiredTrue]],
    },
    { validators: matchFields('password', 'confirmPassword') },
  );

  constructor() {
    addIcons({ closeOutline });
  }

  protected async submit(): Promise<void> {
    this.serverError.set(null);
    if (this.form.invalid) {
      // Empêche l'envoi et fait apparaître toutes les erreurs expliquées (BUS-FE-030).
      this.form.markAllAsTouched();
      return;
    }

    const { pseudo, email, city, phone, password, terms } = this.form.getRawValue();
    this.submitting.set(true);
    try {
      await this.auth.register({ pseudo, email, city, phone, password, acceptTerms: terms });
      await this.modals.dismiss(null, 'done');
    } catch (error) {
      this.serverError.set(
        error instanceof AuthError ? error.message : "L'inscription a échoué. Réessayez plus tard.",
      );
    } finally {
      this.submitting.set(false);
    }
  }

  protected dismiss(role: 'cancel' | 'login'): Promise<boolean> {
    return this.modals.dismiss(null, role);
  }
}
