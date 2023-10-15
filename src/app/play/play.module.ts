import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { PianoKeyboardComponent } from '../piano-keyboard/piano-keyboard.component';
import { PlayPageComponent } from './play.page';
import { PlayPageRoutingModule } from './play-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PlayPageRoutingModule,
    TranslateModule,
  ],
  declarations: [PlayPageComponent, PianoKeyboardComponent],
})
export class PlayPageModule {}
