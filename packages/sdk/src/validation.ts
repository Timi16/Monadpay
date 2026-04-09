import { getAddress, isHexString } from "ethers";

export function assertChecksumAddress(value: string, field: string): string {
  try {
    const normalized = getAddress(value);
    if (normalized !== value) {
      throw new Error();
    }
    return normalized;
  } catch {
    throw new Error(`${field} must be a valid checksum address`);
  }
}

export function assertReference(reference: string): string {
  if (!isHexString(reference, 32)) {
    throw new Error("reference must be a 32-byte hex string");
  }

  return reference.toLowerCase();
}

export function assertAmount(amount: bigint): bigint {
  if (amount <= 0n) {
    throw new Error("amount must be greater than zero");
  }

  return amount;
}
