import { AfterViewInit, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { RechercheService } from '../core/recherche/recherche.service';
import { EtapesTrajetComponent } from '../lignes_arrets_marche_attente/etapes-trajet.component';
import { DistanceDureeComponent } from '../distance_duree/distance-duree.component';

/**
 * BUS-FE-024 – Détail d'un trajet.
 * Critère : « Le détail correspond au résultat sélectionné ».
 *
 * Le panneau est TOUJOURS reconstruit à partir du résultat sélectionné dans
 * RechercheService : il ne garde aucune ancienne valeur, donc on ne voit jamais
 * le détail d'un autre trajet. Il contient les étapes (025) et la distance / durée (026).
 */
@Component({
  selector: 'app-detail-trajet',
  standalone: true,
  imports: [EtapesTrajetComponent, DistanceDureeComponent],
  templateUrl: './detail-trajet.component.html',
  styleUrl: './detail-trajet.component.css',
})
export class DetailTrajetComponent implements AfterViewInit {
  readonly recherche = inject(RechercheService);

  @ViewChild('titre') private titre?: ElementRef<HTMLHeadingElement>;

  /** Place le focus sur le titre pour les lecteurs d'écran. */
  ngAfterViewInit(): void {
    this.titre?.nativeElement.focus();
  }
}
