import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Insomnia } from '@awesome-cordova-plugins/insomnia/ngx';
import { File } from '@awesome-cordova-plugins/file/ngx';

import { IonicModule } from '@ionic/angular';

import { DrivingPageRoutingModule } from './driving-routing.module';

import { DrivingPage } from './driving.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    DrivingPageRoutingModule
  ],
  providers: [
    Insomnia,
    File
  ],
  declarations: [DrivingPage]
})
export class DrivingPageModule {}
