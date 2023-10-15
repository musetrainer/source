import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { IndexPage } from './index.page';

const routes: Routes = [
  {
    path: '',
    component: IndexPage,
    children: [
      {
        path: 'home',
        loadChildren: () =>
          import('../home/home.module').then((m) => m.HomePageModule),
      },
      {
        path: 'home/:folder',
        loadChildren: () =>
          import('../home/home.module').then((m) => m.HomePageModule),
      },
      {
        path: 'badge',
        loadChildren: () =>
          import('../badge/badge.module').then((m) => m.BadgePageModule),
      },
      {
        path: 'support',
        loadChildren: () =>
          import('../support/support.module').then((m) => m.SupportPageModule),
      },
      {
        path: 'help',
        loadChildren: () =>
          import('../help/help.module').then((m) => m.HelpPageModule),
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class IndexPageRoutingModule {}
