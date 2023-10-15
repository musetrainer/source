import { Component, OnInit, ViewChild } from '@angular/core';
import {
  IonContent,
  NavController,
  Platform,
  RangeCustomEvent,
  RefresherCustomEvent,
  ToastController,
} from '@ionic/angular';
import { Piano } from '@tonejs/piano';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { CapacitorMuseTrainerMidi } from 'capacitor-musetrainer-midi';
import { ActivatedRoute } from '@angular/router';
import { KeepAwake } from '@capacitor-community/keep-awake';

import { NotesService } from '../notes.service';
import { PianoKeyboardComponent } from '../piano-keyboard/piano-keyboard.component';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import packageJson from '../../../package.json';

declare const Ionic: any;

@Component({
  selector: 'app-home',
  templateUrl: 'play.page.html',
  styleUrls: ['play.page.scss'],
})
export class PlayPageComponent implements OnInit {
  @ViewChild(IonContent, { static: false }) content!: IonContent;
  @ViewChild(PianoKeyboardComponent)
  private pianoKeyboard?: PianoKeyboardComponent;
  openSheetMusicDisplay!: OpenSheetMusicDisplay;

  playVersion = '';

  // Music Sheet GUI
  isMobileLayout = false;
  staffIdList: number[] = [];
  staffIdEnabled: Record<number, boolean> = {};
  listenMode: boolean = false;
  fileLoadError: boolean = false;
  fileLoaded: boolean = false;
  running: boolean = false;
  checkboxColor: boolean = false;
  checkboxKeyboard: boolean = true;
  checkboxMidiOut: boolean = false;
  checkboxFeedback: boolean = false;
  inputMeasure = { lower: 0, upper: 0 };
  inputMeasureRange = { lower: 0, upper: 0 };
  checkboxRepeat: boolean = false;
  repeatValue: number = 0;
  repeatCfg: number = 10;
  zoomValue: number = 1;
  zoomText: string = '100%';
  startFlashCount: number = 0;

  // MIDI Devices
  midiAvailable = false;
  midiDevice = 'None';

  // Initialize maps of notes comming from MIDI Input
  mapNotesAutoPressed = new Map();

  // Play
  timePlayStart: number = 0;
  skipPlayNotes: number = 0;
  tempoInBPM: number = 120;
  speedValue: number = 100;
  timeouts: NodeJS.Timeout[] = [];

  // tonejs/piano
  piano: Piano | null = null;
  // Midi handlers
  midiHandlers: PluginListenerHandle[] = [];

  constructor(
    public platform: Platform,
    public navCtrl: NavController,
    private notesService: NotesService,
    private toastCtrl: ToastController,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.playVersion = packageJson.version;
    this.openSheetMusicDisplay = new OpenSheetMusicDisplay('osmdContainer');
    this.openSheetMusicDisplay.setOptions({
      backend: 'svg',
      drawTitle: true,
      coloringMode: this.checkboxColor ? 1 : 0,
      followCursor: true,
      useXMLMeasureNumbers: false,
      cursorsOptions: [
        { type: 1, color: '#33e02f', alpha: 0.8, follow: true },
        { type: 2, color: '#ccc', alpha: 0.8, follow: false },
      ],
    });
    // Adjust zoom for mobile devices
    if (window.innerWidth <= 991) {
      this.isMobileLayout = true;
      this.zoomValue = 0.7;
      this.zoomText = this.zoomValue * 100 + '%';
      this.openSheetMusicDisplay.zoom = this.zoomValue;
    }
  }

  ionViewWillEnter() {
    this.platform.ready().then(() => {
      this.pianoSetup();
      this.midiSetup();
      this.keepAwake();
    });
  }

  ionViewDidEnter() {
    const fileURI =
      this.route.snapshot.paramMap.get('file') ||
      this.route.snapshot.queryParamMap.get('file');
    if (fileURI) {
      const src = Capacitor.convertFileSrc(fileURI);
      if (src.startsWith('/DOCUMENTS') && !Ionic.WebView) {
        Filesystem.readFile({ path: src }).then((file) => {
          fetch(`data:application/octet-stream;base64,${file.data}`).then(
            (res) => res.blob().then((blob) => this.osmdLoadFiles([blob]))
          );
        });
      } else {
        this.osmdLoadURL(src);
      }
    }
  }

