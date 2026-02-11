export const endpoints = {
  login: (base: string) => `${base}/api/auth/login`,

  switchAccount: (base: string, id: string) => `${base}/api/accounts/switch?accountId=${id}`,

  suggest: (base: string, text: string) => `${base}/api/suggest?text=${text}`,

  instrumentInfo: (base: string, symbol: string, tzOffset: number) =>
    `${base}/api/instruments/info?symbol=${symbol}&timezoneOffset=${tzOffset}&withExDividends=true`,

  submitOrder: (base: string) => `${base}/api/orders/single`,

  assessments: (base: string) => `${base}/api/assessments`,

  websocket: (base: string) =>
    `wss://${base.split("//")[1]}/client/connector`
    + `?X-Atmosphere-tracking-id=0&X-Atmosphere-Framework=2.3.2-javascript`
    + `&X-Atmosphere-Transport=websocket&X-Atmosphere-TrackMessageSize=true`
    + `&Content-Type=text/x-gwt-rpc;%20charset=UTF-8&X-atmo-protocol=true`
    + `&sessionState=dx-new&guest-mode=false`,
};
