export namespace Symbol {
  export interface Suggestion {
    id: number;
    name: string;
    [key: string]: unknown;
  }

  export interface Info {
    maxVolume: number;
    minVolume: number;
    volumeStep: number;
    lotSize: number;
    [key: string]: unknown;
  }
}
