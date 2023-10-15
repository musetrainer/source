import { Injectable } from '@angular/core';
import { Cursor } from 'opensheetmusicdisplay';

export type NoteObject = {
  value: number;
  key: string;
  timestamp: number;
  staffId: number;
  voice: number;
  fingering: string;
  isGrace: boolean;
};

@Injectable({
  providedIn: 'root',
})
export class NotesService {
  mapPressed: Map<string, number> = new Map();
  // Initialize maps of notes comming from Music Sheet
  mapRequired = new Map<string, NoteObject>();
  mapPrevRequired = new Map<string, NoteObject>();
  tempoInBPM: number;

  constructor() {
    this.tempoInBPM = 120;
  }

  getMapRequired(): Map<string, NoteObject> {
    return this.mapRequired;
  }

  getMapPrevRequired(): Map<string, NoteObject> {
    return this.mapPrevRequired;
  }

  getMapPressed(): Map<string, number> {
    return this.mapPressed;
  }

  clear(): void {
    this.mapPressed.clear();
    this.mapRequired.clear();
    this.mapPrevRequired.clear();
  }

  press(name: string): void {
    this.mapPressed.set(name, 1);
  }

  release(name: string): void {
    this.mapPressed.delete(name);
  }

  // Check that new notes have been pressed since the last succesful check (value===1)
  private isNewRequiredNotesPressed(): boolean {
    for (const [, noteObj] of this.mapRequired) {
      if (noteObj.value === 0) {
        if (this.mapPressed.has(noteObj.key)) {
          if ((this.mapPressed.get(noteObj.key) ?? -1) > 1) return false;
        } else {
          return false;
        }
      }
    }
    return true;
  }

  // Check required notes, if successful go to next cursor
  isRequiredNotesPressed(): boolean {
    // Check only new notes, hold notes with pedals would be to difficult
    if (this.isNewRequiredNotesPressed() === true) {
      // Check that no pressed key is unexpected (red key)
      for (const [key] of this.mapPressed) {
        if (!this.mapRequired.has(key)) return false;
      }

      // Mark all the notes as no longer new, go to next cycle
      for (const [key, value] of this.mapPressed) {
        this.mapPressed.set(key, value + 1);
      }

      return true;
    }
    return false;
  }

  // Calculate required notes deleting outphased onces and keeping track of new notes
  calculateRequired(
    cursor: Cursor,
    staffIdEnabled: Record<number, boolean>,
    back = false
  ): void {
    // Get current source time stamp
    const timestamp = cursor.iterator.CurrentSourceTimestamp.RealValue;

    // Keep track of previous to avoid red keys before release, increment value
    this.mapPrevRequired.clear();
    for (const [key, noteObj] of this.mapRequired) {
      this.mapPrevRequired.set(key, noteObj);
      this.mapRequired.set(key, { ...noteObj, value: noteObj.value + 1 });
    }

    // Delete expired notes
    for (const [key, value] of this.mapRequired) {
      if (back || timestamp >= value.timestamp) {
        this.mapRequired.delete(key);
      }
    }

    // Register new notes under the cursor
    cursor.VoicesUnderCursor().forEach((voice) => {
      voice.Notes.forEach((value) => {
        this.tempoInBPM = value.SourceMeasure.TempoInBPM;
        // value.ParentStaff.idInMusicSheet = 0,1,2,3
        // value.ParentStaff.Id = 1,2
        if (staffIdEnabled[value.ParentStaff.idInMusicSheet]) {
          // Only honor rests in listen mode
          if (value.isRest() === false) {
            const noteString = value.halfTone.toString();
            const noteTimestamp = timestamp + value.Length.RealValue;
            const fingering = value.Fingering ? value.Fingering.value : '';

            const noteObj = {
              value: 0,
              key: noteString,
              timestamp: noteTimestamp,
              staffId: value.ParentStaff.Id,
              voice: voice.ParentVoice.VoiceId,
              fingering: fingering,
              isGrace: value.IsGraceNote,
            };

            // In case of tie, check that it is a start note
            if (
              typeof value.NoteTie === 'undefined' ||
              value === value.NoteTie.StartNote
            ) {
              this.mapRequired.set(noteString, noteObj);
            } else {
              this.mapRequired.set(noteString, {
                ...noteObj,
                value: 1,
              });
            }
          }
        }
      });
    });
  }

  // Update note status for piano keyboard
  playRequiredNotes(
    notePress: (note: number, velocity: number) => void,
    noteRelease: (note: number) => void
  ): void {
    // Release notes no longer required
    for (const [key] of this.mapPressed) {
      if (!this.mapRequired.has(key)) {
        noteRelease(parseInt(key) + 12);
      }
    }

    // Press new notes
    for (const [key, value] of this.mapRequired) {
      if (value.value === 0) {
        // If already pressed, release first
        if (this.mapPressed.has(key)) {
          noteRelease(parseInt(key) + 12);
        }
        notePress(parseInt(key) + 12, 60);
      }
    }
  }
}
