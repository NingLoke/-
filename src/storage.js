const DB_NAME = 'echo-local-v1';
const STORE = 'app';

export function normalizeState(value) {
  const source = value && typeof value === 'object' ? value : {};
  const people = Array.isArray(source.people)
    ? source.people.filter((person) => person && typeof person.id === 'string' && typeof person.name === 'string')
      .map((person) => ({ ...person, samples: Array.isArray(person.samples) ? person.samples : [] }))
    : [];
  const messages = source.messages && typeof source.messages === 'object' && !Array.isArray(source.messages)
    ? Object.fromEntries(Object.entries(source.messages).map(([key, items]) => [key, Array.isArray(items) ? items.filter((item) => item && typeof item === 'object') : []]))
    : {};
  const tracks = Array.isArray(source.tracks) ? source.tracks.filter((track) => track && typeof track === 'object' && typeof track.id === 'string') : [];
  const selectedId = people.some((person) => person.id === source.selectedId) ? source.selectedId : (people[0]?.id ?? null);
  return { people, messages, tracks, selectedId };
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadState() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get('state');
    request.onsuccess = () => resolve(request.result ? normalizeState(request.result) : null);
    request.onerror = () => reject(request.error);
  });
}

export async function resetState() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete('state');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveState(value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, 'state');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
