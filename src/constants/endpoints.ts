function websocketQuery(atmosphereId?: string | null): string {
  const trackingId = atmosphereId ?? "0";
  return (
    `?X-Atmosphere-tracking-id=${trackingId}&X-Atmosphere-Framework=2.3.2-javascript` +
    `&X-Atmosphere-Transport=websocket&X-Atmosphere-TrackMessageSize=true` +
    `&Content-Type=text/x-gwt-rpc;%20charset=UTF-8&X-atmo-protocol=true` +
    `&sessionState=dx-new&guest-mode=false`
  );
}

export const endpoints = {
  login: (base: string) => `${base}/api/auth/login`,

  switchAccount: (base: string, id: string) => `${base}/api/accounts/switch?accountId=${id}`,

  suggest: (base: string, text: string) => `${base}/api/suggest?text=${text}`,

  instrumentInfo: (base: string, symbol: string, tzOffset: number) =>
    `${base}/api/instruments/info?symbol=${symbol}&timezoneOffset=${tzOffset}&withExDividends=true`,

  submitOrder: (base: string) => `${base}/api/orders/single`,

  closePosition: (base: string) => `${base}/api/positions/close`,

  cancelOrder: (base: string, accountId: string, orderChainId: number) =>
    `${base}/api/orders/cancel?accountId=${accountId}&orderChainId=${orderChainId}`,

  assessments: (base: string) => `${base}/api/assessments`,

  websocket: (base: string, atmosphereId?: string | null) =>
    `wss://${base.split("//")[1]}/client/connector` + websocketQuery(atmosphereId),

  tradeJournal: (base: string, params: { from: number; to: number }) =>
    `${base}/api/tradejournal?from=${params.from}&to=${params.to}`,

  tradeHistory: (base: string, params: { from: number; to: number }) =>
    `${base}/api/history?from=${params.from}&to=${params.to}&orderId=`,

  subscribeInstruments: (base: string) => `${base}/api/instruments/subscribeInstrumentSymbols`,

  charts: (base: string) => `${base}/api/charts`,
};
