import { Component, Input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { warningOutline } from 'ionicons/icons';

@Component({
  selector: 'app-alert-card',
  templateUrl: './alert-card.component.html',
  styleUrls: ['./alert-card.component.scss'],
  imports: [IonIcon],
})
export class AlertCardComponent {
  @Input() title = '';
  @Input() message = '';
  @Input() linkText = 'Voir les détails';

  constructor() {
    addIcons({ warningOutline });
  }
}
