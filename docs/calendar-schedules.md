# Current-week student schedules

The desktop app reads Google Calendar directly using the existing read-only OAuth
connection from Google Calendar Magic Opener. `calendar-schedules.js` runs only in
Electron's main process. Tokens never enter React, Firebase, or the student portal.
The default token location is `~/MyAutoScripts/5- My Programs/1- Google Calender Magic Opener/Support Files/token.json`.
For another installation (including Windows), set `QURAN_CALENDAR_TOKEN_PATH` to its
existing authorized-user token file before launching the desktop app. Refreshed
access tokens stay in memory; the other program's token file is not changed.

The student editor fills the schedule when its student-portal panel opens and has
a refresh button. While running, the main app checks all active students every
minute and on focus/reconnection. Changes use the existing local-save/cloud-sync
pipeline. The background pass pauses while a student is being edited; saving the
form includes its newly fetched schedule. No Calendar events are modified.

Matching is exact and case-sensitive, ignoring only surrounding whitespace.
Only selected, non-hidden calendars are read, including every response page.
Recurring instances, reschedules and cancellations come from Google's API. A
failed calendar read rejects the whole refresh and preserves saved data.

The week is Saturday 00:00 inclusive through the following Saturday 00:00 exclusive
in `Africa/Cairo`, independent of the attendance month shown in the app. Both
boundaries are converted separately for DST. Each class is displayed in the event's
timezone, then the calendar's timezone as fallback. Structured occurrences retain
absolute dates so the portal never invents next-week occurrences or computes the
countdown using the viewer's timezone.

`scheduleMessage` stays compatible with the previous portal. `calendarSchedule`
adds the week boundaries, matched name, slots, and snapshot time. Successful empty
weeks replace the old schedule. Identical schedules do not trigger repeated cloud
writes merely because they were checked again.

The student portal polls its student record every minute and on returning online
or to the page, and hides expired calendar weeks. The last synced current-week
schedule remains available when the desktop app is closed; fresh Calendar changes
require the desktop app to be running and connected. Hosting must publish the
updated `student-web-app/index.html` to enable structured dates and expiry display.

Validation: `node --test tests/calendar-schedules.test.cjs`, `npm run build`.
Browser integration: `CALENDAR_UI_TESTS=1 node --test tests/calendar-ui.test.cjs`
(set `CHROME_PATH` if Chrome is installed elsewhere). This uses fixture records;
it never writes to the production database.

API contracts: https://developers.google.com/workspace/calendar/api/v3/reference/events/list
and https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list.

## Review of colors, moves and fixed days

The desktop **مراجعة الكاليندر** button shows a persistent queue. The background
scan records observations and proposals only; attendance and fixed days change
only after a teacher selects an action, reviews its preview, and confirms it.
Ignoring a change also persists, so unchanged polls and app restarts do not repeat
the same question. Meaningful subsequent changes can produce a new question.

Explicit event colors 2/10 propose a blue planned-class ring. Colors 4/11 ask the
teacher to distinguish student apology, chargeable student absence, and teacher
apology. Calendar background colors do not imply attendance. Non-recurring events
also propose a scheduled class or a makeup. Recurring occurrence identity uses
its original start, so moving it is distinguished from adding a new occurrence.

Review reads cover the previous, current and next Cairo weeks. Schedule messages
still include the current week only. Recurrence masters plus next-week original
occurrences provide fixed-day proposals only for complete, unbounded weekly
rules. Finite, irregular or incomplete recurrence evidence never automatically
becomes a permanent weekly schedule. Actual Google events are never edited.

Observations and decisions live under each student's `calendarReview` and use the
existing cloud sync. Event identities are hashed; OAuth tokens and calendar account
IDs are not published. Pending color evidence remains visible if another script
resets the color or archives the event; the card explains that the event/color has
changed. Colors changed and removed while the desktop is closed cannot be recovered
from a later snapshot. The `ي-منتهي` archive does not generate new review proposals.

Approval checks the latest application data against the preview. Recorded states
need an extra replacement checkbox. Saved reports/drafts and existing makeup
links block automatic replacement and require manual review. Moving a class edits
only its two concrete dates (including across months), not all recurring weekdays.
Multi-class source days require manual review; adding to an already scheduled
target requires explicitly selecting a second class. Makeup linking uses the app's
existing same-month link model; cross-month makeup links require manual handling.

Fixed weekday changes have a teacher-chosen effective date, no earlier than today.
`scheduleHistory` preserves previous configurations. Attendance counts, student and
academy reports, and the student portal use the configuration effective on each
date. A later manual edit of a versioned schedule also preserves its history.
Existing recorded classes affected by a new weekly rule block that start date.

Tests: `node --test tests/calendar-review.test.cjs` and
`CALENDAR_UI_TESTS=1 node --test tests/calendar-review-ui.test.cjs`.
The browser tests use fixture data only, never the production database.
