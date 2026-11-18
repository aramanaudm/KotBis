import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import type { AbstractControl } from '@angular/forms';

/**
 * Affiche, sous un champ, le message d'erreur explicatif du premier validateur en échec.
 * Visible dès que le champ a été touché ou modifié, ou qu'un envoi a été tenté (markAllAsTouched).
 *
 * L'état d'un contrôle de formulaire n'est pas un signal : on écoute ses événements
 * (valeur, statut, « touched ») pour déclencher le recalcul, ce qui fonctionne avec OnPush/zoneless.
 */
@Component({
  selector: 'app-field-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as text) {
      <span class="field-error" [id]="errorId()" role="alert">{{ text }}</span>
    }
  `,
})
export class FieldErrorComponent {
  readonly control = input.required<AbstractControl | null>();
  /** Message par code d'erreur, dans l'ordre de priorité d'affichage. */
  readonly messages = input.required<Record<string, string>>();
  /** Id du message, référencé par `aria-describedby` sur le champ. */
  readonly errorId = input<string>();

  /** Incrémenté à chaque événement du contrôle pour invalider `message`. */
  private readonly controlEvents = signal(0);

  protected readonly message = computed(() => {
    this.controlEvents();
    const control = this.control();
    if (!control || !control.invalid || !(control.touched || control.dirty)) return null;
    const errors = control.errors ?? {};
    const messages = this.messages();
    const code = Object.keys(messages).find((key) => key in errors);
    return code ? messages[code] : null;
  });

  constructor() {
    effect((onCleanup) => {
      const control = this.control();
      if (!control) return;
      const subscription = control.events.subscribe(() => this.controlEvents.update((n) => n + 1));
      onCleanup(() => subscription.unsubscribe());
    });
  }
}
