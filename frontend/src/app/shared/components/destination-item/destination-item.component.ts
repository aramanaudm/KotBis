import { Component, Input } from '@angular/core';
import { IonIcon } from '@ionic/angular';

@Component({
  selector: 'app-destination-item',
  templateUrl: './destination-item.component.html',
  styleUrls: ['./destination-item.component.scss'],
  imports: [IonIcon],
})
export class DestinationItemComponent {
  @Input() title: string = '';
  @Input() subtitle: string = '';
  @Input() icon: string = 'bus-outline';
  @Input() iconType: 'default' | 'star' = 'default';
}