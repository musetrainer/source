import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Filesystem, Directory, FileInfo } from '@capacitor/filesystem';
import {
  AlertController,
  ToastController,
  Platform,
  NavController,
} from '@ionic/angular';
import { File, FilePicker } from '@capawesome/capacitor-file-picker';
import { Device } from '@capacitor/device';

const APP_DIRECTORY = Directory.Documents;

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
  folderContent: FileInfo[] = [];
  currentFolder = '';
  currentFolderTitle = '';

  @ViewChild('filepicker') uploader = {} as ElementRef;

  constructor(
    public navCtrl: NavController,
    private route: ActivatedRoute,
    private alertCtrl: AlertController,
    private router: Router,
    private toastCtrl: ToastController,
    private platform: Platform
  ) {}

  ngOnInit() {
    this.currentFolder = this.route.snapshot.paramMap.get('folder') || '';
    this.loadDocuments();
  }

  async loadDocuments() {
    const dir = await Filesystem.readdir({
      directory: APP_DIRECTORY,
      path: this.currentFolder,
    });

    this.folderContent = dir.files;

    this.platform.ready().then(() => {
      Device.getInfo().then((dvc) => {
        this.currentFolderTitle =
          this.currentFolder || (dvc.name ? `On this ${dvc.name}` : 'Home');
      });
    });
  }

  async createFolder() {
    const alert = await this.alertCtrl.create({
      header: 'New folder',
      inputs: [
        {
          id: 'new-folder-alert',
          name: 'name',
          type: 'text',
          placeholder: 'Folder name',
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Create',
          handler: async (data) => {
            await Filesystem.mkdir({
              directory: APP_DIRECTORY,
              path: `${this.currentFolder}/${data.name}`,
            });
            this.loadDocuments();
          },
        },
      ],
    });

    await alert.present();
    const input: HTMLElement | null =
      document.querySelector('#new-folder-alert');
    input?.focus();
  }

  async addFile() {
    try {
      const { files } = await FilePicker.pickFiles({
        types: [
          'application/vnd.recordare.musicxml',
          'application/vnd.recordare.musicxml+xml',
        ],
        multiple: false,
        readData: true,
      });
      this.fileSelected(files[0]);
    } catch (e) {
      // Ignore canceled pick files
    }
  }

  async fileSelected(selected: File) {
    const data = selected.data;
    if (!data) {
      return;
    }

    await Filesystem.writeFile({
      directory: APP_DIRECTORY,
      path: `${this.currentFolder}/${selected.name}`,
      data,
    });

    this.loadDocuments();
  }

  async itemClicked(entry: FileInfo) {
    if (entry.type === 'file') {
      const file = encodeURIComponent(entry.uri);
      this.router.navigateByUrl(`/play/${file}`);
    } else {
      const pathToOpen =
        this.currentFolder != ''
          ? this.currentFolder + '/' + entry.name
          : entry.name;
      const folder = encodeURIComponent(pathToOpen);
      this.router.navigateByUrl(`/index/home/${folder}`);
    }
  }

  async rename(entry: FileInfo) {
    const alert = await this.alertCtrl.create({
      header: 'Rename',
      inputs: [
        {
          id: 'rename-alert',
          name: 'name',
          type: 'text',
          placeholder: 'New name',
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Rename',
          handler: async (data) => {
            const fromURI = await Filesystem.getUri({
              directory: APP_DIRECTORY,
              path: `${this.currentFolder}/${entry.name}`,
            });

            const toName =
              entry.type === 'file'
                ? `${data.name}.${entry.name.split('.').pop()}`
                : data.name;

            const toURI = await Filesystem.getUri({
              directory: APP_DIRECTORY,
              path: `${this.currentFolder}/${toName}`,
            });

            await Filesystem.rename({
              from: fromURI.uri,
              to: toURI.uri,
            });

            this.loadDocuments();
          },
        },
      ],
    });

    await alert.present();
    const input: HTMLElement | null = document.querySelector('#rename-alert');
    input?.focus();
  }

  async delete(entry: FileInfo) {
    const alert = await this.alertCtrl.create({
      header: 'Are you sure to delete this?',
      subHeader: entry.name,
      buttons: [
        {
          text: 'No',
          role: 'cancel',
        },
        {
          text: 'Yes',
          handler: () => this.deleteConfirm(entry),
        },
      ],
    });

    await alert.present();
  }

  async deleteConfirm(entry: FileInfo) {
    if (entry.type === 'file') {
      await Filesystem.deleteFile({ path: entry.uri });
    } else {
      await Filesystem.rmdir({
        path: entry.uri,
        recursive: true,
      });
    }

    this.loadDocuments();
    const toast = await this.toastCtrl.create({
      message: `Deleted ${entry.type === 'file' ? 'file' : 'folder'} ${
        entry.name
      }`,
      position: 'bottom',
      duration: 3000,
      icon: 'checkmark-circle-outline',
    });
    await toast.present();
  }

  fileSize(b: number) {
    let u = 0;
    let s = 1024;
    while (b >= s || -b >= s) {
      b /= s;
      u++;
    }
    return (u ? b.toFixed(1) + ' ' : b) + ' KMGTPEZY'[u] + 'B';
  }
}
