/**
 * Browsers may clear site data under storage pressure unless the site has "persistent" storage.
 * These helpers report and request it. Nothing is sent anywhere.
 */
export async function isStoragePersistent(): Promise<boolean | null> {
  if (!navigator.storage?.persisted) return null; // not supported
  return navigator.storage.persisted();
}

export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null;
  return navigator.storage.persist();
}
