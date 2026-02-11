export const BROKER = {
  LARK: "https://trade.gooeytrade.com",
  EIGHTCAP: "https://trader.dx-eightcap.com",
} as const;

export function resolveBrokerUrl(broker: string, customUrls?: Record<string, string>): string {
  if (customUrls?.[broker]) {
    return customUrls[broker];
  }

  const key = broker.toUpperCase() as keyof typeof BROKER;
  if (BROKER[key]) {
    return BROKER[key];
  }

  return `https://dxtrade.${broker}.com`;
}
