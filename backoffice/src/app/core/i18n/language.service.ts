import { effect, Injectable, signal } from '@angular/core';
import { MESSAGES } from './messages';

export type Language = 'fr' | 'en';

const STORAGE_KEY = 'kotbis.backoffice.lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly current = signal<Language>(lireLangue());
  readonly lang = this.current.asReadonly();

  constructor() {
    effect(() => {
      const lang = this.current();
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    });
  }

  set(lang: Language): void {
    this.current.set(lang);
  }

  t(key: string, params?: Record<string, string | number>): string {
    let message = MESSAGES[this.current()][key] ?? MESSAGES.fr[key] ?? key;

    if (params) {
      for (const [nom, valeur] of Object.entries(params)) {
        message = message.replaceAll(`{${nom}}`, String(valeur));
      }
    }

    return message;
  }
}

function lireLangue(): Language {
  return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'fr';
}
