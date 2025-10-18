// storage.js - handles loading, saving and syncing data records

// In-memory application state. Each collection is an array of objects.
export const state = {
  varieties: [],
  lots: [],
  customers: [],
  orders: []
};

const LS_PREFIX = 'fig_ops_';

/**
 * Generate a unique identifier based on current timestamp and a random component.
 * Helps avoid collisions when working offline.
 */
function generateId(prefix = '') {
  return `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
}

/**
 * Persist a collection to localStorage.
 * Uses JSON lines format to simplify diffing/merging later.
 */
function saveToLocal(type, records) {
  const key = LS_PREFIX + type;
  const jsonl = records.map(r => JSON.stringify(r)).join('\n');
  localStorage.setItem(key, jsonl);
}

/**
 * Load a collection from localStorage. Returns an array of records or empty array.
 */
function loadFromLocal(type) {
  const key = LS_PREFIX + type;
  const jsonl = localStorage.getItem(key);
  if (!jsonl) return [];
  return jsonl
    .split(/\n/)
    .filter(line => line.trim().length > 0)
    .map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.warn('Failed to parse JSONL line', line, e);
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Retrieve GitHub settings from localStorage. Returns null if not configured.
 */
function getGithubSettings() {
  try {
    const raw = localStorage.getItem('fig_ops_settings');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading GitHub settings', err);
    return null;
  }
}

/**
 * Write GitHub settings to localStorage.
 */
export function saveGithubSettings(settings) {
  localStorage.setItem('fig_ops_settings', JSON.stringify(settings));
}

/**
 * Base64 encode a UTF-8 string.
 */
function base64Encode(str) {
  // btoa can't handle multibyte chars directly
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Fetch the current file metadata for a data file from GitHub. Returns the SHA and content.
 */
async function fetchGithubFile(type, settings) {
  const path = `data/${type}.jsonl`;
  const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${path}?ref=${settings.branch}`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${settings.token}`
    }
  });
  if (response.status === 404) return { sha: null, content: '' };
  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
  const content = atob(data.content.replace(/\n/g, ''));
  return { sha: data.sha, content };
}

/**
 * Commit updated content for a data file to GitHub. Creates the file if it doesn't exist.
 */
async function commitGithubFile(type, content, settings) {
  const path = `data/${type}.jsonl`;
  // fetch existing file to get SHA
  let sha = null;
  try {
    const existing = await fetchGithubFile(type, settings);
    sha = existing.sha;
  } catch (err) {
    // ignore, file may not exist
  }
  const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${path}`;
  const body = {
    message: `Update ${type}`,
    content: base64Encode(content),
    branch: settings.branch
  };
  if (sha) body.sha = sha;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${settings.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`Failed to commit ${type} to GitHub: ${response.statusText}`);
  }
  return await response.json();
}

/**
 * Persist the given type's records to GitHub if settings are configured.
 */
async function persistToGithub(type) {
  const settings = getGithubSettings();
  if (!settings || !settings.token || !settings.owner || !settings.repo || !settings.branch) {
    return;
  }
  const records = state[type];
  const jsonl = records.map(r => JSON.stringify(r)).join('\n');
  try {
    await commitGithubFile(type, jsonl, settings);
  } catch (err) {
    console.error('Error committing to GitHub', err);
  }
}

/**
 * Load records from localStorage and optionally from GitHub if local is empty.
 */
export async function loadAll() {
  ['varieties', 'lots', 'customers', 'orders'].forEach(type => {
    state[type] = loadFromLocal(type);
  });
  // If any collection is empty, attempt to fetch from GitHub
  const settings = getGithubSettings();
  if (!settings || !settings.token) return;
  for (const type of Object.keys(state)) {
    if (state[type].length === 0) {
      try {
        const { content } = await fetchGithubFile(type, settings);
        const lines = content.trim() ? content.trim().split(/\n/) : [];
        const records = lines.map(line => JSON.parse(line));
        state[type] = records;
        saveToLocal(type, records);
      } catch (err) {
        console.warn(`Could not load ${type} from GitHub`, err);
      }
    }
  }
}

/**
 * Add a record to the specified collection. Automatically assigns an id if missing.
 */
export async function addRecord(type, record) {
  if (!record.id) {
    record.id = generateId(type.substring(0, 3));
  }
  state[type].push(record);
  saveToLocal(type, state[type]);
  await persistToGithub(type);
  return record;
}

/**
 * Update an existing record in the specified collection.
 */
export async function updateRecord(type, record) {
  const idx = state[type].findIndex(item => item.id === record.id);
  if (idx === -1) return;
  state[type][idx] = record;
  saveToLocal(type, state[type]);
  await persistToGithub(type);
}

/**
 * Delete a record by id.
 */
export async function deleteRecord(type, id) {
  const idx = state[type].findIndex(item => item.id === id);
  if (idx === -1) return;
  state[type].splice(idx, 1);
  saveToLocal(type, state[type]);
  await persistToGithub(type);
}

/**
 * Retrieve all records for a collection.
 */
export function getRecords(type) {
  return state[type] || [];
}

/**
 * Compute success rate for a lot (rooted/cuttings * 100). Returns a number with two decimals.
 */
export function computeLotSuccess(lot) {
  if (!lot || !lot.cuttings || lot.cuttings === 0) return 0;
  return Math.round((lot.rooted || 0) / lot.cuttings * 10000) / 100;
}