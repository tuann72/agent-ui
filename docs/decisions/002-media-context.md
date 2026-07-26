# ADR 002: Media references are registered context, not arbitrary uploads

Status: accepted

## Decision

An image, GIF, or video can opt into “Ask Agent” only through a target registered
for the current route. The browser sends a target id, media kind, and optional
video timecode. The server validates that reference and resolves captions,
transcripts, poster descriptions, and asset identity from its own manifest.

Metadata-first media questions are the default. Pixel-level vision is a
separate, disabled-by-default server capability. When enabled, a consumer-owned
resolver returns bytes for a registered target under hard MIME, count, and byte
limits. The client and model never supply a fetchable URL.

## Consequences

- Public manifests contain safe labels and media kinds, not private bodies or
  credentials.
- Private images and authenticated media can be resolved server-side.
- Images work across providers through metadata even when a model lacks vision.
- Video uses transcript, poster, and timecode context by default; full video
  upload and browser frame capture are outside the first release.
- The request allowlist gains one exact Agent media-reference part; arbitrary
  `file`, URL, and provider-specific parts remain rejected.
