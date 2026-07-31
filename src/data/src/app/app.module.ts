import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { IonicStorageModule } from '@ionic/storage-angular';

import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

import { ScreenOrientation } from '@awesome-cordova-plugins/screen-orientation/ngx';
import { Geolocation } from '@awesome-cordova-plugins/geolocation/ngx';
//import { Geolocation } from '@ionic-native/geolocation/ngx';
import { DeviceMotion } from '@awesome-cordova-plugins/device-motion/ngx';
import { Magnetometer } from '@awesome-cordova-plugins/magnetometer/ngx';
import { SQLite } from '@awesome-cordova-plugins/sqlite/ngx';
//import { BLE } from '@awesome-cordova-plugins/ble/ngx';
import { AndroidPermissions } from '@awesome-cordova-plugins/android-permissions/ngx';

//import { Diagnostic } from '@ionic-native/diagnostic/ngx';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicStorageModule.forRoot(),
    IonicModule.forRoot(),
    AppRoutingModule,
    HttpClientModule
  ],
  providers: [
    ScreenOrientation,
    Geolocation,
    DeviceMotion,
    Magnetometer,
    SQLite,
    //BLE,
    AndroidPermissions,
    //Diagnostic,
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy }
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
