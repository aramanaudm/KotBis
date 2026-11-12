import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonContent, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonSearchbar, 
  IonIcon 
} from '@ionic/angular';
import { UiButtonComponent } from '../../shared/components/ui-button/ui-button.component';
import { DestinationItemComponent } from '../../shared/components/destination-item/destination-item.component';
import { AlertCardComponent } from '../../shared/components/alert-card/alert-card.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonSearchbar,
    IonIcon,
    UiButtonComponent,
    DestinationItemComponent,
    AlertCardComponent
  ]
})
export class HomePage {
  constructor() {}
}