import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProfilePage } from './profile.page';

describe('ProfilePage', () => {
  let component: ProfilePage;
  let fixture: ComponentFixture<ProfilePage>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(ProfilePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
