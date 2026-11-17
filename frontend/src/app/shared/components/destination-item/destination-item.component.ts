import { Component, Input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronForwardOutline } from 'ionicons/icons';

@Component({
  selector: 'app-destination-item',
  templateUrl: './destination-item.component.html',
  styleUrls: ['./destination-item.component.scss'],
  imports: [IonIcon],
})
export class DestinationItemComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() icon = 'bus-outline';
  @Input() iconType: 'default' | 'star' = 'default';

  constructor() {
    addIcons({ chevronForwardOutline });
  }
}
