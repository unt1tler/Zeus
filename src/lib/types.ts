
export interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  createdAt: string;
  hwidProtection: boolean;
  builtByBitResourceId?: string;
}

export type LicensePlatform = "spigot" | "builtbybit" | "polymart" | "custom" | string;

export interface License {
  id: string;
  key: string;
  productId: string;
  
  platform: LicensePlatform;
  platformUserId?: string;
  discordId: string;
  discordUsername?: string;
  email?: string;
  
  subUserDiscordIds: string[];
  
  expiresAt: string | null;
  status: 'active' | 'inactive' | 'expired';
  allowedIps: string[];
  maxIps: number; // -1 for unlimited, -2 for disabled
  allowedHwids: string[];
  maxHwids: number; // -1 for unlimited
  
  createdAt: string;
  updatedAt: string;
  validations: number;
  purchaseTimestamp?: string;
  source?: 'zeus' | 'builtbybit-placeholder' | 'builtbybit-webhook';
}

export interface ValidationLog {
  id: string;
  timestamp: string;
  licenseKey: string;
  ipAddress: string;
  hwid: string | null;
  status: 'success' | 'failure';
  reason?: string;
  productName: string;
  discordId: string;
  location?: {
    city: string;
    country: string;
    countryCode: string;
    coordinates?: [number, number];
  };
}

export interface AdminApiEndpoints {
  getLicenses: boolean;
  createLicense: boolean;
  updateLicense: boolean;
  deleteLicense: boolean;
  updateIdentities: boolean;
  renewLicense: boolean;
  manageTeam: boolean; // Kept for backwards compatibility
  addSubUser: boolean;
  removeSubUser: boolean;
}

export interface DiscordCommands {
    viewUser: boolean;
    checkLicenses: boolean;
    searchLicense: boolean;
    deactivate: boolean;
    createLicense: boolean;
    renewLicense: boolean;
    profile: boolean;
    userLicenses: boolean;
    manageLicense: boolean;
    redeem: boolean;
    linkBuiltbybit: boolean;
}

export interface DiscordBotSettings {
    clientId: string;
    guildId: string;
    botSecret?: string;
    adminIds: string[];
    commands: DiscordCommands;
    presence: {
      status: 'online' | 'idle' | 'dnd';
      activity: {
        type: 'Playing' | 'Streaming' | 'Listening' | 'Watching' | 'Competing';
        name: string;
      }
    };
    lastSync?: string;
    publicKey?: string;
}

export interface ValidationResponseFields {
    enabled: boolean;
    fields: { [key: string]: boolean };
}

export interface ValidationResponseSettings {
  requireDiscordId: boolean;
  customSuccessMessage: {
    enabled: boolean;
    message: string;
  };
  license: ValidationResponseFields;
  customer: ValidationResponseFields;
  product: ValidationResponseFields;
}

export interface BuiltByBitPlaceholderSettings {
  enabled: boolean;
  secret?: string;
  disableIpProtection: boolean;
  maxIps: number;
  enableHwidProtection: boolean;
  maxHwids: number;
}

export interface BuiltByBitWebhookSettings {
    enabled: boolean;
    secret?: string;
    disableIpProtection: boolean;
    maxIps: number;
    enableHwidProtection: boolean;
    maxHwids: number;
}

export interface WebhookLoggingSettings {
    enabled: boolean;
    webhookUrl: string;
    logLicenseCreations: boolean;
    logLicenseUpdates: boolean;
    logBotCommands: boolean;
    logBlacklistActions: boolean;
    logBuiltByBit: boolean;
}

export interface ClientPanelSettings {
    enabled: boolean;
    accentColor?: string;
}

export interface Settings {
  apiKey: string;
  panelUrl: string;
  adminApiEnabled: boolean;
  adminApiEndpoints: AdminApiEndpoints;
  clientPanel: ClientPanelSettings;
  validationResponse: ValidationResponseSettings;
  builtByBitWebhookSecret: BuiltByBitWebhookSettings;
  builtByBitPlaceholder: BuiltByBitPlaceholderSettings;
  discordBot: DiscordBotSettings & {
    enabled?: boolean;
  };
  logging: WebhookLoggingSettings;
}


export type DailyValidationData = {
  date: string;
  success: number;
  failure: number;
};

export type DailyNewUsersData = {
  date: string;
  users: number;
};

export type NewLicenseDistributionData = {
  name: 'New Customers' | 'Existing Customers';
  value: number;
  fill: string;
};


export interface Blacklist {
  ips: string[];
  hwids: string[];
  discordIds: string[];
}

export interface BlacklistedUser {
    id: string;
    username: string;
    avatarUrl: string;
}

export interface Customer {
  id: string;
  discordId: string;
  discordUsername?: string;
  avatarUrl?: string;
  email?: string;
  isOwner: boolean;
  ownedLicenseCount: number;
  subUserLicenseCount: number;
  builtByBitId?: string;
}

export interface BotStatus {
    status: 'online' | 'offline' | 'starting' | 'stopping' | 'error';
    username?: string;
    id?: string;
    error?: string;
    avatarUrl?: string;
    lastSync?: string;
    presence?: DiscordBotSettings['presence'];
}

export interface Voucher {
    code: string;
    productId: string;
    duration: string; // e.g. "1m", "6m", "1y", "lifetime"
    isRedeemed: boolean;
    redeemedBy?: string;
    redeemedAt?: string;
    redeemedForLicenseId?: string;
    redeemAction?: 'create' | 'renew';
    createdAt: string;
}

export interface DailyWebhookCreationsData {
    date: string;
    creations: number;
}


export interface DashboardStats {
  totalProducts: number;
  totalLicenses: number;
  activeLicenses: number;
  totalValidations: number;
  successfulValidations: number;
  validationChangePercent: number;
  dailyNewUsers: DailyNewUsersData[];
  newLicenseDistribution: NewLicenseDistributionData[];
  dailyWebhookCreations: DailyWebhookCreationsData[];
}

export interface BotLog {
    command: string;
    userId: string;
    timestamp: string;
}

export interface DailyCommandUsage {
    date: string;
    commands: number;
}

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface Embed {
  title?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: {
    text: string;
    icon_url?: string;
  };
  thumbnail?: {
    url: string;
  };
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
  fields?: EmbedField[];
}

export interface ClientUser {
    id: string;
    username: string;
    avatar?: string;
    email?: string;
}
