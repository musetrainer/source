import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { BadgePageRoutingModule } from './badge-routing.module';

import { BadgePage } from './badge.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BadgePageRoutingModule
  ],
  declarations: [BadgePage]
})
export class BadgePageModule {}
