# Profile audit

| Row/control | Current behavior and backing | Decision |
|---|---|---|
| My Nest | Opens the edit sheet; Save calls `saveProfile`, which uses `PUT /me` in real mode and updates Home from the profile state. | KEEP |
| Language | Changes i18next and local preference; the Profile sheet also persists `language` through `PUT /me` for real users. | FIX |
| Watch the story again | Navigates to `/app/story` in replay mode; it does not call `markIntroSeen` or change `introSeen`. | KEEP |
| Bills | Opens the bill history backed by the dashboard/bills provider; Add bill opens the bill sheet. | KEEP |
| Reminders | Previously edited local/server preference fields, but no notification system reads them. | REMOVE |
| Watch on Wi-Fi only | Persists in settings; upload checks it before photo transfer and the clip player checks it before playback. | KEEP |
| Delete my data / Reset demo | Real users call DELETE `/me` and clear the account; demo users restore the seeded Nest and bills and remove demo photos. | KEEP |
| Sign out / Exit demo | Real users sign out through the auth provider; demo users clear the session demo flag and return to Welcome. | KEEP |
| Create my Nest | Clears the demo namespace and opens the sign-up state without carrying sample data into an account. | KEEP |
| Profile close | Closes the sheet through the shared Sheet focus-trap/close control. | KEEP |
| Language option buttons | Change the selected language and close the language sheet; backed by i18n and profile persistence in real mode. | KEEP |
| Confirmation Cancel/Confirm | Cancel closes; destructive confirmation is disabled until `DELETE`, and reset/sign-out perform their provider-backed action. | KEEP |

