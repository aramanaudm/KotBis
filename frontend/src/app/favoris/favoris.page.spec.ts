import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { computed, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ModalController, ToastController } from '@ionic/angular';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../environments/environment';
import { AuthModalService } from '../core/auth/auth-modal.service';
import type { PublicAccount } from '../core/auth/auth.models';
import { EMPTY_COUNTERS } from '../core/auth/auth.models';
import { AuthService } from '../core/auth/auth.service';
import { MonEspacePage } from '../pages/mon-espace/mon-espace.page';

import { FavorisPage } from './favoris.page';
import type { Favori, TrajetPropose } from './favoris.service';

const API = `${environment.apiUrl}/favoris`;

const compte: PublicAccount = {
  id: '10',
  pseudo: 'Compte test',
  email: 'test@example.com',
  createdAt: '2026-11-18T10:00:00.000Z',
  counters: EMPTY_COUNTERS,
};

const favoriPortLouisCurepipe: Favori = {
  id: 1,
  type: 'trajet',
  depart: { id: 11, code: 'PL', nom: 'Port-Louis' },
  arrivee: { id: 12, code: 'CP', nom: 'Curepipe' },
  libelle: null,
  creeLe: '2026-11-19T08:00:00.000Z',
  disponible: true,
};

const trajetRoseHill: TrajetPropose = {
  trajetId: 7,
  ligne: 'BM-1',
  nom: 'PORT LOUIS − ROSE HILL',
  direction: 'Rose Hill',
  depart: { id: 11, nom: 'Port-Louis' },
  arrivee: { id: 13, nom: 'Rose-Hill' },
};

const trajetCurepipe: TrajetPropose = { ...trajetRoseHill, trajetId: 8, arrivee: { id: 12, nom: 'Curepipe' } };

