# ChordBars

Turn a YouTube song into a beat-by-beat chord note:

```text
|C _ _ _ |G _ _ _ |Am _ _ _ |F _ _ _ |
```

Then **Print / Save PDF** for a practice sheet.

## Features

- Paste a YouTube URL → automatic chord estimation
- Demo progression + local audio upload fallback
- Notation with bars (`|`) and held beats (`_`)
- Browser print → PDF

## Setup

```bash
cd chord-chart
npm install
pip3 install -r requirements.txt
# yt-dlp + ffmpeg required for YouTube downloads
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How analysis works

1. Download (or upload) audio
2. Build a chromagram and match major/minor chord templates
3. Estimate tempo and quantize chords to 4/4 beats
4. Format bars as `|C _ _ _ | G _ _ _ | …`

Chord detection is an automatic estimate from the mix — not an official tab.

## Scripts

| Command        | Description                |
| -------------- | -------------------------- |
| `npm run dev`  | Development server         |
| `npm run build`| Production build           |
| `npm run start`| Run production server      |
| `npm run lint` | ESLint                     |
