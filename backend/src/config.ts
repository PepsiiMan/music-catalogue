export const config = {
  port: 8080,
  albumDetectorUrl: process.env.ALBUM_DETECTOR_URL ?? 'http://album-detector:8000',
  userAgent: `${process.env.PROJECT_NAME}/${process.env.PROJECT_VERSION} (${process.env.CONTACT_EMAIL})`,
} as const
