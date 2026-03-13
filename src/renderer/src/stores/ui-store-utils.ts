export const clampInspectorHeight = (value: number): number => {
  return Math.max(160, Math.min(520, Math.round(value)))
}
