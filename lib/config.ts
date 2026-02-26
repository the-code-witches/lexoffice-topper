import fs from "fs";
import path from "path";
import yaml from "js-yaml";

export interface PersonConfig {
  id: string;
  name: string;
  lexoffice_contact_name: string;
  monthly_budget: number;
}

export interface InternalConfig {
  name: string;
  monthly_budget: number;
}

export interface Rule {
  match: string;
  category: string;
  note?: string;
}

export interface VoucherCategorization {
  id: string;
  category: string;
  note?: string;
}

export interface Withdrawal {
  date: string; // ISO date string YYYY-MM-DD
  amount: number;
  person_id: string;
  note?: string;
}

export interface AppConfig {
  people: PersonConfig[];
  internal: InternalConfig;
  rules: Rule[];
  vouchers: VoucherCategorization[];
  withdrawals: Withdrawal[];
}

const CONFIG_PATH = path.join(process.cwd(), "config.yaml");

export function loadConfig(): AppConfig {
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  const parsed = yaml.load(raw) as AppConfig;
  parsed.rules = parsed.rules ?? [];
  parsed.vouchers = parsed.vouchers ?? [];
  parsed.withdrawals = parsed.withdrawals ?? [];
  return parsed;
}

export function saveConfig(config: AppConfig): void {
  const raw = yaml.dump(config, { indent: 2, lineWidth: 120 });
  fs.writeFileSync(CONFIG_PATH, raw, "utf-8");
}

export function categorizeVoucher(
  config: AppConfig,
  voucherId: string,
  contactName: string | undefined,
  description: string | undefined
): string | null {
  // Check explicit voucher overrides first
  const explicit = config.vouchers.find((v) => v.id === voucherId);
  if (explicit) return explicit.category;

  // Then try rules by matching contact name or description
  const text = [contactName, description].filter(Boolean).join(" ").toLowerCase();
  for (const rule of config.rules) {
    if (text.includes(rule.match.toLowerCase())) return rule.category;
  }

  return null;
}
