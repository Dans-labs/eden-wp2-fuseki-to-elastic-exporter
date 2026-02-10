export class PatchGapError extends Error {
  constructor(
    public readonly lastKnownVersion: number,
    public readonly minAvailableVersion: number,
  ) {
    super(
      `Patch gap detected: last known version ${lastKnownVersion}, min available ${minAvailableVersion}`,
    );
    this.name = 'PatchGapError';
  }
}
