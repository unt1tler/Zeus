const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { getDefaultSettings } = require("./default-settings");

const dataDir = path.resolve(process.cwd(), "data");
const DEFAULT_TABLE_PREFIX = "zeus_store";
const SCHEMA_VERSION = 1;
const migrationStateFile = path.join(dataDir, "storage-migration-state.json");

const COLLECTIONS = [
  { filename: "settings.json", defaultValue: () => getDefaultSettings(), key: "settings" },
  { filename: "products.json", defaultValue: () => [], key: "id" },
  { filename: "licenses.json", defaultValue: () => [], key: "key" },
  { filename: "platform-links.json", defaultValue: () => [], key: (item) => `${item.platform || ""}:${item.platformUserId || ""}` },
  { filename: "logs.json", defaultValue: () => [], key: "id" },
  { filename: "bot-logs.json", defaultValue: () => [], key: (item) => `${item.command || ""}:${item.userId || ""}:${item.timestamp || ""}` },
  { filename: "vouchers.json", defaultValue: () => [], key: "code" },
  { filename: "blacklist.json", defaultValue: () => ({ ips: [], hwids: [], discordIds: [] }), key: "blacklist" },
];

const locks = new Map();
let dirReady = false;
let pool = null;
let schemaReadyPromise = null;
let tablePrefix = null;
let tableNames = null;

function clone(value) {
  return globalThis.structuredClone
    ? globalThis.structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function envValue(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function getDatabaseMode() {
  return envValue("DB", "db").toUpperCase();
}

function isPostgresEnabled() {
  const mode = getDatabaseMode();
  return mode === "POSTGRESQL" || mode === "POSTGRES" || mode === "PG";
}

function getPostgresConnectionString() {
  return envValue("postgresql_db", "POSTGRESQL_DB", "DATABASE_URL");
}

function getStorageMode() {
  return isPostgresEnabled() ? "postgresql" : "json";
}

function validateIdentifier(identifier, label = "PostgreSQL identifier") {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`${label} "${identifier}" must use only letters, numbers, and underscores.`);
  }
  return identifier;
}

function quoteIdentifier(identifier) {
  return `"${validateIdentifier(identifier).replace(/"/g, '""')}"`;
}

function getTablePrefix() {
  if (!tablePrefix) {
    tablePrefix = validateIdentifier(
      envValue("POSTGRESQL_TABLE", "postgresql_table") || DEFAULT_TABLE_PREFIX,
      "PostgreSQL table prefix",
    );
  }
  return tablePrefix;
}

function identifierWithSuffix(suffix) {
  const prefix = getTablePrefix();
  const maxPrefixLength = Math.max(1, 63 - suffix.length - 1);
  return `${prefix.slice(0, maxPrefixLength)}_${suffix}`;
}

function getTableNames() {
  if (tableNames) return tableNames;

  tableNames = {
    legacyCollection: quoteIdentifier(getTablePrefix()),
    schemaMigrations: quoteIdentifier(identifierWithSuffix("schema_migrations")),
    collectionState: quoteIdentifier(identifierWithSuffix("collection_state")),
    settings: quoteIdentifier(identifierWithSuffix("settings")),
    products: quoteIdentifier(identifierWithSuffix("products")),
    licenses: quoteIdentifier(identifierWithSuffix("licenses")),
    platformLinks: quoteIdentifier(identifierWithSuffix("platform_links")),
    validationLogs: quoteIdentifier(identifierWithSuffix("validation_logs")),
    botLogs: quoteIdentifier(identifierWithSuffix("bot_logs")),
    vouchers: quoteIdentifier(identifierWithSuffix("vouchers")),
    blacklistEntries: quoteIdentifier(identifierWithSuffix("blacklist_entries")),
  };

  return tableNames;
}

function indexName(suffix) {
  return quoteIdentifier(identifierWithSuffix(suffix));
}

function parseBooleanEnv(value) {
  if (!value) return null;
  if (/^(1|true|yes|on)$/i.test(value)) return true;
  if (/^(0|false|no|off)$/i.test(value)) return false;
  return null;
}

function getPostgresConnectionConfig(connectionString) {
  const config = { connectionString };

  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get("sslmode")?.toLowerCase();

    if (!sslMode) {
      return config;
    }

    url.searchParams.delete("sslmode");
    url.searchParams.delete("uselibpqcompat");
    config.connectionString = url.toString();

    if (sslMode === "disable") {
      return config;
    }

    const explicitRejectUnauthorized = parseBooleanEnv(
      envValue("POSTGRESQL_SSL_REJECT_UNAUTHORIZED", "postgresql_ssl_reject_unauthorized"),
    );
    const rejectUnauthorized = explicitRejectUnauthorized ?? sslMode === "verify-full";

    config.ssl = { rejectUnauthorized };
  } catch {
    // Let pg report malformed connection strings with its own error message.
  }

  return config;
}

function getPool() {
  if (pool) return pool;

  const connectionString = getPostgresConnectionString();
  if (!connectionString) {
    throw new Error(
      "DB=POSTGRESQL is set, but postgresql_db is missing. Set postgresql_db to your PostgreSQL connection string.",
    );
  }

  const max = Number.parseInt(envValue("POSTGRESQL_POOL_MAX", "postgresql_pool_max") || "10", 10);
  const connectionTimeoutMillis = Number.parseInt(
    envValue("POSTGRESQL_CONNECT_TIMEOUT_MS", "postgresql_connect_timeout_ms") || "10000",
    10,
  );

  const config = {
    ...getPostgresConnectionConfig(connectionString),
    max: Number.isFinite(max) && max > 0 ? max : 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis:
      Number.isFinite(connectionTimeoutMillis) && connectionTimeoutMillis > 0
        ? connectionTimeoutMillis
        : 10000,
  };

  const { Pool } = require("pg");
  pool = new Pool(config);
  pool.on("error", (error) => {
    console.error("[Storage] PostgreSQL pool error:", error);
  });

  return pool;
}

