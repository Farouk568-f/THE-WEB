# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Add your intro video as `public/intro.mp4` (for TV series intro feature)
4. Run the app:
   `npm run dev`

## Features

### Intro Player
- Automatic intro playback for TV series before episode starts
- Skip intro button with 5-second countdown
- Integrated with main player controls
- User settings to enable/disable intro
- Seamless transition from intro to episode content
