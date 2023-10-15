# MuseTrainer

Source code of https://musetrainer.com.

## Status

Unmaintained. Fork this to fix bugs or add new features.


## Setup

- Dependencies:

```sh
npm i -g @ionic/cli
ionic capacitor copy ios && ionic capacitor update
ionic capacitor run ios -l --external
```


- To make Piano sounds work on iOS:

Remove `mp3` out of `isMediaExtension` in `node_modules/@capacitor/ios/Capacitor/Capacitor/WebViewAssetHandler.swift`

```swift
    func isMediaExtension(pathExtension: String) -> Bool {
        let mediaExtensions = ["m4v", "mov", "mp4",
                               "aac", "ac3", "aiff", "au", "flac", "m4a", "wav"]
        if mediaExtensions.contains(pathExtension.lowercased()) {
            return true
        }
        return false
    }
```

## How play modes work

There are 2 cursors: 0 for Play (auto or manual) and 1 for Tempo.

The Play cursor calculates required notes in the current cursor, then listen for pressed notes and keep track of
which notes are pressed. If they are all pressed correctly, advance forward.

The Tempo cursor calculates timeout based on the notes' timestamp of the current cursor, then set the timeout to loop.
In Listen mode, it will trigger playing the required notes which are calculated by Play cursor to make the Play cursor
advance.

All logic above happens at the same time with virtual keyboard update, built-in sound play or MIDI device signal.

## Credit

This is a fork of https://github.com/rvilarl/pianoplay with iOS support.
