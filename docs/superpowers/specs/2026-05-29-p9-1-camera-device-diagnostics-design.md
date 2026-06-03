# P9.1 Camera Device Diagnostics Design

## Goal

P9.1 makes the existing teacher-camera workflow usable with real classroom devices by adding camera selection, permission diagnostics, lightweight calibration status, and richer observation state without changing the privacy boundary.

## Scope

This increment covers:

- List available video input devices and let the teacher switch cameras.
- Diagnose common camera failures: unsupported browser API, missing device, permission denied, device in use, and unknown errors.
- Keep the preview usable even if MediaPipe fails to load; model failures appear as observation diagnostics.
- Show a lightweight live calibration status from existing observation metrics.
- Show latest sampling time, face confidence, and latest database-save state in the observation panel.
- Continue saving only metric payloads, never image frames, snapshots, blobs, or video data.

This increment does not add the P9 report summary section. It also does not save camera device identifiers to the backend.

## Architecture

`useCamera` becomes the device-aware boundary around browser camera APIs. It owns device enumeration, active `MediaStream` lifecycle, selected `deviceId`, and a normalized diagnostic reason. It still returns the same `videoRef` shape used by the rest of the training room.

`TrainingRoom` remains the orchestration layer. It renders the device selector, passes camera diagnostics into the camera card, and tracks observation-save state around `api.saveTeacherObservation`. It does not send device labels or media data to the server.

`TeacherObservationPanel` remains a display component for local observation metrics. It derives a calibration label from the latest metric payload and displays sampling time, confidence, and save status next to the existing face/head/expression/stability tiles.

## Data Flow

1. Teacher enables the camera.
2. `useCamera` requests video with the selected device constraint when available.
3. Browser returns a stream or throws a DOMException.
4. `useCamera` maps the result to `active` or `blocked` plus a diagnostic reason.
5. `useTeacherVision` runs only when camera status is `active`.
6. `TeacherObservationPanel` shows local calibration and observation metadata.
7. `TrainingRoom` saves deduplicated observation metrics to the backend and shows the latest save state.

## Error Handling

Camera API failures are normalized to stable reasons:

- `unsupported`: `navigator.mediaDevices.getUserMedia` is unavailable.
- `not-found`: no camera device exists or the selected device is unavailable.
- `permission-denied`: the teacher denied camera access or browser policy blocked it.
- `device-busy`: the OS/browser reports the camera cannot be read.
- `unknown`: any other failure.

MediaPipe loading and sampling failures continue through `useTeacherVision.status === "error"` and `vision.error`; the camera preview is not shut down by a model error.

## Calibration Rules

The first P9.1 calibration status intentionally uses only existing metrics:

- No sample yet: `等待采样`
- No visible face or confidence below 35: `光线不足或遮挡`
- Head direction not `front`: `脸部偏离画面`
- Stability below 35: `画面不稳定`
- Otherwise: `画面正常`

Distance estimation is deferred to a later P9 subtask because it needs either face-box geometry or explicit landmark span metrics.

## Testing

Contract tests cover:

- `useCamera` exposes device enumeration, selected-device switching, stream cleanup, and normalized diagnostics.
- `TrainingRoom` renders camera device controls and passes observation save state to the panel.
- `TeacherObservationPanel` renders calibration, sampling time, confidence, and save-state UI.
- CSS includes stable selectors for the new controls and status rows.

Manual validation after implementation:

- Start the app, open the training room, enable the camera, and verify the device selector appears.
- Switch between available cameras if more than one is present.
- Deny permission in the browser and verify the diagnostic copy is specific.
- Leave MediaPipe unavailable or offline and verify preview remains available while observation says the model is unavailable.

## Privacy Boundary

P9.1 preserves the existing privacy boundary. Client-side camera frames are only used for preview and local MediaPipe analysis. The backend continues receiving only `TeacherObservationPayload` metrics: source, face visibility, confidence, head direction, expression activity, stability, and captured time.
