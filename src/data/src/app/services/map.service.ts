import { Injectable } from '@angular/core';
import { Loader } from "@googlemaps/js-api-loader"
import { environment } from '../../environments/environment';
import { LogService } from '../services/log.service';

@Injectable({
  providedIn: 'root'
})
export class MapService {

  private map: any;

  private mapDragFunc: any = null;
  private markClickFunc: any = null;

  private isInitialize: boolean = false;

  private markers = Array();
  private markersTimestamp = Array();
  private markersComments = Array();
  private markersVideoTime = Array();

  private circleMarkers = Array();

  private selectMarkerPos: number = 0;

  private carMarker: any = null;
  private startMarker: any = null;
  private endMarker: any = null;

  constructor(
    private logService: LogService) {
  }

  stop() {
    this.logService.debug('[DrivingScore][MapService] stop');
    this.mapDragFunc = null;
    this.markClickFunc = null;
  }

  removeAll() {
    this.logService.debug('[DrivingScore][MapService] removeAll');
    this.stop();
    this.clearMarker();
    this.clearCarMarker();
    this.map = null;
  }

  loadGoogleInstance(func: any) {
    if (this.isInitialize == false) {
      const loader = new Loader({
        apiKey: environment.mapsKey,
        // ProjectSmith proposal #585 (auto_b): pin to a specific Google Maps
        // JS API version instead of "weekly". Version 65 (current weekly at
        // 2026-07) crashes on Android/Capacitor WebView during map init with
        // "Failed to execute 'observe' on 'IntersectionObserver': parameter 1
        // is not of type 'Element'." because Zone.js patches
        // IntersectionObserver.observe and the SDK passes something that
        // isn't a strict Element from within shadow DOM lookup on WebView.
        // Chromium desktop is unaffected. Pinning to a stable quarterly-era
        // version avoids the incompatible internal implementation.
        version: "3.55",
        region: "JP",
        language: "ja"
      });
      var self = this;
      loader.load()
      .then(() => {
        self.isInitialize = true;
        func();
      })
      .catch((error: any) => {
        self.logService.error('[DrivingScore][MapService] loadGoogleInstance', error);
      });
    } else {
      func();
    }
  }

  //https://developers.google.com/maps/documentation/javascript/overview
  //https://developers.google.com/maps/documentation/javascript/controls
  async createMap(element: HTMLElement, uluru: any, zoom: number) {
    // ProjectSmith proposal #585 defensive guard: `element` は呼び出し元
    // (driving.page など) の @ViewChild.nativeElement で、ionic の描画タイミング
    // 次第で undefined / 非 Element が渡る可能性がある。渡ってしまうと
    // `new google.maps.Map(element, ...)` は SDK 内部で不明瞭な IntersectionObserver
    // エラーになるため、その前段で明示的に落として原因追跡しやすくする。
    if (!(element instanceof HTMLElement)) {
      this.logService.error(
        '[DrivingScore][MapService] createMap: element is not an HTMLElement',
        element
      );
      return;
    }
    //https://developers.google.com/maps/documentation/javascript/reference/map
    const map = new google.maps.Map(element, {
      center: uluru,
      zoom: zoom,
      mapTypeControl: false,
      zoomControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      rotateControl: false
    });
    this.map = map;

    this.resetMarkerIcon();

    for (const marker of this.markers) {
      marker.setMap(map);
    }
    for (const marker of this.circleMarkers) {
      marker.setMap(map);
    }
    if (this.startMarker != null) {
      this.startMarker.setMap(map);
    }
    if (this.endMarker != null){
      this.endMarker.setMap(map);
    }
    if (this.carMarker != null) {
      this.carMarker.setMap(map);
    }

    try {
      var self = this;
      this.map.addListener('drag', () => {
        if (self.mapDragFunc != null) {
          self.mapDragFunc();
        }
      });

      this.map.addListener("idle", () => {
        if (self.map != null ) {
          const bounds = self.map.getBounds();
          self.checkVisibleElements(self.circleMarkers, bounds);
          self.checkVisibleElements(self.markers, bounds);
        }
      });

      this.logService.debug('[DrivingScore][MapService] createMap: finish');
    } catch(error) {
      this.logService.error('[DrivingScore][MapService] createMap', error);
    }
  }

  setZoom(zoom: number) {
    try {
      this.map.setZoom(zoom);
    } catch (error) {
      this.logService.error('[DrivingScore][MapService] setZoom', error);
    }
  }