async function ensureDir() {
  if (dirReady) return;
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
  dirReady = true;
}

async function withLock(name, fn) {
  const prev = locks.get(name) ?? Promise.resolve();
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  const current = prev.catch(() => undefined).then(() => next);
  locks.set(name, current);
  await prev.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(name) === current) {
      locks.delete(name);
    }
  }
}

function normalizeRecord(filename, value) {
  if (filename === "blacklist.json" && value && typeof value === "object" && !Array.isArray(value)) {
    return {
      ...value,
      ips: Array.isArray(value.ips) ? value.ips : [],
      hwids: Array.isArray(value.hwids) ? value.hwids : [],
      discordIds: Array.isArray(value.discordIds) ? value.discordIds : [],
    };
  }

  return value;
}

async function writeJsonRecordUnlocked(filename, data) {
  await ensureDir();
  const filePath = path.join(dataDir, filename);
  const tmpPath = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmpPath, filePath);
}

async function readJsonRecordUnlocked(filename, defaultValue, { createMissing = true } = {}) {
  await ensureDir();
  const filePath = path.join(dataDir, filename);
  try {
    const data = await fs.readFile(filePath, "utf-8");
    if (!data.trim()) return clone(defaultValue);

    const raw = JSON.parse(data);
    const parsed = normalizeRecord(filename, raw);
    if (filename === "blacklist.json" && JSON.stringify(parsed) !== JSON.stringify(raw)) {
      await writeJsonRecordUnlocked(filename, parsed);
    }
    return clone(parsed);
  } catch (error) {
    if (error?.code === "ENOENT") {
      const value = normalizeRecord(filename, clone(defaultValue));
      if (createMissing) {
        await writeJsonRecordUnlocked(filename, value);
      }
      return value;
    }

    console.error(`[Storage] Failed to read ${filename}:`, error);
    return clone(defaultValue);
  }
}

async function readJsonRecord(filename, defaultValue) {
  return withLock(filename, () => readJsonRecordUnlocked(filename, defaultValue));
}

async function writeJsonRecord(filename, data) {
  return withLock(filename, () => writeJsonRecordUnlocked(filename, normalizeRecord(filename, data)));
}

async function updateJsonRecord(filename, defaultValue, updater) {
  return withLock(filename, async () => {
    const current = await readJsonRecordUnlocked(filename, defaultValue);
    const updated = normalizeRecord(filename, await updater(clone(current)));
    await writeJsonRecordUnlocked(filename, updated);
    return clone(updated);
  });
}

async function mutateJsonRecord(filename, defaultValue, mutator) {
  return withLock(filename, async () => {
    const current = await readJsonRecordUnlocked(filename, defaultValue);
    const mutation = await mutator(clone(current));

    if (mutation.changed) {
      await writeJsonRecordUnlocked(filename, normalizeRecord(filename, mutation.data));
    }

    return mutation.result;
  });
}

function nullableString(value) {
  if (value === undefined || value === null) return null;
  return String(value);
}

