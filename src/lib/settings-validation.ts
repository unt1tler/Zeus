import { z } from "zod";

const DISCORD_ID_RE = /^\d{15,22}$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const adminApiEndpointsSchema = z.object({
  getLicenses: z.boolean(),
  createLicense: z.boolean(),
  updateLicense: z.boolean(),
  deleteLicense: z.boolean(),
  updateIdentities: z.boolean(),
  renewLicense: z.boolean(),
  manageTeam: z.boolean(),
  addSubUser: z.boolean(),
  removeSubUser: z.boolean(),
}).partial().strict();

const clientPanelSchema = z.object({
  enabled: z.boolean(),
  accentColor: z.string().regex(HEX_COLOR_RE),
}).partial().strict();

const validationSectionSchema = (fields: Record<string, z.ZodBoolean>) =>
  z.object({
    enabled: z.boolean(),
    fields: z.object(fields).partial().strict(),
  }).partial().strict();

const validationResponseSchema = z.object({
  requireDiscordId: z.boolean(),
  customSuccessMessage: z.object({
    enabled: z.boolean(),
    message: z.string().max(500),
  }).partial().strict(),
  license: validationSectionSchema({
    license_key: z.boolean(),
    status: z.boolean(),
    expires_at: z.boolean(),
    issue_date: z.boolean(),
    max_ips: z.boolean(),
    used_ips: z.boolean(),
  }),
  customer: validationSectionSchema({
    id: z.boolean(),
    discord_id: z.boolean(),
    customer_since: z.boolean(),
  }),
  product: validationSectionSchema({
    id: z.boolean(),
    name: z.boolean(),
    enabled: z.boolean(),
  }),
}).partial().strict();

const builtByBitSettingsSchema = z.object({
  enabled: z.boolean(),
  secret: z.string().max(255),
  disableIpProtection: z.boolean(),
  maxIps: z.coerce.number().int().min(0).max(1000),
  enableHwidProtection: z.boolean(),
  maxHwids: z.coerce.number().int().min(0).max(1000),
}).partial().strict();

const discordCommandsSchema = z.object({
  viewUser: z.boolean(),
  checkLicenses: z.boolean(),
  searchLicense: z.boolean(),
  deactivate: z.boolean(),
  createLicense: z.boolean(),
  renewLicense: z.boolean(),
  profile: z.boolean(),
  userLicenses: z.boolean(),
  manageLicense: z.boolean(),
  redeem: z.boolean(),
  linkBuiltbybit: z.boolean(),
}).partial().strict();

const discordPresenceSchema = z.object({
  status: z.enum(["online", "idle", "dnd"]),
  activity: z.object({
    type: z.enum(["Playing", "Streaming", "Listening", "Watching", "Competing"]),
    name: z.string().min(1).max(128),
  }).partial().strict(),
}).partial().strict();

const discordBotSchema = z.object({
  enabled: z.boolean(),
  clientId: z.string().max(255),
  guildId: z.string().max(255),
  botSecret: z.string().max(255),
  adminIds: z.array(z.string().regex(DISCORD_ID_RE)),
  commands: discordCommandsSchema,
  presence: discordPresenceSchema,
  lastSync: z.string().max(255),
  publicKey: z.string().max(255),
}).partial().strict();

const loggingSchema = z.object({
  enabled: z.boolean(),
  webhookUrl: z.string().url().or(z.literal("")),
  logLicenseCreations: z.boolean(),
  logLicenseUpdates: z.boolean(),
  logBotCommands: z.boolean(),
  logBlacklistActions: z.boolean(),
  logBuiltByBit: z.boolean(),
}).partial().strict();

export const settingsUpdateSchema = z.object({
  panelUrl: z.string().url().or(z.literal("")),
  adminApiEnabled: z.boolean(),
  adminApiEndpoints: adminApiEndpointsSchema,
  clientPanel: clientPanelSchema,
  validationResponse: validationResponseSchema,
  builtByBitWebhookSecret: builtByBitSettingsSchema,
  builtByBitPlaceholder: builtByBitSettingsSchema,
  discordBot: discordBotSchema,
  logging: loggingSchema,
}).partial().strict();

export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
