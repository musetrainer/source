import { ErrorHandler, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { HttpClient, HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { InAppPurchase2 } from '@ionic-native/in-app-purchase-2/ngx';

import * as Sentry from '@sentry/capacitor';
import * as SentryAngular from '@sentry/angular';

import jsonPackage from '../../package.json';

Sentry.init(
  {
    dsn: 'https://d7effbd636334d5ea2618128184dda8d@o291444.ingest.sentry.io/4504065321009152',
    release: `${jsonPackage.version}`,
  },
  SentryAngular.init
);

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    HttpClientModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient],
      },
    }),
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: LocationStrategy, useClass: HashLocationStrategy },
    { provide: ErrorHandler, useValue: SentryAngular.createErrorHandler() },
    InAppPurchase2,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}

export function HttpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}
