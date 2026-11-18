import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonIcon, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';

import { AuthError } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { emailValidator, matchFields, passwordValidator } from '../../core/auth/auth.validators';
import { BrandLogoComponent } from '../brand-logo/brand-logo.component';
import { FieldErrorComponent } from '../field-error/field-error.component';
import {
  CONFIRM_PASSWORD_MESSAGES,
  EMAIL_MESSAGES,
  PASSWORD_MESSAGES,
  RESET_CODE_MESSAGES,
} from '../field-error/field-messages';

type Step = 'request' | 'confirm' | 'done';

const STEPS: { id: Step; label: string }[] = [
  { id: 'request', label: 'Demande' },
  { id: 'confirm', label: 'Confirmation' },
  { id: 'done', label: 'Terminé' },
];

/** BUS-FE-033 : demande puis confirmation de réinitialisation, étapes et messages visibles. */
@Component({
  selector: 'app-forgot-password-modal',
  imports: [ReactiveFormsModule, IonIcon, BrandLogoComponent, FieldErrorComponent],
  styles: `
    .steps {
      display: flex;
      gap: 8px;
      margin: 22px 0 0;
      padding: 0;
      list-style: none;
    }
    .steps li {
      flex: 1;
      padding-top: 7px;
      border-top: 4px solid var(--bm-border);
      border-radius: 2px;
      font-size: 11px;
      line-height: 14px;
      color: var(--bm-muted);
      text-align: left;
    }
    .steps li.is-done,
    .steps li.is-current {
      border-top-color: var(--bm-green);
    }
    .steps li.is-current {
      font-weight: 700;
      color: var(--bm-green-ink);
    }
    .step-title {
      margin: 22px 0 0;
      font-size: 22px;
      line-height: 26px;
      font-weight: 700;
      text-align: center;
    }
    .step-lead {
      margin: 10px 0 20px;
      font-size: 13px;
      line-height: 18px;
      text-align: center;
      color: var(--bm-muted);
    }
    .secondary {
      display: flex;
      justify-content: center;
      margin-top: 14px;
    }
  `,
  template: `
    <div class="bm-card">
      <button class="bm-card-close" type="button" aria-label="Fermer" (click)="dismiss('cancel')">
        <ion-icon name="close-outline"></ion-icon>
      </button>

      <header class="bm-card-head">
        <app-brand-logo class="bm-brand" />
      </header>

      <ol class="steps" aria-label="Progression">
        @for (item of steps; track item.id; let i = $index) {
          <li
            [class.is-current]="item.id === step()"
            [class.is-done]="i < stepIndex()"
            [attr.aria-current]="item.id === step() ? 'step' : null"
          >
            {{ i + 1 }}. {{ item.label }}
          </li>
        }
      </ol>

      @switch (step()) {
        @case ('request') {
          <h2 class="step-title">Mot de passe oublié ?</h2>
          <p class="step-lead">
            Saisissez l’e-mail de votre compte. Si un compte existe, un code de confirmation vous sera envoyé.
          </p>

          <form [formGroup]="requestForm" (ngSubmit)="submitRequest()" novalidate>
            <div class="bm-field">
              <label class="bm-label" for="reset-email">Email</label>
              <input
                id="reset-email"
                class="bm-input"
                formControlName="email"
                type="email"
                inputmode="email"
                autocomplete="email"
                autocapitalize="off"
                spellcheck="false"
                enterkeyhint="send"
                placeholder="votre@email.com"
                aria-describedby="reset-email-error"
              />
              <app-field-error
                errorId="reset-email-error"
                [control]="requestForm.controls.email"
                [messages]="emailMessages"
              />
            </div>

            @if (serverError(); as message) {
              <p class="bm-feedback is-error" role="alert">{{ message }}</p>
            }

            <button class="bm-btn bm-btn--green" type="submit" [disabled]="submitting()">
              {{ submitting() ? 'Envoi…' : 'Envoyer le code' }}
            </button>
          </form>
          <div class="secondary">
            <button class="bm-btn bm-btn--link is-green" type="button" (click)="dismiss('login')">
              ← Retour à la connexion
            </button>
          </div>
        }

        @case ('confirm') {
          <h2 class="step-title">Confirmer la réinitialisation</h2>
          <p class="bm-feedback is-success" role="status">
            Si un compte existe pour {{ requestedEmail() }}, un code à 6 chiffres vient d’être envoyé. Il reste valable
            15 minutes.
          </p>
          @if (devCode(); as code) {
            <p class="bm-feedback is-info" role="note">
              <strong>Mode développement :</strong> aucun e-mail n’est envoyé. Code : <strong>{{ code }}</strong>
            </p>
          }

          <form [formGroup]="confirmForm" (ngSubmit)="submitConfirm()" novalidate style="margin-top: 16px">
            <div class="bm-field">
              <label class="bm-label" for="reset-code">Code de confirmation</label>
              <input
                id="reset-code"
                class="bm-input"
                formControlName="code"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="6"
                enterkeyhint="next"
                placeholder="6 chiffres"
                aria-describedby="reset-code-error"
              />
              <app-field-error
                errorId="reset-code-error"
                [control]="confirmForm.controls.code"
                [messages]="codeMessages"
              />
            </div>

            <div class="bm-field">
              <label class="bm-label" for="reset-password">Nouveau mot de passe</label>
              <input
                id="reset-password"
                class="bm-input"
                formControlName="password"
                type="password"
                autocomplete="new-password"
                enterkeyhint="next"
                placeholder="8 caractères minimum"
                aria-describedby="reset-password-error"
              />
              <app-field-error
                errorId="reset-password-error"
                [control]="confirmForm.controls.password"
                [messages]="passwordMessages"
              />
            </div>

            <div class="bm-field">
              <label class="bm-label" for="reset-confirm">Confirmation</label>
              <input
                id="reset-confirm"
                class="bm-input"
                formControlName="confirmPassword"
                type="password"
                autocomplete="new-password"
                enterkeyhint="done"
                placeholder="Répétez le mot de passe"
                aria-describedby="reset-confirm-error"
              />
              <app-field-error
                errorId="reset-confirm-error"
                [control]="confirmForm.controls.confirmPassword"
                [messages]="confirmMessages"
              />
            </div>

            @if (serverError(); as message) {
              <p class="bm-feedback is-error" role="alert">{{ message }}</p>
            }

            <button class="bm-btn bm-btn--green" type="submit" [disabled]="submitting()">
              {{ submitting() ? 'Enregistrement…' : 'Changer mon mot de passe' }}
            </button>
          </form>
          <div class="secondary">
            <button class="bm-btn bm-btn--link is-green" type="button" (click)="restart()">
              Changer d’adresse e-mail
            </button>
          </div>
        }

        @case ('done') {
          <h2 class="step-title">Mot de passe mis à jour</h2>
          <p class="bm-feedback is-success" role="status">
            Votre mot de passe a bien été modifié. Vous pouvez maintenant vous connecter.
          </p>
          <button class="bm-btn bm-btn--green" type="button" style="margin-top: 20px" (click)="dismiss('login')">
            Se connecter
          </button>
        }
      }
    </div>
  `,
})
export class ForgotPasswordModalComponent {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthService);
  private readonly modals = inject(ModalController);

  protected readonly steps = STEPS;
  protected readonly emailMessages = EMAIL_MESSAGES;
  protected readonly codeMessages = RESET_CODE_MESSAGES;
  protected readonly passwordMessages = PASSWORD_MESSAGES;
  protected readonly confirmMessages = CONFIRM_PASSWORD_MESSAGES;

  protected readonly step = signal<Step>('request');
  protected readonly stepIndex = computed(() => STEPS.findIndex((s) => s.id === this.step()));
  protected readonly requestedEmail = signal('');
  protected readonly devCode = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly requestForm = this.fb.group({
    email: ['', [Validators.required, emailValidator]],
  });

  protected readonly confirmForm = this.fb.group(
    {
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      password: ['', [Validators.required, passwordValidator]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: matchFields('password', 'confirmPassword') },
  );

  constructor() {
    addIcons({ closeOutline });
  }

  protected async submitRequest(): Promise<void> {
    this.serverError.set(null);
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }

    const { email } = this.requestForm.getRawValue();
    this.submitting.set(true);
    try {
      const { devCode } = await this.auth.requestPasswordReset(email);
      this.requestedEmail.set(email.trim());
      this.devCode.set(devCode ?? null);
      this.step.set('confirm');
    } catch {
      this.serverError.set('La demande a échoué. Réessayez plus tard.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected async submitConfirm(): Promise<void> {
    this.serverError.set(null);
    if (this.confirmForm.invalid) {
      this.confirmForm.markAllAsTouched();
      return;
    }

    const { code, password } = this.confirmForm.getRawValue();
    this.submitting.set(true);
    try {
      await this.auth.confirmPasswordReset(this.requestedEmail(), code, password);
      this.step.set('done');
    } catch (error) {
      this.serverError.set(
        error instanceof AuthError ? error.message : 'La réinitialisation a échoué. Réessayez plus tard.',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  protected restart(): void {
    this.serverError.set(null);
    this.confirmForm.reset();
    this.devCode.set(null);
    this.step.set('request');
  }

  protected dismiss(role: 'cancel' | 'login'): Promise<boolean> {
    return this.modals.dismiss(null, role);
  }
}
