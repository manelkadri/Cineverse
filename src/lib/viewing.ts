export function playbackCompleted(positionSeconds: number, durationSeconds: number) {
  return durationSeconds > 0 && positionSeconds / durationSeconds >= 0.95;
}

export function playbackProgressKey(mediaId: string, seasonNumber?: number | null, episodeNumber?: number | null) {
  return `${mediaId}:s${seasonNumber ?? 0}:e${episodeNumber ?? 0}`;
}
