export interface SymbolSuggestion {
  id: number;
  name: string;
  [key: string]: unknown;
}

export interface SymbolInfo {
  maxVolume: number;
  minVolume: number;
  volumeStep: number;
  lotSize: number;
  [key: string]: unknown;
}
