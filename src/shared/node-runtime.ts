export interface NodeRuntimeRequirement {
  readonly minimumVersion: string;
  readonly actualVersion: string;
  readonly supported: boolean;
}

export const minimumNodeRuntimeVersion = "22.13.0";

export function describeNodeRuntimeRequirement(
  actualVersion = process.versions.node
): NodeRuntimeRequirement {
  return {
    minimumVersion: minimumNodeRuntimeVersion,
    actualVersion,
    supported: isNodeVersionAtLeast(actualVersion, minimumNodeRuntimeVersion)
  };
}

export function isNodeVersionAtLeast(actualVersion: string, minimumVersion: string): boolean {
  const actual = parseNodeVersion(actualVersion);
  const minimum = parseNodeVersion(minimumVersion);
  if (!actual || !minimum) return false;

  if (actual.major !== minimum.major) return actual.major > minimum.major;
  if (actual.minor !== minimum.minor) return actual.minor > minimum.minor;
  return actual.patch >= minimum.patch;
}

function parseNodeVersion(version: string): { readonly major: number; readonly minor: number; readonly patch: number } | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return undefined;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}
