# Document study improvements

Uploads now move through Queued, Processing, Ready, or Failed. Students see the status in the web and mobile libraries and document workspace. Owners can retry processing; concurrent retries share one job. Extraction failures preserve a readable error, and indexing failures retain the extracted text for retry.

AI chat replies include links to the document excerpts used during retrieval. Clicking a source opens the material and shows the verified excerpt. References identify excerpts rather than claiming page numbers, because the current text index does not preserve page coordinates. Source access uses the same permissions as document access. Old references report that the excerpt is unavailable if the indexed material changes.

## Mobile offline study

1. While connected, open a document and choose **Save for offline study**. Existing flashcards and practice quizzes are included; generate them first if needed.
2. Open **Downloads**, choose a saved document, and study its notes, flashcards, or quizzes. PDF downloads currently contain the extracted text rather than the original PDF page layout. Office documents retain their formatted preview.
3. Finish a reading, flashcard, or quiz session to save progress locally. Quiz answers are checked immediately using the downloaded practice questions.
4. When signed in and connected, progress syncs automatically within 30 seconds. **Sync now** is also available. The server grades quiz answers again and commits progress together with a unique receipt, so retries cannot double count a session.

The login screen offers **Study downloaded materials offline**, allowing saved material to be read after a cold start without changing the existing login policy. Signing out removes access to that offline account on the login screen. Its saved copies become accessible again after the same account signs in. Other accounts have separate downloads and queues.

Removing a download keeps unsynced study sessions. Rejected sessions remain queued and display an error; discarding them requires a separate action. Offline generation, AI chat, and graded assessments still require a connection. Downloads are snapshots; update them after material or practice questions change.

## Verification

Focused tests cover processing transitions and retries, verified source lookup and authorization, account isolation, offline queue persistence, SQLite transaction rollback, duplicate sync receipts, server grading, and mobile source-link navigation. The new receipt table is created by the backend's startup migration.
