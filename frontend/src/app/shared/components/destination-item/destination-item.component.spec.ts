import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DestinationItemComponent } from './destination-item.component';

describe('DestinationItemComponent', () => {
  let component: DestinationItemComponent;
  let fixture: ComponentFixture<DestinationItemComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DestinationItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
