import { Component, OnInit } from '@angular/core';

declare const Ionic: any;

@Component({
  selector: 'app-index',
  templateUrl: './index.page.html',
  styleUrls: ['./index.page.scss'],
})
export class IndexPage implements OnInit {
  webView = false;
  constructor() {}

  ngOnInit() {
    this.webView = Ionic.WebView;
  }
}
