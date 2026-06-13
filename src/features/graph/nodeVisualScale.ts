export const MIN_NODE_VISUAL_SCALE = 0.62

export function getNodeVisualScale(cameraScale: number): number {
  if (cameraScale >= 1) {
    return 1
  }

  if (cameraScale >= 0.5) {
    return 0.6 + cameraScale * 0.4
  }

  const lowZoomProgress = Math.max(0, (cameraScale - 0.3) / 0.2)
  return MIN_NODE_VISUAL_SCALE + lowZoomProgress * (0.8 - MIN_NODE_VISUAL_SCALE)
}
