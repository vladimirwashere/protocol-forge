import { safeStorage } from 'electron'

export function canEncrypt(): boolean {
  return safeStorage.isEncryptionAvailable()
}

export function encryptString(plain: string): Buffer {
  return safeStorage.encryptString(plain)
}

export function decryptString(buf: Buffer): string {
  return safeStorage.decryptString(buf)
}
