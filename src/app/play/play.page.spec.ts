// [PianoPlay](https://michaelecke.com/pianoplay) - Copyright (c) 2021 Rodrigo Jorge Vilar de Linares.

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { PlayPageComponent } from './play.page';

describe('PlayPageComponent', () => {
  let component: PlayPageComponent;
  let fixture: ComponentFixture<PlayPageComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [PlayPageComponent],
      imports: [IonicModule.forRoot(), TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
