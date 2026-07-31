import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AndroidPermissions } from '@awesome-cordova-plugins/android-permissions/ngx';
import { File } from '@awesome-cordova-plugins/file/ngx';

import { IonicModule } from '@ionic/angular';

import { OpeningPageRoutingModule } from './opening-routing.module';

import { OpeningPage } from './opening.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HttpClientModule,
    OpeningPageRoutingModule
  ],
  providers: [
    AndroidPermissions,
    File
  ],
  declarations: [OpeningPage]
})
export class OpeningPageModule {}