/** Laisse s'exécuter les promesses en attente. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('FavorisPage', () => {
  let utilisateur: ReturnType<typeof signal<PublicAccount | null>>;
  let http: HttpTestingController;
  let openLogin: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    utilisateur = signal<PublicAccount | null>(compte);
    openLogin = vi.fn().mockResolvedValue(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ModalController, useValue: {} },
        { provide: ToastController, useValue: {} },
        { provide: AuthModalService, useValue: { openLogin } },
        {
          provide: AuthService,
          useValue: {
            user: utilisateur.asReadonly(),
            isLoggedIn: computed(() => utilisateur() !== null),
            token: () => (utilisateur() ? 'jeton-test' : null),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Ouvre la page et répond aux deux chargements initiaux (favoris + trajets proposés). */
  async function ouvrir(favoris: Favori[], trajets: TrajetPropose[]): Promise<ComponentFixture<FavorisPage>> {
    const fixture = TestBed.createComponent(FavorisPage);
    fixture.detectChanges();
    await settle();
    for (const requete of http.match(API)) requete.flush({ elements: favoris });
    const proposes = http.expectOne((r) => r.url === `${API}/trajets`);
    expect(proposes.request.headers.get('Authorization')).toBe('Bearer jeton-test');
    proposes.flush({ elements: trajets });
    await settle();
    fixture.detectChanges();
    return fixture;
  }

  it('demande de se connecter sans appeler l’API quand le visiteur n’a pas de compte', async () => {
    utilisateur.set(null);
    const fixture = TestBed.createComponent(FavorisPage);
    const page: HTMLElement = fixture.nativeElement;
    fixture.detectChanges();
    await settle();

    expect(page.querySelector('#titre-connexion')?.textContent).toContain('Connectez-vous');
    page.querySelector<HTMLButtonElement>('.empty button')!.click();
    expect(openLogin).toHaveBeenCalled();
    expect(page.querySelector('.topbar a')?.getAttribute('href')).toBe('/home');
  });

  it('affiche les favoris enregistrés en base et les trajets du réseau qui ne le sont pas encore', async () => {
    const fixture = await ouvrir([favoriPortLouisCurepipe], [trajetRoseHill, trajetCurepipe]);
    const page: HTMLElement = fixture.nativeElement;

    expect(page.querySelector('ul[aria-label]')?.textContent).toContain('Port-Louis → Curepipe');
    const proposes = page.querySelectorAll('.catalogue li');
    expect(proposes).toHaveLength(1);
    expect(proposes[0].textContent).toContain('Port-Louis → Rose-Hill');
    expect(proposes[0].textContent).toContain('Ligne BM-1');
  });

  it('affiche l’état vide quand le compte n’a aucun favori', async () => {
    const fixture = await ouvrir([], []);
    const page: HTMLElement = fixture.nativeElement;
    expect(page.querySelector('#titre-vide')?.textContent).toContain('Aucun favori enregistré');
    expect(page.querySelector('.aucun-trajet')?.textContent).toContain('Aucun trajet trouvé');
  });

  it('enregistre le trajet choisi en base avec ses arrêts de départ et d’arrivée', async () => {
    const fixture = await ouvrir([], [trajetRoseHill]);
    const page: HTMLElement = fixture.nativeElement;

    page.querySelector<HTMLButtonElement>('.catalogue button.action[type="button"]')!.click();
    const ajout = http.expectOne({ method: 'POST', url: API });
    expect(ajout.request.body).toEqual({ type: 'trajet', arretDepartId: 11, arretArriveeId: 13 });
    expect(ajout.request.headers.get('Authorization')).toBe('Bearer jeton-test');
    ajout.flush({ ...favoriPortLouisCurepipe, id: 5, arrivee: { id: 13, code: 'RH', nom: 'Rose-Hill' } });
    await settle();
    fixture.detectChanges();

    expect(page.querySelector('.feedback')?.textContent).toContain('Trajet enregistré');
    expect(page.querySelector('ul[aria-label]')?.textContent).toContain('Port-Louis → Rose-Hill');
    expect(page.querySelectorAll('.catalogue li')).toHaveLength(0);
  });

  it('affiche le message de l’API si le favori existe déjà', async () => {
    const fixture = await ouvrir([], [trajetRoseHill]);
    const page: HTMLElement = fixture.nativeElement;

    page.querySelector<HTMLButtonElement>('.catalogue button.action[type="button"]')!.click();
    http
      .expectOne({ method: 'POST', url: API })
      .flush(
        { erreur: { code: 'FAVORI_EXISTANT', message: 'Ce favori est déjà enregistré.' } },
        { status: 409, statusText: 'Conflict' },
      );
    await settle();
    fixture.detectChanges();

    expect(page.querySelector('.feedback-error')?.textContent).toContain('déjà dans vos favoris');
    expect(fixture.componentInstance.favoris()).toHaveLength(0);
  });

  it('supprime le favori en base puis le retire de la liste', async () => {
    const fixture = await ouvrir([favoriPortLouisCurepipe], []);
    const page: HTMLElement = fixture.nativeElement;

    page.querySelector<HTMLButtonElement>('.remove')!.click();
    const suppression = http.expectOne({ method: 'DELETE', url: `${API}/1` });
    suppression.flush(null, { status: 204, statusText: 'No Content' });
    await settle();
    fixture.detectChanges();

    expect(page.querySelector('.feedback')?.textContent).toContain('retiré des favoris');
    expect(page.querySelector('#titre-vide')?.textContent).toContain('Aucun favori enregistré');
  });

  it('signale un favori dont un arrêt n’est plus desservi (EF-FAV-006)', async () => {
    const fixture = await ouvrir([{ ...favoriPortLouisCurepipe, disponible: false }], []);
    const page: HTMLElement = fixture.nativeElement;
    expect(page.querySelector('.indisponible')?.textContent).toContain('Plus desservi');
  });

  it('recherche les trajets avec le texte saisi', async () => {
    const fixture = await ouvrir([], []);
    const page: HTMLElement = fixture.nativeElement;

    const champ = page.querySelector<HTMLInputElement>('#recherche-trajet')!;
    champ.value = 'rose hill';
    champ.dispatchEvent(new Event('input'));
    page.querySelector<HTMLFormElement>('form.recherche')!.dispatchEvent(new Event('submit'));
    const recherche = http.expectOne((r) => r.url === `${API}/trajets`);
    expect(recherche.request.params.get('recherche')).toBe('rose hill');
    recherche.flush({ elements: [trajetRoseHill] });
    await settle();
    fixture.detectChanges();

    expect(page.querySelectorAll('.catalogue li')).toHaveLength(1);
  });

  it('met à jour le compteur de Mon espace avec les favoris du compte', async () => {
    const profil = TestBed.createComponent(MonEspacePage);
    profil.detectChanges();
    await settle();
    http.expectOne(API).flush({ elements: [favoriPortLouisCurepipe] });
    await settle();
    profil.detectChanges();
    const compteur = (profil.nativeElement as HTMLElement).querySelector('.is-account li small');
    expect(compteur?.textContent?.trim()).toBe('1 enregistré');
  });
});