function stringValue(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanValue(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function stringArray(value) {
  return Array.isArray(value)
    ? value.filter((entry) => entry !== undefined && entry !== null).map(String)
    : [];
}

function timestampValue(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function jsonData(value) {
  return JSON.stringify(value ?? null);
}

function dataRows(rows) {
  return rows.map((row) => clone(row.data));
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function collectionDefault(filename) {
  return COLLECTIONS.find((collection) => collection.filename === filename)?.defaultValue() ?? null;
}

function collectionSummaryValue(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    if (Array.isArray(value.ips) || Array.isArray(value.hwids) || Array.isArray(value.discordIds)) {
      return stringArray(value.ips).length + stringArray(value.hwids).length + stringArray(value.discordIds).length;
    }
    return Object.keys(value).length > 0 ? 1 : 0;
  }
  return value === undefined || value === null ? 0 : 1;
}

function snapshotSummary(snapshot, presence = null) {
  const collections = {};
  let totalItems = 0;
  for (const collection of COLLECTIONS) {
    const count = presence && !presence[collection.filename]
      ? 0
      : collectionSummaryValue(snapshot[collection.filename]);
    collections[collection.filename] = count;
    totalItems += count;
  }
  return { collections, totalItems };
}

function snapshotHasDifferences(sourceSnapshot, sourcePresence, destinationSnapshot) {
  for (const collection of COLLECTIONS) {
    if (!sourcePresence[collection.filename]) {
      continue;
    }

    const sourceValue = sourceSnapshot[collection.filename] ?? collection.defaultValue();
    if (collectionSummaryValue(sourceValue) === 0) {
      continue;
    }

    const destinationValue = destinationSnapshot[collection.filename] ?? collection.defaultValue();
    if (stableStringify(sourceValue) !== stableStringify(destinationValue)) {
      return true;
    }
  }

  return false;
}

function itemKey(item, key) {
  if (typeof key === "function") return key(item);
  return item?.[key] ?? "";
}

function mergeArrayByKey(destination, source, key) {
  const sourceKeys = new Set();
  const merged = [];

  for (const item of source) {
    sourceKeys.add(itemKey(item, key));
    merged.push(item);
  }

  for (const item of destination) {
    const keyValue = itemKey(item, key);
    if (!sourceKeys.has(keyValue)) {
      merged.push(item);
    }
  }

  return merged;
}

function mergeObjects(destination, source) {
  const result = clone(destination || {});
  for (const [key, value] of Object.entries(source || {})) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      result[key] = mergeObjects(result[key], value);
    } else {
      result[key] = clone(value);
    }
  }
  return result;
}

function mergeBlacklist(destination, source) {
  return {
    ips: Array.from(new Set([...stringArray(source?.ips), ...stringArray(destination?.ips)])),
    hwids: Array.from(new Set([...stringArray(source?.hwids), ...stringArray(destination?.hwids)])),
    discordIds: Array.from(new Set([...stringArray(source?.discordIds), ...stringArray(destination?.discordIds)])),
  };
}

function mergeCollection(filename, destination, source) {
  const collection = COLLECTIONS.find((entry) => entry.filename === filename);
  if (!collection) return clone(source);

  if (filename === "settings.json") {
    return mergeObjects(destination, source);
  }
  if (filename === "blacklist.json") {
    return mergeBlacklist(destination, source);
  }
  if (Array.isArray(source) && Array.isArray(destination)) {
    return mergeArrayByKey(destination, source, collection.key);
  }

  return clone(source);
}

function validateUniqueValues(items, label, getValue, issues) {
  const seen = new Set();
  const duplicates = new Set();

  items.forEach((item, index) => {
    const value = String(getValue(item) ?? "").trim();
    if (!value) {
      issues.push(`${label} at index ${index} is missing a required value.`);
      return;
    }

    if (seen.has(value)) {
      duplicates.add(value);
      return;
    }

    seen.add(value);
  });

  for (const value of duplicates) {
    issues.push(`${label} "${value}" appears more than once.`);
  }
}

function validateAllowedValue(value, allowedValues, label, index, issues) {
  if (!allowedValues.has(value)) {
    issues.push(`${label} at index ${index} has invalid value "${value}".`);
  }
}

function validatePostgresSnapshot(snapshot) {
  const issues = [];
  const products = Array.isArray(snapshot["products.json"]) ? snapshot["products.json"] : [];
  const licenses = Array.isArray(snapshot["licenses.json"]) ? snapshot["licenses.json"] : [];
  const platformLinks = Array.isArray(snapshot["platform-links.json"]) ? snapshot["platform-links.json"] : [];
  const logs = Array.isArray(snapshot["logs.json"]) ? snapshot["logs.json"] : [];
  const vouchers = Array.isArray(snapshot["vouchers.json"]) ? snapshot["vouchers.json"] : [];

  validateUniqueValues(products, "Product id", (product) => product.id, issues);
  validateUniqueValues(licenses, "License id", (license) => license.id, issues);
  validateUniqueValues(licenses, "License key", (license) => license.key, issues);
  validateUniqueValues(
    platformLinks,
    "Platform link",
    (link) => `${link.platform || ""}:${link.platformUserId || ""}`,
    issues,
  );
  validateUniqueValues(
    platformLinks,
    "Platform Discord link",
    (link) => `${link.platform || ""}:${link.discordId || ""}`,
    issues,
  );
  validateUniqueValues(logs, "Validation log id", (log) => log.id, issues);
  validateUniqueValues(vouchers, "Voucher code", (voucher) => voucher.code, issues);

  const licenseStatuses = new Set(["active", "inactive", "expired"]);
  licenses.forEach((license, index) => {
    validateAllowedValue(license.status ?? "active", licenseStatuses, "License status", index, issues);
  });

  const logStatuses = new Set(["success", "failure"]);
  logs.forEach((log, index) => {
    validateAllowedValue(log.status ?? "failure", logStatuses, "Validation log status", index, issues);
  });

  const voucherActions = new Set(["create", "renew"]);
  vouchers.forEach((voucher, index) => {
    if (voucher.redeemAction !== undefined && voucher.redeemAction !== null) {
      validateAllowedValue(voucher.redeemAction, voucherActions, "Voucher redeem action", index, issues);
    }
  });

  if (issues.length > 0) {
    const sample = issues.slice(0, 6).join(" ");
    const suffix = issues.length > 6 ? ` ${issues.length - 6} more issue(s) were found.` : "";
    throw new Error(`Cannot migrate to PostgreSQL until data conflicts are resolved. ${sample}${suffix}`);
  }
}

function validateSnapshotForBackend(backend, snapshot) {
  if (backend === "postgresql") {
    validatePostgresSnapshot(snapshot);
  }
}

async function readMigrationState() {
  try {
    const data = await fs.readFile(migrationStateFile, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeMigrationState(state) {
  await ensureDir();
  const tmpPath = `${migrationStateFile}.tmp-${process.pid}-${crypto.randomUUID()}`;
  await fs.writeFile(tmpPath, JSON.stringify(state, null, 2), "utf-8");
  await fs.rename(tmpPath, migrationStateFile);
}

async function backupSnapshot(backend, snapshot, direction) {
  await ensureDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(dataDir, "migration-backups", `${timestamp}-${direction}`);
  await fs.mkdir(backupDir, { recursive: true });

  for (const collection of COLLECTIONS) {
    await fs.writeFile(
      path.join(backupDir, collection.filename),
      JSON.stringify(snapshot[collection.filename] ?? collection.defaultValue(), null, 2),
      "utf-8",
    );
  }

  await fs.writeFile(
    path.join(backupDir, "metadata.json"),
    JSON.stringify({ backend, direction, createdAt: new Date().toISOString() }, null, 2),
    "utf-8",
  );

  return backupDir;
}

async function insertRows(client, table, columns, rows, casts = [], suffix = "") {
  if (rows.length === 0) return;

  const chunkSize = 500;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const values = [];
    let param = 1;
    const tuples = chunk.map((row) => {
      const placeholders = row.map((value, index) => {
        values.push(value);
        return `$${param++}${casts[index] ?? ""}`;
      });
      return `(${placeholders.join(", ")})`;
    });

    await client.query(
      `
        INSERT INTO ${table} (${columns.join(", ")})
        VALUES ${tuples.join(", ")}
        ${suffix}
      `,
      values,
    );
  }
}

async function ensurePostgresSchema() {
  if (schemaReadyPromise) return schemaReadyPromise;

  schemaReadyPromise = (async () => {
    const tables = getTableNames();
    const pgPool = getPool();

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS ${tables.schemaMigrations} (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS ${tables.collectionState} (
        collection TEXT PRIMARY KEY,
        seeded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS ${tables.settings} (
        key TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS ${tables.products} (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price NUMERIC NOT NULL DEFAULT 0,
        image_url TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ,
        hwid_protection BOOLEAN NOT NULL DEFAULT FALSE,
        built_by_bit_resource_id TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS ${tables.licenses} (
        id TEXT PRIMARY KEY,
        license_key TEXT NOT NULL UNIQUE,
        product_id TEXT NOT NULL,
        platform TEXT NOT NULL DEFAULT 'custom',
        platform_user_id TEXT,
        discord_id TEXT NOT NULL,
        discord_username TEXT,
        email TEXT,
        sub_user_discord_ids TEXT[] NOT NULL DEFAULT '{}',
        expires_at TIMESTAMPTZ,
        status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'expired')),
        allowed_ips TEXT[] NOT NULL DEFAULT '{}',
        max_ips INTEGER NOT NULL DEFAULT 1,
        allowed_hwids TEXT[] NOT NULL DEFAULT '{}',
        max_hwids INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        validations INTEGER NOT NULL DEFAULT 0,
        purchase_timestamp TIMESTAMPTZ,
        source TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        data JSONB NOT NULL,
        stored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS ${tables.platformLinks} (
        platform TEXT NOT NULL,
        platform_user_id TEXT NOT NULL,
        discord_id TEXT NOT NULL,
        discord_username TEXT,
        linked_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        sort_order INTEGER NOT NULL DEFAULT 0,
        data JSONB NOT NULL,
        PRIMARY KEY (platform, platform_user_id),
        UNIQUE (platform, discord_id)
      )
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS ${tables.validationLogs} (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMPTZ,
        license_key TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        hwid TEXT,
        status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
        reason TEXT,
        product_name TEXT NOT NULL,
        discord_id TEXT NOT NULL,
        location JSONB,
        sort_order INTEGER NOT NULL DEFAULT 0,
        data JSONB NOT NULL
      )
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS ${tables.botLogs} (
        id BIGSERIAL PRIMARY KEY,
        command TEXT NOT NULL,
        user_id TEXT NOT NULL,
        timestamp TIMESTAMPTZ,
        sort_order INTEGER NOT NULL DEFAULT 0,
        data JSONB NOT NULL
      )
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS ${tables.vouchers} (
        code TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        duration TEXT NOT NULL,
        is_redeemed BOOLEAN NOT NULL DEFAULT FALSE,
        redeemed_by TEXT,
        redeemed_at TIMESTAMPTZ,
        redeemed_for_license_id TEXT,
        redeem_action TEXT CHECK (redeem_action IS NULL OR redeem_action IN ('create', 'renew')),
        created_at TIMESTAMPTZ,
        sort_order INTEGER NOT NULL DEFAULT 0,
        data JSONB NOT NULL
      )
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS ${tables.blacklistEntries} (
        kind TEXT NOT NULL CHECK (kind IN ('ip', 'hwid', 'discord_id')),
        value TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (kind, value)
      )
    `);

    await pgPool.query(`CREATE INDEX IF NOT EXISTS ${indexName("products_name_idx")} ON ${tables.products} (name)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS ${indexName("licenses_key_idx")} ON ${tables.licenses} (license_key)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS ${indexName("licenses_discord_idx")} ON ${tables.licenses} (discord_id)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS ${indexName("licenses_product_idx")} ON ${tables.licenses} (product_id)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS ${indexName("licenses_status_idx")} ON ${tables.licenses} (status)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS ${indexName("licenses_created_idx")} ON ${tables.licenses} (created_at DESC)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS ${indexName("licenses_platform_idx")} ON ${tables.licenses} (platform, platform_user_id)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS ${indexName("licenses_subusers_idx")} ON ${tables.licenses} USING GIN (sub_user_discord_ids)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS ${indexName("logs_timestamp_idx")} ON ${tables.validationLogs} (timestamp DESC)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS ${indexName("logs_license_idx")} ON ${tables.validationLogs} (license_key)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS ${indexName("logs_discord_idx")} ON ${tables.validationLogs} (discord_id)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS ${indexName("logs_status_idx")} ON ${tables.validationLogs} (status)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS ${indexName("bot_logs_timestamp_idx")} ON ${tables.botLogs} (timestamp DESC)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS ${indexName("bot_logs_user_idx")} ON ${tables.botLogs} (user_id)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS ${indexName("vouchers_product_idx")} ON ${tables.vouchers} (product_id)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS ${indexName("vouchers_redeemed_idx")} ON ${tables.vouchers} (is_redeemed)`);

    await pgPool.query(
      `
        INSERT INTO ${tables.schemaMigrations} (version, name)
        VALUES ($1, $2)
        ON CONFLICT (version) DO NOTHING
      `,
      [SCHEMA_VERSION, "relational_storage_v1"],
    );
  })().catch((error) => {
    schemaReadyPromise = null;
    throw error;
  });

  return schemaReadyPromise;
}

async function withPostgresTransaction(collection, fn) {
  await ensurePostgresSchema();
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [
      getTablePrefix(),
      collection,
    ]);

    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function readJsonRecordForMigration(filename, defaultValue) {
  await ensureDir();
  const filePath = path.join(dataDir, filename);

  try {
    const data = await fs.readFile(filePath, "utf-8");
    if (!data.trim()) {
      return { value: clone(defaultValue), exists: false };
    }

    return {
      value: clone(normalizeRecord(filename, JSON.parse(data))),
      exists: true,
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { value: clone(defaultValue), exists: false };
    }

    throw error;
  }
}

async function legacyCollectionTableExists(client) {
  const result = await client.query(
    `
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = CURRENT_SCHEMA()
            AND table_name = $1
            AND column_name = 'collection'
        ) AS has_collection,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = CURRENT_SCHEMA()
            AND table_name = $1
            AND column_name = 'data'
        ) AS has_data
    `,
    [getTablePrefix()],
  );

  return Boolean(result.rows[0]?.has_collection && result.rows[0]?.has_data);
}

async function hasRelationalCollectionData(client, filename) {
  const tables = getTableNames();
  let result;

  switch (filename) {
    case "products.json":
      result = await client.query(`SELECT 1 FROM ${tables.products} LIMIT 1`);
      break;
    case "licenses.json":
      result = await client.query(`SELECT 1 FROM ${tables.licenses} LIMIT 1`);
      break;
    case "platform-links.json":
      result = await client.query(`SELECT 1 FROM ${tables.platformLinks} LIMIT 1`);
      break;
    case "logs.json":
      result = await client.query(`SELECT 1 FROM ${tables.validationLogs} LIMIT 1`);
      break;
    case "bot-logs.json":
      result = await client.query(`SELECT 1 FROM ${tables.botLogs} LIMIT 1`);
      break;
    case "vouchers.json":
      result = await client.query(`SELECT 1 FROM ${tables.vouchers} LIMIT 1`);
      break;
    case "settings.json":
      result = await client.query(`SELECT 1 FROM ${tables.settings} WHERE key = 'settings' LIMIT 1`);
      break;
    case "blacklist.json":
      result = await client.query(`SELECT 1 FROM ${tables.blacklistEntries} LIMIT 1`);
      break;
    default:
      return false;
  }

  return Boolean(result.rows[0]);
}

async function readLegacyCollectionRecord(client, filename) {
  if (!(await legacyCollectionTableExists(client))) {
    return undefined;
  }

  const result = await client.query(
    `SELECT data FROM ${getTableNames().legacyCollection} WHERE collection = $1`,
    [filename],
  );

  if (!result.rows[0]) {
    return undefined;
  }

  return clone(normalizeRecord(filename, result.rows[0].data));
}

async function markCollectionSeeded(client, filename) {
  await client.query(
    `
      INSERT INTO ${getTableNames().collectionState} (collection)
      VALUES ($1)
      ON CONFLICT (collection) DO NOTHING
    `,
    [filename],
  );
}

async function isCollectionSeeded(client, filename) {
  const result = await client.query(
    `SELECT 1 FROM ${getTableNames().collectionState} WHERE collection = $1`,
    [filename],
  );
  return Boolean(result.rows[0]);
}

async function ensureCollectionSeeded(client, filename, defaultValue) {
  if (await isCollectionSeeded(client, filename)) {
    return;
  }

  const legacyValue = await readLegacyCollectionRecord(client, filename);
  if (legacyValue !== undefined) {
    await writeRelationalCollection(client, filename, legacyValue);
  }

  await markCollectionSeeded(client, filename);
}

async function readRelationalCollection(client, filename, defaultValue) {
  const tables = getTableNames();

  switch (filename) {
    case "products.json": {
      const result = await client.query(`SELECT data FROM ${tables.products} ORDER BY sort_order ASC, id ASC`);
      return dataRows(result.rows);
    }
    case "licenses.json": {
      const result = await client.query(`SELECT data FROM ${tables.licenses} ORDER BY sort_order ASC, created_at DESC NULLS LAST, id ASC`);
      return dataRows(result.rows);
    }
    case "platform-links.json": {
      const result = await client.query(`SELECT data FROM ${tables.platformLinks} ORDER BY sort_order ASC, platform ASC, platform_user_id ASC`);
      return dataRows(result.rows);
    }
    case "logs.json": {
      const result = await client.query(`SELECT data FROM ${tables.validationLogs} ORDER BY sort_order ASC, timestamp DESC NULLS LAST, id ASC`);
      return dataRows(result.rows);
    }
    case "bot-logs.json": {
      const result = await client.query(`SELECT data FROM ${tables.botLogs} ORDER BY sort_order ASC, id ASC`);
      return dataRows(result.rows);
    }
    case "vouchers.json": {
      const result = await client.query(`SELECT data FROM ${tables.vouchers} ORDER BY sort_order ASC, created_at DESC NULLS LAST, code ASC`);
      return dataRows(result.rows);
    }
    case "settings.json": {
      const result = await client.query(`SELECT data FROM ${tables.settings} WHERE key = 'settings'`);
      return clone(result.rows[0]?.data ?? defaultValue);
    }
    case "blacklist.json": {
      const result = await client.query(`SELECT kind, value FROM ${tables.blacklistEntries} ORDER BY kind ASC, sort_order ASC, value ASC`);
      const blacklist = { ips: [], hwids: [], discordIds: [] };
      for (const row of result.rows) {
        if (row.kind === "ip") blacklist.ips.push(row.value);
        else if (row.kind === "hwid") blacklist.hwids.push(row.value);
        else if (row.kind === "discord_id") blacklist.discordIds.push(row.value);
      }
      return normalizeRecord(filename, blacklist);
    }
    default:
      return clone(defaultValue);
  }
}

async function writeRelationalCollection(client, filename, value) {
  switch (filename) {
    case "products.json":
      await writeProducts(client, Array.isArray(value) ? value : []);
      return;
    case "licenses.json":
      await writeLicenses(client, Array.isArray(value) ? value : []);
      return;
    case "platform-links.json":
      await writePlatformLinks(client, Array.isArray(value) ? value : []);
      return;
    case "logs.json":
      await writeValidationLogs(client, Array.isArray(value) ? value : []);
      return;
    case "bot-logs.json":
      await writeBotLogs(client, Array.isArray(value) ? value : []);
      return;
    case "vouchers.json":
      await writeVouchers(client, Array.isArray(value) ? value : []);
      return;
    case "settings.json":
      await writeSettings(client, value && typeof value === "object" ? value : {});
      return;
    case "blacklist.json":
      await writeBlacklist(client, normalizeRecord(filename, value || {}));
      return;
    default:
      return;
  }
}

async function writeProducts(client, products) {
  const table = getTableNames().products;
  await client.query(`DELETE FROM ${table}`);

  const rows = products.map((product, index) => [
    stringValue(product.id, crypto.randomUUID()),
    stringValue(product.name),
    numberValue(product.price),
    stringValue(product.imageUrl),
    timestampValue(product.createdAt),
    booleanValue(product.hwidProtection),
    nullableString(product.builtByBitResourceId),
    index,
    jsonData(product),
  ]);

  await insertRows(
    client,
    table,
    ["id", "name", "price", "image_url", "created_at", "hwid_protection", "built_by_bit_resource_id", "sort_order", "data"],
    rows,
    ["", "", "", "", "", "", "", "", "::jsonb"],
  );
}

async function writeLicenses(client, licenses) {
  const table = getTableNames().licenses;
  await client.query(`DELETE FROM ${table}`);

  const rows = licenses.map((license, index) => [
    stringValue(license.id, crypto.randomUUID()),
    stringValue(license.key),
    stringValue(license.productId),
    stringValue(license.platform, "custom"),
    nullableString(license.platformUserId),
    stringValue(license.discordId),
    nullableString(license.discordUsername),
    nullableString(license.email),
    stringArray(license.subUserDiscordIds),
    timestampValue(license.expiresAt),
    stringValue(license.status, "active"),
    stringArray(license.allowedIps),
    numberValue(license.maxIps, 1),
    stringArray(license.allowedHwids),
    numberValue(license.maxHwids, 1),
    timestampValue(license.createdAt),
    timestampValue(license.updatedAt),
    numberValue(license.validations),
    timestampValue(license.purchaseTimestamp),
    nullableString(license.source),
    index,
    jsonData(license),
  ]);

  await insertRows(
    client,
    table,
    [
      "id", "license_key", "product_id", "platform", "platform_user_id", "discord_id",
      "discord_username", "email", "sub_user_discord_ids", "expires_at", "status",
      "allowed_ips", "max_ips", "allowed_hwids", "max_hwids", "created_at", "updated_at",
      "validations", "purchase_timestamp", "source", "sort_order", "data",
    ],
    rows,
    Array(21).fill("").concat("::jsonb"),
  );
}

async function writePlatformLinks(client, links) {
  const table = getTableNames().platformLinks;
  await client.query(`DELETE FROM ${table}`);

  const rows = links.map((link, index) => [
    stringValue(link.platform, "custom"),
    stringValue(link.platformUserId),
    stringValue(link.discordId),
    nullableString(link.discordUsername),
    timestampValue(link.linkedAt),
    timestampValue(link.updatedAt),
    index,
    jsonData(link),
  ]);

  await insertRows(
    client,
    table,
    ["platform", "platform_user_id", "discord_id", "discord_username", "linked_at", "updated_at", "sort_order", "data"],
    rows,
    ["", "", "", "", "", "", "", "::jsonb"],
  );
}

async function writeValidationLogs(client, logs) {
  const table = getTableNames().validationLogs;
  await client.query(`DELETE FROM ${table}`);

  const rows = logs.map((log, index) => [
    stringValue(log.id, crypto.randomUUID()),
    timestampValue(log.timestamp),
    stringValue(log.licenseKey),
    stringValue(log.ipAddress),
    nullableString(log.hwid),
    stringValue(log.status, "failure"),
    nullableString(log.reason),
    stringValue(log.productName),
    stringValue(log.discordId),
    log.location ? jsonData(log.location) : null,
    index,
    jsonData(log),
  ]);

  await insertRows(
    client,
    table,
    ["id", "timestamp", "license_key", "ip_address", "hwid", "status", "reason", "product_name", "discord_id", "location", "sort_order", "data"],
    rows,
    ["", "", "", "", "", "", "", "", "", "::jsonb", "", "::jsonb"],
  );
}

async function writeBotLogs(client, logs) {
  const table = getTableNames().botLogs;
  await client.query(`DELETE FROM ${table}`);

  const rows = logs.map((log, index) => [
    stringValue(log.command),
    stringValue(log.userId),
    timestampValue(log.timestamp),
    index,
    jsonData(log),
  ]);

  await insertRows(
    client,
    table,
    ["command", "user_id", "timestamp", "sort_order", "data"],
    rows,
    ["", "", "", "", "::jsonb"],
  );
}

async function writeVouchers(client, vouchers) {
  const table = getTableNames().vouchers;
  await client.query(`DELETE FROM ${table}`);

  const rows = vouchers.map((voucher, index) => [
    stringValue(voucher.code),
    stringValue(voucher.productId),
    stringValue(voucher.duration),
    booleanValue(voucher.isRedeemed),
    nullableString(voucher.redeemedBy),
    timestampValue(voucher.redeemedAt),
    nullableString(voucher.redeemedForLicenseId),
    nullableString(voucher.redeemAction),
    timestampValue(voucher.createdAt),
    index,
    jsonData(voucher),
  ]);

  await insertRows(
    client,
    table,
    ["code", "product_id", "duration", "is_redeemed", "redeemed_by", "redeemed_at", "redeemed_for_license_id", "redeem_action", "created_at", "sort_order", "data"],
    rows,
    Array(10).fill("").concat("::jsonb"),
  );
}

async function writeSettings(client, settings) {
  const table = getTableNames().settings;
  await client.query(
    `
      INSERT INTO ${table} (key, data, updated_at)
      VALUES ('settings', $1::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = NOW()
    `,
    [jsonData(settings)],
  );
}

async function writeBlacklist(client, blacklist) {
  const table = getTableNames().blacklistEntries;
  await client.query(`DELETE FROM ${table}`);

  const entries = [
    ...stringArray(blacklist.ips).map((value, index) => ["ip", value, index]),
    ...stringArray(blacklist.hwids).map((value, index) => ["hwid", value, index]),
    ...stringArray(blacklist.discordIds).map((value, index) => ["discord_id", value, index]),
  ];

  await insertRows(
    client,
    table,
    ["kind", "value", "sort_order"],
    entries,
    [],
    "ON CONFLICT (kind, value) DO NOTHING",
  );
}

async function readPostgresRecord(filename, defaultValue) {
  return withPostgresTransaction(filename, async (client) => {
    await ensureCollectionSeeded(client, filename, defaultValue);
    return readRelationalCollection(client, filename, defaultValue);
  });
}

async function writePostgresRecord(filename, data) {
  await withPostgresTransaction(filename, async (client) => {
    await writeRelationalCollection(client, filename, normalizeRecord(filename, data));
    await markCollectionSeeded(client, filename);
  });
}

async function updatePostgresRecord(filename, defaultValue, updater) {
  return withPostgresTransaction(filename, async (client) => {
    await ensureCollectionSeeded(client, filename, defaultValue);
    const current = await readRelationalCollection(client, filename, defaultValue);
    const updated = normalizeRecord(filename, await updater(clone(current)));
    await writeRelationalCollection(client, filename, updated);
    await markCollectionSeeded(client, filename);
    return clone(updated);
  });
}

async function mutatePostgresRecord(filename, defaultValue, mutator) {
  return withPostgresTransaction(filename, async (client) => {
    await ensureCollectionSeeded(client, filename, defaultValue);
    const current = await readRelationalCollection(client, filename, defaultValue);
    const mutation = await mutator(clone(current));

    if (mutation.changed) {
      await writeRelationalCollection(client, filename, normalizeRecord(filename, mutation.data));
      await markCollectionSeeded(client, filename);
    }

    return mutation.result;
  });
}

async function readPostgresRecordForMigration(filename, defaultValue) {
  await ensurePostgresSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [
      getTablePrefix(),
      filename,
    ]);

    if (await hasRelationalCollectionData(client, filename)) {
      const relationalValue = await readRelationalCollection(client, filename, defaultValue);
      await client.query("COMMIT");
      return { value: relationalValue, exists: true };
    }

    const legacyValue = await readLegacyCollectionRecord(client, filename);
    await client.query("COMMIT");
    return legacyValue === undefined
      ? { value: clone(defaultValue), exists: false }
      : { value: legacyValue, exists: collectionSummaryValue(legacyValue) > 0 };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function readBackendSnapshot(backend, { withPresence = false } = {}) {
  const snapshot = {};
  const presence = {};

  for (const collection of COLLECTIONS) {
    const defaultValue = collection.defaultValue();
    const result = backend === "postgresql"
      ? await readPostgresRecordForMigration(collection.filename, defaultValue)
      : await readJsonRecordForMigration(collection.filename, defaultValue);

    snapshot[collection.filename] = result.value;
    presence[collection.filename] = result.exists && collectionSummaryValue(result.value) > 0;
  }

  return withPresence ? { snapshot, presence } : snapshot;
}

async function writePostgresSnapshot(snapshot) {
  await ensurePostgresSchema();
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    for (const collection of COLLECTIONS) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [
        getTablePrefix(),
        collection.filename,
      ]);

      const value = normalizeRecord(
        collection.filename,
        snapshot[collection.filename] ?? collection.defaultValue(),
      );
      await writeRelationalCollection(client, collection.filename, value);
      await markCollectionSeeded(client, collection.filename);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function writeBackendSnapshot(backend, snapshot) {
  if (backend === "postgresql") {
    await writePostgresSnapshot(snapshot);
    return;
  }

  for (const collection of COLLECTIONS) {
    const value = normalizeRecord(
      collection.filename,
      snapshot[collection.filename] ?? collection.defaultValue(),
    );
    await writeJsonRecord(collection.filename, value);
  }
}

function oppositeBackend(backend) {
  return backend === "postgresql" ? "json" : "postgresql";
}

async function getStorageMigrationStatus() {
  const activeBackend = getStorageMode();
  const sourceBackend = oppositeBackend(activeBackend);
  const state = await readMigrationState();
  const status = {
    activeBackend,
    sourceBackend,
    direction: `${sourceBackend}-to-${activeBackend}`,
    available: false,
    needsMigration: false,
    identical: false,
    sourceSummary: { collections: {}, totalItems: 0 },
    activeSummary: { collections: {}, totalItems: 0 },
    lastActiveBackend: state.lastActiveBackend || null,
    lastMigrationAt: state.lastMigrationAt || null,
    error: null,
  };

  try {
    if (sourceBackend === "postgresql" && !getPostgresConnectionString()) {
      status.error = "PostgreSQL connection string is not configured.";
      return status;
    }

    const [sourceResult, activeSnapshot] = await Promise.all([
      readBackendSnapshot(sourceBackend, { withPresence: true }),
      readBackendSnapshot(activeBackend),
    ]);

    const { snapshot: sourceSnapshot, presence: sourcePresence } = sourceResult;
    const sourceHasDifferences = snapshotHasDifferences(sourceSnapshot, sourcePresence, activeSnapshot);

    status.available = true;
    status.sourceSummary = snapshotSummary(sourceSnapshot, sourcePresence);
    status.activeSummary = snapshotSummary(activeSnapshot);
    status.identical = !sourceHasDifferences;
    status.needsMigration = status.sourceSummary.totalItems > 0 && sourceHasDifferences;
    return status;
  } catch (error) {
    status.error = error?.message || "Unable to inspect storage backends.";
    return status;
  }
}

async function migrateStorageData() {
  const activeBackend = getStorageMode();
  const sourceBackend = oppositeBackend(activeBackend);
  const direction = `${sourceBackend}-to-${activeBackend}`;

  if (sourceBackend === "postgresql" && !getPostgresConnectionString()) {
    return {
      success: false,
      message: "PostgreSQL connection string is not configured.",
    };
  }

  const [sourceResult, destinationSnapshot] = await Promise.all([
    readBackendSnapshot(sourceBackend, { withPresence: true }),
    readBackendSnapshot(activeBackend),
  ]);
  const { snapshot: sourceSnapshot, presence: sourcePresence } = sourceResult;

  const sourceSummary = snapshotSummary(sourceSnapshot, sourcePresence);
  if (sourceSummary.totalItems === 0) {
    await writeMigrationState({
      ...(await readMigrationState()),
      lastActiveBackend: activeBackend,
      lastCheckedAt: new Date().toISOString(),
    });
    return {
      success: true,
      message: "No source data was found to migrate.",
      migrated: false,
      sourceSummary,
      destinationSummary: snapshotSummary(destinationSnapshot),
    };
  }

  const mergedSnapshot = {};

  for (const collection of COLLECTIONS) {
    if (sourcePresence[collection.filename]) {
      mergedSnapshot[collection.filename] = mergeCollection(
        collection.filename,
        destinationSnapshot[collection.filename] ?? collection.defaultValue(),
        sourceSnapshot[collection.filename] ?? collection.defaultValue(),
      );
    } else {
      mergedSnapshot[collection.filename] =
        destinationSnapshot[collection.filename] ?? collection.defaultValue();
    }
  }

  validateSnapshotForBackend(activeBackend, mergedSnapshot);

  const backupDir = await backupSnapshot(activeBackend, destinationSnapshot, direction);
  await writeBackendSnapshot(activeBackend, mergedSnapshot);

  const now = new Date().toISOString();
  await writeMigrationState({
    ...(await readMigrationState()),
    lastActiveBackend: activeBackend,
    lastMigrationAt: now,
    lastDirection: direction,
    lastBackupDir: backupDir,
  });

  return {
    success: true,
    message: `Migrated ${sourceBackend} data to ${activeBackend}.`,
    migrated: true,
    backupDir,
    sourceSummary,
    destinationSummary: snapshotSummary(mergedSnapshot),
  };
}

async function initStore() {
  if (isPostgresEnabled()) {
    await ensurePostgresSchema();
  } else {
    await ensureDir();
  }
}

async function readRecord(filename, defaultValue) {
  return isPostgresEnabled()
    ? readPostgresRecord(filename, defaultValue)
    : readJsonRecord(filename, defaultValue);
}

async function writeRecord(filename, data) {
  return isPostgresEnabled()
    ? writePostgresRecord(filename, data)
    : writeJsonRecord(filename, data);
}

async function updateRecord(filename, defaultValue, updater) {
  return isPostgresEnabled()
    ? updatePostgresRecord(filename, defaultValue, updater)
    : updateJsonRecord(filename, defaultValue, updater);
}

async function mutateRecord(filename, defaultValue, mutator) {
  return isPostgresEnabled()
    ? mutatePostgresRecord(filename, defaultValue, mutator)
    : mutateJsonRecord(filename, defaultValue, mutator);
}

module.exports = {
  getStorageMode,
  getStorageMigrationStatus,
  initStore,
  isPostgresEnabled,
  migrateStorageData,
  readRecord,
  writeRecord,
  updateRecord,
  mutateRecord,
};
