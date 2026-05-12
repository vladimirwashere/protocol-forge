export type SafeStorageProvider = {
  canEncrypt: () => boolean
  encryptString: (plain: string) => Buffer
  decryptString: (buf: Buffer) => string
}

let provider: SafeStorageProvider | null = null

export function initSafeStorage(impl: SafeStorageProvider): void {
  provider = impl
}

function requireProvider(): SafeStorageProvider {
  if (provider === null) {
    throw new Error('safe-storage not initialized; call initSafeStorage first')
  }
  return provider
}

export function canEncrypt(): boolean {
  return requireProvider().canEncrypt()
}

export function encryptString(plain: string): Buffer {
  return requireProvider().encryptString(plain)
}

export function decryptString(buf: Buffer): string {
  return requireProvider().decryptString(buf)
}
