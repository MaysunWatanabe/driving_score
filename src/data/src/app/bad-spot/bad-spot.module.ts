import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { File } from '@awesome-cordova-plugins/file/ngx';
import { IonicModule } from '@ionic/angular';

import { BadSpotPageRoutingModule } from './bad-spot-routing.module';

import { BadSpotPage } from './bad-spot.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BadSpotPageRoutingModule
  ],
  providers: [
    File
  ],
  declarations: [BadSpotPage]
})
export class BadSpotPageModule {}
