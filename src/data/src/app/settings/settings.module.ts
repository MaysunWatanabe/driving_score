import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { File } from '@awesome-cordova-plugins/file/ngx';
//import { Diagnostic } from '@awesome-cordova-plugins/diagnostic/ngx';

import { IonicModule } from '@ionic/angular';

import { SettingsPageRoutingModule } from './settings-routing.module';

import { SettingsPage } from './settings.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    SettingsPageRoutingModule
  ],
  providers: [
    File
//    Diagnostic
  ],
  declarations: [SettingsPage]
})
export class SettingsPageModule {}
