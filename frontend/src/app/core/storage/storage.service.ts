import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

/** Stockage clé/valeur : Preferences natif sur Android/iOS, localStorage dans le navigateur. */
@Injectable({ providedIn: 'root' })
export class StorageService {
  async get<T>(key: string, fallback: T): Promise<T> {
    const { value } = await Preferences.get({ key });
    if (value === null) return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await Preferences.set({ key, value: JSON.stringify(value) });
  }

  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  }
}