  ionViewWillLeave() {
    // osmd
    this.osmdReset();
    this.openSheetMusicDisplay.clear();
    // piano
    this.piano = null;
    // wake
    this.allowSleep();
    // midi
    this.midiRelease();
  }

  pianoSetup() {
    let url = '/assets/audio';
    if (Ionic.WebView) {
      url = 'capacitor://localhost/assets/audio';
    }

    // create the piano and load 1 velocity steps to reduce memory consumption
    this.piano = new Piano({
      url,
      velocities: 1,
    });

    //connect it to the speaker output
    this.piano.toDestination();
    this.piano.load();
  }

  // GUI Zoom
  updateZoom(qp: string): void {
    this.zoomValue = parseInt(qp) / 100;
    if (isNaN(this.zoomValue)) this.zoomValue = 1;
    if (this.zoomValue < 0.1) this.zoomValue = 0.1;
    if (this.zoomValue > 2) this.zoomValue = 2;
    this.zoomText = (this.zoomValue * 100).toFixed(0) + '%';
    this.openSheetMusicDisplay.Zoom = this.zoomValue;
    this.openSheetMusicDisplay.render();
  }

  // GUI Play speed
  updateSpeed(qp: string): void {
    let speedInt = parseInt(qp);
    if (isNaN(speedInt)) speedInt = 100;

    if (speedInt < 30) speedInt = 30;
    if (speedInt > 180) speedInt = 180;

    this.speedValue = speedInt;
  }

  // GUI Repeat
  updateRepeat(): void {
    if (this.checkboxRepeat) {
      this.repeatValue = this.repeatCfg;
    } else {
      this.repeatValue = 0;
    }
  }

  listMeasure(): number[] {
    const from = this.inputMeasureRange.lower;
    const range = this.inputMeasureRange.upper - from + 1;
    return Array.from(Array(range).keys(), (item) => item + from);
  }

  // GUI Lower measure
  updateLowerMeasure(qp: string): void {
    this.inputMeasure.lower = parseInt(qp);
    if (isNaN(this.inputMeasure.lower)) {
      this.inputMeasure.lower = this.inputMeasureRange.lower;
    }
    if (this.inputMeasure.lower < this.inputMeasureRange.lower) {
      this.inputMeasure.lower = this.inputMeasureRange.lower;
    }
    // Push upper if required
    if (this.inputMeasure.lower > this.inputMeasure.upper) {
      if (this.inputMeasure.lower > this.inputMeasureRange.upper) {
        this.inputMeasure.lower = this.inputMeasureRange.upper;
      }
      this.inputMeasure.upper = this.inputMeasure.lower;
    }
  }

  // GUI Upper Measure
  updateUpperMeasure(qp: string): void {
    this.inputMeasure.upper = parseInt(qp);
    if (isNaN(this.inputMeasure.upper)) {
      this.inputMeasure.upper = this.inputMeasureRange.upper;
    }
    if (this.inputMeasure.upper > this.inputMeasureRange.upper) {
      this.inputMeasure.upper = this.inputMeasureRange.upper;
    }
    // Push lower if required
    if (this.inputMeasure.upper < this.inputMeasure.lower) {
      if (this.inputMeasure.upper < this.inputMeasureRange.lower) {
        this.inputMeasure.upper = this.inputMeasureRange.lower;
      }
      this.inputMeasure.lower = this.inputMeasure.upper;
    }
  }

