# Public Chinese voice clips

These79 MP3 clips were recorded once from macOS system voice Tingting (190 words/minute), then encoded as mono24kHz48kbps MP3. They contain only the committed current and historical public voice templates and reusable Chinese number/list atoms. No player recording, microphone, private role results, live input or external TTS service is used.

Current playback is night-only; daytime stays silent. Playback fetches static same-origin files, decodes/caches them on the device, and assembles the current **public** prompt. Multiple seats retain separate numbers (the list separator is read as “和”). Unknown phrases are rejected. The existing room lease, foreground, scope and cancellation checks govern playback.

Offline maintenance only: `node --import tsx scripts/generate-public-voice.ts` on a Mac with system Tingting and ffmpeg. The script is never called by the application or build; it validates decoded non-silent audio before writing the manifest. Sandbox access to the native speech service may require the platform's approval. Existing valid clips are reused.

Static filenames are derived from normalized public text, not user identifiers. The browser module and manifest are loaded only when recorded playback is requested. Actual device sound remains separate from browser waveform/state checks.
