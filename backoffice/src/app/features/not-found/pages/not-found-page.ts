import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  template: `
    <section class="not-found">
      <span class="eyebrow">ERREUR 404</span>
      <h1>Page introuvable</h1>
      <p>La page demandée n’existe pas ou a été déplacée.</p>
      <a class="primary-link" routerLink="/tableau-de-bord">Retour au tableau de bord</a>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .not-found {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      min-height: 420px;
      padding: 48px;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
    }

    .eyebrow {
      color: var(--blue);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.8px;
    }

    h1 {
      margin-top: 8px;
      font-size: 28px;
      letter-spacing: -1px;
    }

    p {
      margin-top: 10px;
      color: var(--muted);
      font-size: 13px;
    }

    .primary-link {
      margin-top: 24px;
      padding: 12px 17px;
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      background: var(--blue);
      border-radius: 9px;
    }

    @media (max-width: 700px) {
      .not-found {
        padding: 28px;
      }
    }
  `,
})
export class NotFoundPage {}