  private lastUluruLat = 0;
  private lastUluruLon = 0;
  setCenter(uluru: any) {
    try {
      this.map.setCenter(uluru);

      /*
      var self = this;
      const accuracy = 10000;
      const lat = Math.round(uluru.lat() * accuracy);
      const lon = Math.round(uluru.lng() * accuracy);
      if (this.lastUluruLat != lat || this.lastUluruLon != lon) {
        this.lastUluruLat = lat;
        this.lastUluruLon = lon;

        this.logService.debug('[DrivingScore][MapService] Geocoder API');
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({'location': uluru}, (results: any, status: any) => {
          if (status == 'OK' || results !== null) {
            for (const result of results) {
              if ((result.types.includes('intersection'))){// && result.geometry.location_type == 'RANGE_INTERPOLATED')
//                || (result.types.includes('route'))) {// && result.geometry.location_type == 'GEOMETRIC_CENTER ')) {
                console.log(result);
              }
            }
          } else {
            self.logService.error('[DrivingScore][MapService] createMap. Geocode was not successful for the following reason: ' + status);
          }
        });
      }
      */
    } catch (error) {
      this.logService.error('[DrivingScore][MapService] setCenter', error);
    }
  }

  addListener(key: string, func: any) {
    if (key == 'drag') {
      this.mapDragFunc = func;
    } else if (key == 'mark') {
      this.markClickFunc = func;
    }
  }

  clearMarker() {
    for (const marker of this.markers) {
      marker.setMap(null);
    }
    this.markers.splice(0);
    this.markersTimestamp.splice(0);
    this.markersComments.splice(0);
    this.markersVideoTime.splice(0);

    for (const marker of this.circleMarkers) {
      marker.setMap(null);
    }
    this.circleMarkers.splice(0);

    if (this.startMarker != null) {
      this.startMarker.setMap(null);
      this.startMarker = null;
    }
    if (this.endMarker != null){
      this.endMarker.setMap(null);
      this.endMarker = null;
    }
  }

  drawMarker(uluru: any, title: string, videoTime: number, comments:{}) {
    const image = {
      url: "assets/images/hiyari.png",
      size: new google.maps.Size(40, 40),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(20, 40),
    };

    const marker = new google.maps.Marker({
      position: uluru,
      map: this.map,
      title: title,
      icon: image,
      zIndex: 2
    });

    var self = this;
    var pos = this.getMarkerLength();
    marker.addListener("click", () => {
      if (self.markClickFunc != null) {
        self.logService.debug('[DrivingScore][MapService] drawMarker: marker click=' + title);
        self.markClickFunc(title, pos);
      }
    });

    this.markers.push(marker);
    this.markersTimestamp.push(title);
    this.markersComments.push(comments);
    this.markersVideoTime.push(videoTime);
  }

  getMarkerPosition(pos: number) {
    return this.markers[pos].getPosition();
  }

  getMarkerTimestamp(pos: number) {
    return this.markersTimestamp[pos];
  }

  getMarkerVideoTime(pos: number) {
    return this.markersVideoTime[pos];
  }

  //文字列型。brake/handle/speed/accelerator/over_all
  getMarkerComment(pos: number, key: string) {
    return this.markersComments[pos][key];
  }

  getMarkerLength() {
    return this.markers.length;
  }

  resetMarkerIcon() {
    try {
      const image = {
        url: "assets/images/hiyari.png",
        size: new google.maps.Size(40, 40),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(20, 40),
      };
      for (const marker of this.markers) {
        marker.setIcon(image);
      }
    } catch(error) {
      this.logService.error('[DrivingScore][MapService] resetMarkerIcon', error);
    }
  }

  setBigMarkerIcon(pos: number) {
    try {
      const miniImage = {
        url: "assets/images/hiyari.png",
        size: new google.maps.Size(40, 40),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(20, 40),
      };

      const bigImage = {
        url: "assets/images/hiyar_big.png",
        size: new google.maps.Size(60, 60),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(30, 60),
      };

      for (let i=0; i<this.markers.length; i++) {
        if (i == pos) {
          this.markers[i].setIcon(bigImage);
        } else {
          this.markers[i].setIcon(miniImage);
        }
      }
    } catch(error) {
      this.logService.error('[DrivingScore][MapService] setBigMarkerIcon', error);
    }
  }

  fitBounds() {
    try {
      // 地図をフィットさせる
      let latLngBounds = new google.maps.LatLngBounds();
      for (const marker of this.markers) {
        latLngBounds.extend(marker.getPosition());
      }
      if (this.startMarker != null) {
        latLngBounds.extend(this.startMarker.getPosition());
      }
      if (this.endMarker != null) {
        latLngBounds.extend(this.endMarker.getPosition());
      }

      this.map.fitBounds( latLngBounds ) ;
    } catch(error) {
      this.logService.error('[DrivingScore][MapService] fitBounds', error);
    }
  }

