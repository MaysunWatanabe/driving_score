import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { BadSpotPage } from './bad-spot.page';

const routes: Routes = [
  {
    path: '',
    component: BadSpotPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BadSpotPageRoutingModule {}
