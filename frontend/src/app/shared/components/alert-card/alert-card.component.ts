import { Component, Input } from '@angular/core';
import { IonIcon } from '@ionic/angular';

@Component({
  selector: 'app-alert-card',
  templateUrl: './alert-card.component.html',
  styleUrls: ['./alert-card.component.scss'],
  imports: [IonIcon],
})
export class AlertCardComponent {
  @Input() title: string = '';
  @Input() message: string = '';
  @Input() linkText: string = 'Voir les détails';
}