# Student Web Portal

This app is the student-facing portal for Quran Classes Tracker.

## Implemented Phase 5 Features

- Assigned Tajweed homework list (pending assignments per student).
- Tajweed quiz solving UI with 3 question types:
  - Text answer
  - Multiple choice
  - Audio recording
- Audio recorder integration using `MediaRecorder`.
- Submission flow to Firebase:
  - Creates `tajweedSubmissions/{submissionId}`
  - Updates `tajweedAssignments/{assignmentId}` to `submitted`
- Tajweed history screen:
  - Submitted and graded assignments
  - Per-question grades and teacher notes
  - Overall feedback and final score
- Existing attendance and latest report overview remains available.

## URL Contract

The portal expects the student id in query params:

`?student=<studentId>`

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
