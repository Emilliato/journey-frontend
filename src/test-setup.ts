// jsdom (this project's test environment) doesn't implement IndexedDB —
// Dexie-backed services (offline-db, sync-manager, offline-cache) need a
// real IndexedDB implementation to exercise their actual read/write logic
// in a unit test rather than mocking Dexie itself.
import 'fake-indexeddb/auto';
