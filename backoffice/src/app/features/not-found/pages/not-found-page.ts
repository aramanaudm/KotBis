import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, TranslatePipe],
  template: `
    <section class="not-found">
      <span class="eyebrow">{{ 'notFound.eyebrow' | t }}</span>
      <h1>{{ 'notFound.title' | t }}</h1>
      <p>{{ 'notFound.description' | t }}</p>
      <a class="primary-link" routerLink="/tableau-de-bord">{{ 'notFound.back' | t }}</a>
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
