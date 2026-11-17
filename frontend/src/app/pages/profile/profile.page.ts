import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonList,
  IonListHeader,
  IonItem,
  IonIcon,
  IonLabel,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  personCircleOutline,
  heartOutline,
  calendarOutline,
  starOutline,
  warningOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonList,
    IonListHeader,
    IonItem,
    IonIcon,
    IonLabel,
    RouterLink,
  ],
})
export class ProfilePage {
  constructor() {
    addIcons({
      personCircleOutline,
      heartOutline,
      calendarOutline,
      starOutline,
      warningOutline,
    });
  }
}