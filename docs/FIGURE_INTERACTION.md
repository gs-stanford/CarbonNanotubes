# Interactive Point Details

The explorer generates a figure only when its axes, filters, plot type, callouts
or search highlights change. Selecting or closing a point updates the highlight
and panel locally without replacing the SVG or regenerating export artwork.

The website requests `interactive_details: true` when creating a figure. The
response adds a short-lived opaque `selection_context` token. A POST to
`/api/v1/figures/selection`, containing `context_token` and one `record_id`, returns
the same public point details previously available through `selected_record`.
Only records in that exact figure are eligible. The stored release and values
are immutable snapshots; a later release cannot silently change an open figure.
Raw record endpoints remain private, and point requests use the figure rate limit.

Snapshots expire after 15 minutes. The server store is bounded to 64 contexts
and 16 MiB of serialized point data, with least-recently-used eviction. The
browser caches up to 32 opened points, keyed by context token and record ID.
Details have a 15-second timeout; changing selection cancels the previous request.
Errors appear in the details panel rather than obscuring the figure.

The store is process-local, matching the current single-process Render service.
Restarting or evicting a context produces HTTP 410 and an explicit **Refresh figure
details** action. This action regenerates the context once; normal selection does
not. A multi-instance deployment would need a shared bounded store or sticky
routing. Export requests do not allocate contexts.

## Verification

Use Node 22.18+ and a running app. The browser test also needs Chrome or
`CPT_CHROME_PATH` pointing to a Chromium executable.

```sh
cd web
npm run test:selection-cache
CPT_TEST_URL=http://localhost:3002 npm run test:figure-details
CPT_TEST_URL=http://localhost:3002 npm run test:point-interaction
CPT_TEST_URL=http://localhost:3002 npm run test:requirements
```

The API tests compare point values and release metadata directly against the
existing figure response, reject out-of-figure IDs and forged contexts, and check
that no SVG or bulk records accompany the point response. Store tests cover
snapshot immutability, expiry and both memory/count eviction limits. The browser
test checks request counts and SVG-node identity during selection and cached revisits.
