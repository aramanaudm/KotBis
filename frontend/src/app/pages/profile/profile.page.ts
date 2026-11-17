import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { calendarOutline, heartOutline, personCircleOutline, starOutline, warningOutline } from 'ionicons/icons';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  imports: [IonButton, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, RouterLink],
})
export class ProfilePage {
  constructor() {
    addIcons({ calendarOutline, heartOutline, personCircleOutline, starOutline, warningOutline });
  }
}
