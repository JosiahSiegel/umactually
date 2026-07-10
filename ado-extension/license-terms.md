# UmActually PR Review — End-User License Agreement

This extension is released under the **MIT License**.

```
MIT License

Copyright (c) 2026 Josiah Siegel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Pre-release status

This extension is marked **Preview** in the manifest's `galleryFlags`
field. The extension is provided as-is. The publisher makes no
guarantees about availability, data retention, or compatibility
with future Azure DevOps releases.

## Privacy

The extension does not collect telemetry. The UmActually CLI sends
the PR diff to the user-configured `UMACTUALLY_API_URL` and writes
the raw provider response to the configured
`outputArtifact` path (default `artifacts/manual/s4-azure-mocked-run.json`).
The build service identity used to post review threads is the
identity associated with the running pipeline — the same identity
that the pipeline's other steps would use to post build status.

## Data retention

The publisher does not retain any data. The extension is
client-side: the publisher's servers are not involved in the
review pipeline.

## Third-party services

The extension calls the user-configured provider endpoint
(`UMACTUALLY_API_URL`). Use of that endpoint is governed by the
provider's own terms of service. The publisher is not a party to
that contract.

## Support

Issues: <https://github.com/JosiahSiegel/umactually/issues>

The publisher does not provide a support contract for this preview
release.
