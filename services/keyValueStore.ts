export interface KeyValueStore {
  /**
   * Retrieves the value for a given key.
   * @param key The key to retrieve.
   * @returns The string value, or null if the key does not exist.
   */
  get(key: string): Promise<string | null>;

  /**
   * Sets the value for a key with an optional expiration time.
   * @param key The key to set.
   * @param value The value to store.
   * @param options.EX The time-to-live in seconds.
   */
  set(key: string, value: string, options?: { EX: number }): Promise<void>;

  /**
   * Deletes a key.
   * @param key The key to delete.
   */
  del(key: string): Promise<void>;

  /**
   * Checks for the existence of a key.
   * @param key The key to check.
   * @returns True if the key exists, false otherwise.
   */
  exists(key: string): Promise<boolean>;
}
