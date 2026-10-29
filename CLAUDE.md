# WaveLab

## Purpose
A companion to The Pudding's "Let's Learn About Waveforms"
(pudding.cool/2018/02/waveforms/). Students use it side by side with
the essay in split screen, not in separate tabs. It builds on the essay
with hands-on rounds on waveforms, harmonics and phase, and gives me
something to grade. It is not meant to replace the essay.

## Hard rules
- No backend, and no student data ever leaves the browser. Progress is
  saved only in the student's own browser (localStorage, no names) so
  they can stop and come back.
- Students show work with a code (compressed, base64url) pasted into
  Google Classroom.
- Must run well on Chromebooks and stay lightweight.
- Repo: github.com/mr-comiskey-music-ed/WaveLab. Deployed on Vercel at
  its own mrcomiskey.com subdomain. Work on a branch and don't push to
  main unless I say so.

## Structure
- Vite + React + TypeScript. `npm run dev` serves on port 3000.
- Fresh rewrite as the Pudding companion, merged to main and live
  (2026-10-18). Don't revert to the old version's approach.
- A pop-up explains how to set up split screen with the essay
  (`src/components/SplitHelp.tsx`).
- Seven stations, each tied to a section of the essay
  (`src/stations/`): 1 Reading waveforms, 2 How sound works,
  3 Harmonics, 4 Additive (includes the Hammond drawbars), 5 Phase,
  6 Chords, 7 Make a sound. Stations 1–6 are auto-graded; 7 is graded
  by me.
- Phase rounds use my own recordings (`public/audio/`): bass DI/amp,
  snare top/bottom, overheads, and bus hum (noise-cancelling round).

## Grading (built, merged 2026-10-27)
- Teacher grading mostly uses a student's own page, so the teacher
  view gives a fuller picture than scores alone. Keep it that way.
- Multiple choice shows per-question detail.
- Additive and phase rounds show the student's answer side by side
  with the target, with playback.
- A simple per-question class percentage is shown below the table.
- Percentages, not stars. Students see words ("Correct", "Close"), not
  numbers.

## Working style
Start from the teaching goal, then shape features around it. Suggest
ideas and angles before building. Ask before big changes.
