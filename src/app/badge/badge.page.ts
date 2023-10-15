import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {
  InAppPurchase2,
  IAPProduct,
} from '@ionic-native/in-app-purchase-2/ngx';
import { AlertController, Platform } from '@ionic/angular';

declare const Ionic: any;

@Component({
  selector: 'app-badge',
  templateUrl: './badge.page.html',
  styleUrls: ['./badge.page.scss'],
})
export class BadgePage implements OnInit {
  badgeIds = ['badge_gold', 'badge_silver', 'badge_bronze'];
  badges: IAPProduct[] = [];
  badge = { title: '', id: '', description: '' };
  webView = false;
  fakeBadges = [
    {
      id: 'badge_gold',
      title: 'Gold Support',
      description: 'For tier 1 supporters',
      price: '$38.99',
    },
    {
      id: 'badge_silver',
      title: 'Silver Support',
      description: 'For tier 2 supporters',
      price: '$11.99',
    },
    {
      id: 'badge_bronze',
      title: 'Bronze Support',
      description: 'For tier 3 supporters',
      price: '$3.99',
    },
  ];
  loading = false;

  constructor(
    private platform: Platform,
    private store: InAppPurchase2,
    private alertCtrl: AlertController,
    private ref: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.webView = Ionic.WebView;
    this.platform.ready().then(() => {
      if (!this.webView) {
        /*
        this.badge = {
          id: 'badge_bronze',
          title: 'Bronze Support',
          description: 'For tier 3 supporters',
        };
        */
        return;
      }

      this.loading = true;
      this.registerProducts();
      this.setupListeners();

      this.store.ready(() => {
        this.loading = false;
        // https://github.com/j3k0/cordova-plugin-purchase/issues/1316
        this.badges = this.store.products.filter((p) =>
          this.badgeIds.find((id) => id === p.id)
        );
        this.ref.detectChanges();
      });
    });
  }

  registerProducts() {
    this.badgeIds.forEach((id) => {
      this.store.register({
        id,
        type: this.store.NON_CONSUMABLE,
      });
    });

    this.store.refresh();
  }

  setupListeners() {
    this.store
      .when('product')
      .approved((p: IAPProduct) => {
        // https://github.com/j3k0/cordova-plugin-purchase/issues/1316
        if (!this.badgeIds.find((id) => id === p.id)) {
          return;
        }

        this.loading = false;
        this.badge = p;
        this.ref.detectChanges();

        return p.verify();
      })
      .cancelled(() => {
        this.loading = false;
      })
      .verified((p: IAPProduct) => p.finish());

    this.store.error(() => {
      this.loading = false;
    });
  }

  purchase(product: IAPProduct) {
    this.store.order(product).then(
      () => {},
      (e: Error) => {
        this.presentAlert('Failed', `Failed to purchase: ${e}`);
      }
    );
  }

  restore() {
    this.store.refresh();
  }

  async presentAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK'],
    });

    await alert.present();
  }
}
