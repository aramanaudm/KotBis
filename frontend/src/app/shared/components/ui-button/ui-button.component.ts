import { Component, Input } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';

@Component({
  selector: 'app-ui-button',
  templateUrl: './ui-button.component.html',
  styleUrls: ['./ui-button.component.scss'],
  imports: [IonButton, IonIcon],
})
export class UiButtonComponent {
  @Input() label = '';
  @Input() color: 'primary' | 'outline' | 'danger' = 'primary';
  @Input() expand: 'block' | 'full' | undefined = 'block';
  @Input() icon = '';
  @Input() iconSlot: 'start' | 'end' = 'end';
  @Input() disabled = false;
  @Input() type: 'button' | 'submit' = 'button';
}
