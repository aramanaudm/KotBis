import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowForwardOutline, busOutline, businessOutline, locateOutline, trainOutline } from 'ionicons/icons';
import { UiButtonComponent } from '../../shared/components/ui-button/ui-button.component';
import { DestinationItemComponent } from '../../shared/components/destination-item/destination-item.component';
import { AlertCardComponent } from '../../shared/components/alert-card/alert-card.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, RouterLink, UiButtonComponent, DestinationItemComponent, AlertCardComponent],
})
export class HomePage {
  constructor() {
    addIcons({ arrowForwardOutline, busOutline, businessOutline, locateOutline, trainOutline });
  }
}
