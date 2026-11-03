# Desktop synchronization

Both desktops must run this version. Old versions can still perform unconditional writes; the new client detects their incoming changes but cannot prevent an old client from overwriting the server later. The student portal is unchanged.

## Receiving

`GET appState/<field>.json?print=silent` with `X-Firebase-ETag: true` checks a field without downloading its body. The Firebase node hash is computed from the durable cloud baseline, so an existing matching Tajweed bank does not need a migration download.

Map fields have a companion `__syncIndex/<field>` containing each record's Firebase hash. The aggregate of those hashes **must equal the actual collection ETag** before the index is trusted. A changed, valid index causes downloads only for changed/new records and applies deletions locally. Missing or stale indexes (including portal/old-client writes) cause a full download of **that changed field only**, followed by conditional index repair. Index writes may lag content writes; validation makes that safe. Index cache entries never replace verification of the actual field ETag.

The main process serializes cloud operations. A pull is staged with a token and local revision; the renderer commits it only if no local save or upload intervened. Final disk application is briefly isolated from UI edits. `lastUpdated` remains a legacy notification, not evidence that an individual record was received.

## Sending and conflicts

Uploads compare each changed record with its acknowledged baseline. Each write uses Firebase `PUT` with `if-match`; a known conflict blocks the upload before any writes, and a race returns HTTP 412. Successful earlier records remain acknowledged if a later operation fails. Index failures retry idempotently, and a durable notification flag survives an interruption before updating `lastUpdated`.

Conflicts pause automatic upload retries. The review screen shows the local and cloud versions and requires an explicit choice. The remote ETag is checked again when resolving, and the next upload is still conditional. Other local edits remain pending. Both versions and the decision are archived under the Electron user-data directory in `sync-conflicts/*.json`; current conflicts and index cache are in `sync-metadata.json`. Nothing is restored or deleted from the previous `recovered_reports` folder.

Machine-specific backup/audio paths do not count as cloud edits. Lists such as `students` are conditional whole-field writes; simultaneous changes to the same list require review rather than an automatic merge.

## Checks

```
node --test tests/firebase-hash.test.cjs tests/firebase-patch.test.cjs tests/selective-sync.test.cjs tests/sync-queue.test.cjs tests/sync-ipc.test.cjs tests/cloud-fetch.test.mjs tests/localize-audio.test.mjs
npm run build
```

The IPC tests use a temporary profile and an in-memory Firebase transport. The UI smoke test uses mocked Electron IPC, blocks Firebase requests, and requires Vite at `127.0.0.1:4178`:

```
node tests/selective-sync-ui.cjs
```

It defaults to the installed macOS Chrome. Set `CHROME_PATH` for a different executable. These tests never launch the user's Electron profile or write live Firebase data.