  // Load selected file
  osmdLoadFiles(files: Blob[]): void {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      const reader = new FileReader();
      reader.onload = (event: ProgressEvent<FileReader>) => {
        // Load Music Sheet
        this.openSheetMusicDisplay
          .load(event.target?.result?.toString() ?? '')
          .then(
            () => {
              this.openSheetMusicDisplay.zoom = this.zoomValue;
              this.openSheetMusicDisplay.render();
              this.fileLoaded = true;
              this.fileLoadError = false;
              this.osmdReset();
            },
            () => {
              this.fileLoaded = false;
              this.fileLoadError = true;
            }
          );
      };
      reader.readAsBinaryString(file);
    }
  }

  // Load selected file
  osmdLoadURL(url: string): void {
    // Load Music Sheet
    this.openSheetMusicDisplay.load(url).then(
      () => {
        this.openSheetMusicDisplay.zoom = this.zoomValue;
        this.openSheetMusicDisplay.render();
        this.fileLoaded = true;
        this.fileLoadError = false;
        this.osmdReset();
      },
      () => {
        this.fileLoaded = false;
        this.fileLoadError = true;
      }
    );
  }

  startListen(): void {
    this.updateRepeat();
    this.osmdStop();
    this.osmdListen();
  }

  startPractice(): void {
    this.updateRepeat();
    this.osmdStop();
    this.osmdPractice();
  }

  isListening(): boolean {
    return this.running && this.listenMode;
  }

  isPracticing(): boolean {
    return this.running && !this.listenMode;
  }

  // Reset selection on measures and set the cursor to the origin
  osmdReset(): void {
    this.osmdStop();
    this.inputMeasure.lower = 1;
    this.inputMeasure.upper =
      this.openSheetMusicDisplay.Sheet.SourceMeasures.length;
    this.inputMeasureRange.lower = 1;
    this.inputMeasureRange.upper =
      this.openSheetMusicDisplay.Sheet.SourceMeasures.length;

    this.staffIdList = this.openSheetMusicDisplay.Sheet.Staves.map(
      (s) => s.idInMusicSheet
    );
    this.staffIdEnabled = this.staffIdList
      .map((id) => ({ [id]: true }))
      .reduce((a, b) => ({ ...a, ...b }));
  }

  osmdStop(): void {
    this.running = false;
    this.osmdCursorStop();
    this.timeouts.map((to) => clearTimeout(to));
    this.timeouts = [];
  }

  // Play
  osmdListen(): void {
    this.running = true;
    this.skipPlayNotes = 0;
    this.osmdResetFeedback();
    this.listenMode = true;
    this.startFlashCount = 0;
    this.osmdCursorStart();
  }

  // Practice
  osmdPractice(): void {
    this.running = true;
    this.skipPlayNotes = 0;
    this.osmdResetFeedback();
    this.listenMode = false;
    this.startFlashCount = 4;
    this.osmdCursorStart();
  }

  // Move cursor to next note
  osmdCursorMoveNext(index: number): boolean {
    this.openSheetMusicDisplay.cursors[index].next();
    // Move to first valid measure
    if (
      this.inputMeasure.lower >
      this.openSheetMusicDisplay.cursors[index].iterator.CurrentMeasureIndex + 1
    ) {
      return this.osmdCursorMoveNext(index);
    }
    return true;
  }

  // Move cursor to next note
  osmdCursorTempoMoveNext(): void {
    // Required to stop next calls if stop is pressed during play
    if (!this.running) return;

    if (!this.osmdEndReached(1)) this.osmdCursorMoveNext(1);

    // if ended reached check repeat and start or stop
    if (this.osmdEndReached(1)) {
      // Caculate time to end of compass
      const iter = this.openSheetMusicDisplay.cursors[1].iterator;
      const timeout =
        (((iter.CurrentMeasure.AbsoluteTimestamp.RealValue +
          iter.CurrentMeasure.Duration.RealValue -
          iter.CurrentSourceTimestamp.RealValue) *
          4 *
          60000) /
          this.tempoInBPM /
          this.speedValue) *
        100;
      this.timeouts.push(
        setTimeout(() => {
          this.openSheetMusicDisplay.cursors[1].hide();
        }, timeout)
      );
    } else {
      // Move to Next
      const iter = this.openSheetMusicDisplay.cursors[1].iterator;
      const it2 = this.openSheetMusicDisplay.cursors[1].iterator.clone();
      it2.moveToNext();
      let timeout =
        (((it2.CurrentSourceTimestamp.RealValue -
          iter.CurrentSourceTimestamp.RealValue) *
          4 *
          60000) /
          this.tempoInBPM /
          this.speedValue) *
        100;

      // On repeat sign, manually calculate
      if (timeout < 0) {
        const currMeasure =
          this.openSheetMusicDisplay.cursors[1].iterator.CurrentMeasure;
        timeout =
          (((currMeasure.AbsoluteTimestamp.RealValue +
            currMeasure.Duration.RealValue -
            iter.CurrentSourceTimestamp.RealValue) *
            4 *
            60000) /
            this.tempoInBPM /
            this.speedValue) *
          100;
      }

      this.timeouts.push(
        setTimeout(() => {
          this.osmdCursorTempoMoveNext();
        }, timeout)
      );
    }

    // Play note in listen mode, so the play cursor can advance forward
    if (this.listenMode) {
      this.playNote();
    }
  }

  osmdEndReached(cursorId: number): boolean {
    // Check end reached
    let endReached = false;
    if (this.openSheetMusicDisplay.cursors[cursorId].iterator.EndReached) {
      endReached = true;
    } else {
      const it2 = this.openSheetMusicDisplay.cursors[cursorId].iterator.clone();
      it2.moveToNext();
      if (
        it2.EndReached ||
        this.inputMeasure.upper < it2.CurrentMeasureIndex + 1
      ) {
        endReached = true;
      }
    }
    return endReached;
  }

  // Move cursor to next note
  osmdCursorPlayMoveNext(): void {
    // Required to stop next calls if stop is pressed during play
    if (!this.running) return;

    // if ended reached check repeat and start or stop
    if (this.osmdEndReached(0)) {
      const iter = this.openSheetMusicDisplay.cursors[0].iterator;
      const timeout =
        (((iter.CurrentMeasure.AbsoluteTimestamp.RealValue +
          iter.CurrentMeasure.Duration.RealValue -
          iter.CurrentSourceTimestamp.RealValue) *
          4 *
          60000) /
          this.tempoInBPM /
          this.speedValue) *
        100;
      this.openSheetMusicDisplay.cursors[0].hide();
      this.timeouts.push(
        setTimeout(() => {
          if (this.repeatValue > 0) {
            this.repeatValue--;
            this.osmdCursorStart();
          } else {
            this.repeatValue = this.repeatCfg;
            this.osmdCursorStop();
          }
        }, timeout)
      );
      return;
    }

    // Move to next
    if (!this.osmdCursorMoveNext(0)) return;

    // Calculate notes
    this.notesService.calculateRequired(
      this.openSheetMusicDisplay.cursors[0],
      this.staffIdEnabled
    );

    this.tempoInBPM = this.notesService.tempoInBPM;

    // Update keyboard
    if (this.pianoKeyboard) this.pianoKeyboard.updateNotesStatus();

    // If ties occured, move to next and skip one additional note
    if (this.notesService.isRequiredNotesPressed()) {
      this.skipPlayNotes++;
      this.osmdCursorPlayMoveNext();
    }
  }

  // Stop cursor
  osmdCursorStop(): void {
    this.listenMode = false;
    this.running = false;

    this.openSheetMusicDisplay.cursors.forEach((cursor) => {
      cursor.reset();
      cursor.hide();
    });
    this.osmdResetFeedback();
    for (const [key] of this.mapNotesAutoPressed) {
      this.keyReleaseNote(parseInt(key) + 12);
    }
    this.mapNotesAutoPressed.clear();
    this.notesService.clear();
    if (this.pianoKeyboard) this.pianoKeyboard.updateNotesStatus();
  }

  // Resets the cursor to the first note
  osmdCursorStart(): void {
    // this.content.scrollToTop();
    this.openSheetMusicDisplay.cursors.forEach((cursor, index) => {
      if (index != 0) cursor.show();
      cursor.reset();
      if (this.listenMode && index == 1) {
        // Comment out this to enable debug mode
        cursor.hide();
      }
    });

    // Additional tasks in case of new start, not required in repetition
    if (this.repeatValue == this.repeatCfg) {
      this.notesService.clear();
      // free auto pressed notes
      for (const [key] of this.mapNotesAutoPressed) {
        this.keyReleaseNote(parseInt(key) + 12);
      }
    }

    this.osmdHideFeedback();

    if (
      this.inputMeasure.lower >
      this.openSheetMusicDisplay.cursors[0].iterator.CurrentMeasureIndex + 1
    ) {
      if (!this.osmdCursorMoveNext(0)) return;
      this.osmdCursorMoveNext(1);
    }

    // Calculate first notes
    this.notesService.calculateRequired(
      this.openSheetMusicDisplay.cursors[0],
      this.staffIdEnabled,
      true
    );

    this.tempoInBPM = this.notesService.tempoInBPM;

    // Update keyboard
    if (this.pianoKeyboard) this.pianoKeyboard.updateNotesStatus();
    this.osmdCursorStart2();
  }

  osmdCursorStart2(): void {
    if (this.startFlashCount > 0) {
      if (this.openSheetMusicDisplay.cursors[0].hidden)
        this.openSheetMusicDisplay.cursors[0].show();
      else this.openSheetMusicDisplay.cursors[0].hide();
      this.startFlashCount--;
      this.timeouts.push(
        setTimeout(() => {
          this.osmdCursorStart2();
        }, 1000)
      );
      return;
    }

    this.startFlashCount = 0;
    this.openSheetMusicDisplay.cursors[0].show();
    this.timePlayStart = Date.now();

    // Skip initial rests
    if (this.notesService.isRequiredNotesPressed()) {
      this.skipPlayNotes++;
      this.osmdCursorPlayMoveNext();
    }

    // Play initial notes
    if (this.listenMode) {
      this.playNote();
    }

    const it2 = this.openSheetMusicDisplay.cursors[0].iterator.clone();
    it2.moveToNext();

    const timeout =
      (((it2.CurrentSourceTimestamp.RealValue -
        this.openSheetMusicDisplay.cursors[0].iterator.CurrentSourceTimestamp
          .RealValue) *
        4 *
        60000) /
        this.tempoInBPM /
        this.speedValue) *
      100;
    this.timeouts.push(
      setTimeout(() => {
        this.osmdCursorTempoMoveNext();
      }, timeout)
    );
  }

  playNote(): void {
    if (this.skipPlayNotes > 0) {
      this.skipPlayNotes--;
    } else {
      this.notesService.playRequiredNotes(
        this.keyPressNote.bind(this),
        this.keyReleaseNote.bind(this)
      );
    }
  }

  // Remove all feedback elements
  osmdResetFeedback(): void {
    let elems = document.getElementsByClassName('feedback');
    // Remove all elements
    while (elems.length > 0) {
      for (let i = 0; i < elems.length; i++) {
        const parent = elems[i].parentNode;
        if (parent) parent.removeChild(elems[i]);
      }
      elems = document.getElementsByClassName('feedback');
    }
  }

  // Hide all feedback elements
  osmdHideFeedback(): void {
    document.querySelectorAll<HTMLElement>('.feedback').forEach(function (el) {
      el.style.visibility = 'hidden';
    });
  }

  // Hide all feedback elements
  osmdShowFeedback(): void {
    document.querySelectorAll<HTMLElement>('.feedback').forEach(function (el) {
      el.style.visibility = 'visible';
    });
  }

  // Present feedback text at cursor location
  osmdTextFeedback(text: string, x: number, y: number): void {
    const id =
      (document.getElementById('cursorImg-0')?.style.top ?? '') +
      x +
      '_' +
      (document.getElementById('cursorImg-0')?.style.left ?? '') +
      y +
      '_' +
      this.repeatValue;

    const feedbackElementId = `feedback-${id}`;
    const oldElem = document.getElementById(feedbackElementId);
    let color = 'black';
    if (oldElem) {
      oldElem.remove();
      color = 'red';
    }
    const elem: HTMLElement = document.createElement('p');
    elem.id = feedbackElementId;
    elem.className = 'feedback r' + this.repeatValue;
    elem.style.position = 'absolute';
    elem.style.zIndex = '-1';
    elem.innerHTML = text;
    const parent = document.getElementById('osmdCanvasPage1');
    if (parent) parent.appendChild(elem);
    elem.style.top =
      parseInt(document.getElementById('cursorImg-0')?.style.top ?? '') -
      40 -
      y +
      'px';
    elem.style.left =
      parseInt(document.getElementById('cursorImg-0')?.style.left ?? '') +
      x +
      'px';
    elem.style.color = color;
  }

  onSpeedChange(ev: Event) {
    const range = (ev as RangeCustomEvent).detail.value as any;
    if (range) {
      this.updateSpeed(range);
    }
  }

  speedFormatter(s: number) {
    return `${(s / 100).toFixed(1).replace('.0', '')}x`;
  }

  async notifyMidiConnect() {
    const toast = await this.toastCtrl.create({
      message: `MIDI device connected: ${this.midiDevice}. Practice mode enabled.`,
      position: 'bottom',
      duration: 3000,
      icon: 'flash-outline',
    });
    await toast.present();
  }

  async notifyMidiDisconnect() {
    const toast = await this.toastCtrl.create({
      message: `No MIDI devices found. Practice mode disabled.`,
      position: 'bottom',
      duration: 3000,
      icon: 'flash-off-outline',
    });
    await toast.present();
  }

  midiDeviceHandler(devices: any) {
    if (devices.length) {
      this.midiAvailable = true;
      this.midiDevice = devices.join(', ');
      this.notifyMidiConnect();
    } else {
      this.midiAvailable = false;
      this.midiDevice = 'None';
      this.notifyMidiDisconnect();

      // Stop if needed
      if (this.isPracticing()) {
        this.osmdStop();
      }
    }
  }

  async midiRelease() {
    await Promise.all(this.midiHandlers.map((h) => h.remove()));
    this.midiHandlers = [];
  }

  async refreshMidiDevices(event: RefresherCustomEvent) {
    await this.midiRelease();
    await this.midiSetup();
    event.target.complete();
  }

  // Initialize MIDI
  async midiSetup(): Promise<void> {
    const dvc = await CapacitorMuseTrainerMidi.addListener(
      'deviceChange',
      ({ devices }: any) => this.midiDeviceHandler(devices)
    );

    const cmd = await CapacitorMuseTrainerMidi.addListener(
      'commandReceive',
      (note: any) => {
        if (note.type === 'noteOn') {
          this.keyNoteOn(Date.now(), note.dataByte1);
        } else if (note.type === 'noteOff') {
          this.keyNoteOff(Date.now(), note.dataByte1);
        }
      }
    );

    this.midiHandlers.push(dvc, cmd);

    const { devices } = await CapacitorMuseTrainerMidi.listDevices();
    this.midiDeviceHandler(devices);
  }

  // Press note on Ouput MIDI Device
  keyPressNote(pitch: number, velocity: number): void {
    this.mapNotesAutoPressed.set((pitch - 12).toFixed(), 1);
    this.timeouts.push(
      setTimeout(() => {
        this.keyNoteOn(Date.now() - this.timePlayStart, pitch);
      }, 0)
    );

    if (this.midiAvailable && this.checkboxMidiOut) {
      CapacitorMuseTrainerMidi.sendCommand({
        command: [0x90, pitch, velocity],
        timestamp: performance.now(),
      }).catch((e) => console.error(e));
    } else {
      this.piano?.keyDown({ midi: pitch });
    }
  }

  // Release note on Ouput MIDI Device
  keyReleaseNote(pitch: number): void {
    this.mapNotesAutoPressed.delete((pitch - 12).toFixed());
    this.timeouts.push(
      setTimeout(() => {
        this.keyNoteOff(Date.now() - this.timePlayStart, pitch);
      }, 0)
    );

    if (this.midiAvailable && this.checkboxMidiOut) {
      CapacitorMuseTrainerMidi.sendCommand({
        command: [0x80, pitch, 0x00],
        timestamp: performance.now(),
      }).catch((e) => console.error(e));
    } else {
      this.piano?.keyUp({ midi: pitch });
    }
  }

  // Input note pressed
  keyNoteOn(time: number, pitch: number): void {
    const halbTone = pitch - 12;
    const name = halbTone.toFixed();
    this.notesService.press(name);

    // Key wrong pressed
    if (
      !this.notesService.getMapRequired().has(name) &&
      this.isPracticing() &&
      this.checkboxFeedback
    ) {
      this.osmdTextFeedback('&#9888;', 10, 30);
    }

    if (this.pianoKeyboard) this.pianoKeyboard.updateNotesStatus();
    if (this.notesService.isRequiredNotesPressed())
      this.osmdCursorPlayMoveNext();
  }

  // Input note released
  keyNoteOff(time: number, pitch: number): void {
    const halbTone = pitch - 12;
    const name = halbTone.toFixed();
    this.notesService.release(name);

    if (this.pianoKeyboard) this.pianoKeyboard.updateNotesStatus();
    if (this.notesService.isRequiredNotesPressed())
      this.osmdCursorPlayMoveNext();
  }

  // Keep screen on
  keepAwake(): void {
    KeepAwake.isSupported().then((is) => {
      if (is.isSupported) {
        KeepAwake.keepAwake();
      }
    });
  }

  // Allow screen off
  allowSleep(): void {
    KeepAwake.isSupported().then((is) => {
      if (is.isSupported) {
        KeepAwake.allowSleep();
      }
    });
  }
}