  drawCarMarker(uluru: any, rotation: number) {
    if (this.carMarker != null) {
      this.setCarPosition(uluru, rotation);
      return;
    }

    try {
      //https://developers.google.com/maps/documentation/javascript/reference/marker
      const icon = {
        fillColor: "#0000FF",                //塗り潰し色
        fillOpacity: 1.0,                    //塗り潰し透過率
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 6,                           //円のサイズ
        strokeColor: "#FFFFFF",              //枠の色
        strokeWeight: 1.0,                    //枠の透過率
        rotation:0
      }

      const marker = new google.maps.Marker({
        position: uluru,
        map: this.map,
        icon: icon,
        zIndex: 3
      });
      this.carMarker = marker;
    } catch(error) {
      this.logService.error('[DrivingScore][MapService] drawCarMarker', error);
    }
  }

  setCarPosition(uluru: any, rotation: number) {
    if (rotation != null) {
      const icon = this.carMarker.getIcon();
      icon.rotation = rotation;
      this.carMarker.setIcon(icon);
    }
    this.carMarker.setPosition(uluru);
  }

  clearCarMarker() {
    if (this.carMarker != null) {
      this.carMarker.setMap(null);
      this.carMarker = null;
    }
  }

  drawStartMarker(uluru: any) {
    if (this.startMarker != null) {
      this.startMarker.setMap(null);
    }
    try {
      const marker = new google.maps.Marker({
        position: uluru,
        map: this.map,
        label: 'S',
        icon: {
          fillColor: "#FFFFFF",                //塗り潰し色
          fillOpacity: 1.0,                    //塗り潰し透過率
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,                           //円のサイズ
          strokeColor: "#0000FF",              //枠の色
          strokeWeight: 1.0                    //枠の透過率
        },
        zIndex: 1
      });
      this.startMarker = marker;
    } catch(error) {
      this.logService.error('[DrivingScore][MapService] drawStartMarker', error);
    }
  }

  drawEndMarker(uluru: any) {
    try {
      if (this.endMarker != null) {
        this.endMarker.setMap(null);
      }
      const marker = new google.maps.Marker({
        position: uluru,
        map: this.map,
        label: 'E',
        icon: {
          fillColor: "#FFFFFF",                //塗り潰し色
          fillOpacity: 1.0,                    //塗り潰し透過率
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,                           //円のサイズ
          strokeColor: "#0000FF",              //枠の色
          strokeWeight: 1.0                    //枠の透過率
        },
        zIndex: 1
      });
      this.endMarker = marker;
    } catch(error) {
      this.logService.error('[DrivingScore][MapService] drawEndMarker', error);
    }
  }

  setSelectMarkerPos(pos: number) {
    this.selectMarkerPos = pos;
  }

  getSelectMarkerPos() {
    return this.selectMarkerPos;
  }

  drawCircleMarker(uluru: any) {
    try {
      if (0 < this.circleMarkers.length ) {
        const x1 = uluru.lat();
        const y1 = uluru.lng();
        const x2 = this.circleMarkers[this.circleMarkers.length - 1].getPosition().lat();
        const y2 = this.circleMarkers[this.circleMarkers.length - 1].getPosition().lng();
        const distance = Math.sqrt( Math.pow( x2-x1, 2 ) + Math.pow( y2-y1, 2 ) ) ;
        if (distance < 0.0006) {
          return;
        }
      }

      const icon = {
        fillColor: "#8888FF",                //塗り潰し色
        fillOpacity: 0.8,                    //塗り潰し透過率
        path: google.maps.SymbolPath.CIRCLE,
        scale: 2,                           //円のサイズ
        strokeColor: "#8888FF",              //枠の色
        strokeWeight: 0.8,                    //枠の透過率
      };
      const marker = new google.maps.Marker({
        position: uluru,
        map: this.map,
        icon: icon,
        zIndex: 0
      });

      this.circleMarkers.push(marker);
      if (1000 < this.circleMarkers.length) {
        this.circleMarkers[0].setMap(null);
        this.circleMarkers.splice(0, 1);
      }
    } catch(error) {
      this.logService.error('[DrivingScore][MapService] drawCircleMarker', error);
    }
  }

  private checkVisibleElements(elementsArray: Array<google.maps.Marker>, bounds: any) {
    var self = this;
    elementsArray.forEach((item) => {
      if (bounds.contains(item.getPosition()) && item.getVisible() == true) {
        if (item.getMap() != self.map){
          item.setMap(self.map);
        }
      } else {
        item.setMap(null);
      }
    });
  }
}
