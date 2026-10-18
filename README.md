# WaveLab

A lab companion to The Pudding's interactive [Waveforms site](https://pudding.cool/2018/02/waveforms/).
Students read the Waveforms site on one half of the screen and work through WaveLab on the other.
Each station opens with a pop-up that jumps the Waveforms window to the right section.

## Stations

| # | Station | Pudding section | Students should be able to... |
|---|---------|-----------------|-------------------------------|
| 1 | Reading waveforms | 1. Reading Waveforms | read loudness and pitch off a graph before hearing it |
| 2 | How sound works | 2. How Sound Works | connect the graph to a speaker cone and moving air |
| 3 | Harmonics | 3. Harmonics | name sine, triangle, square and saw by ear and by their harmonics |
| 4 | Additive synthesis | 4. Additive Synthesis | rebuild a sound from sine harmonics by ear |
| 5 | Phase | 4a. Phase | fix phase in 4 real cases: bass DI vs amp mic (DAW), snare polarity, overhead placement, noise-cancelling headphones |
| 6 | Chords | 4b. Chords | see a chord as added waves; match each interval on a piano to its added waveform |
| 7 | Make a sound | In Conclusion | design a sound for a brief and explain it with harmonics |

Stations 1–6 are auto-graded: every student gets different random questions, one try per round.
Right/wrong rounds are worth 100 or 50; slider/matching rounds earn 50–100. Students see words, not numbers.
Station 7 is for the teacher to grade (the grader plays each student's sound in its brief's loop).
Progress saves in the student's browser (localStorage, no name), so they can stop and come back.

## Grading

Open **Teacher tools** (`?teacher`, linked at the bottom) to make an assignment link for just some sections
(`?s=read,harm`), and to grade: paste a whole column of codes and download a CSV. Students click **Get my code**
and paste the code into Google Classroom. Nothing is sent anywhere.

## Development

```
npm install
npm run dev
```
