import { Component, OnInit } from '@angular/core';
import { Meta } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit {
  constructor(private metaTagService: Meta) {}

  ngOnInit(): void {
    this.metaTagService.addTags([
      {
        name: 'keywords',
        content: 'MusicXML, practice piano, MIDI keyboard, iPad',
      },
      {
        name: 'description',
        content: 'Piano trainer using MusicXML for iPad',
      },
      { name: 'robots', content: 'index, follow' },
    ]);
  }
}
