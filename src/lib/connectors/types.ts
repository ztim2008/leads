// Типы и интерфейс коннектора источников заявок
// Каждая площадка реализует этот интерфейс

/** Нормализованная заявка с любой площадки */
export interface NormalizedLead {
  externalId: string;
  title: string;
  description: string;
  budgetMin?: number;
  budgetMax?: number;
  url: string;
  city?: string;
  author?: string;
  createdAt: string;
}

/** Конфигурация коннектора */
export interface ConnectorConfig {
  /** Произвольные настройки от пользователя */
  [key: string]: unknown;
}

/** Интерфейс коннектора — реализуется для каждой площадки */
export interface Connector {
  /** Уникальный код площадки: profi, avito, fl, kwork, telegram, vk, hh */
  readonly platform: string;

  /** Человеческое название */
  readonly name: string;

  /** Получить новые заявки с площадки */
  fetchLeads(config: ConnectorConfig): Promise<NormalizedLead[]>;

  /** Проверить, что коннектор настроен и готов к работе */
  validateConfig(config: ConnectorConfig): boolean;
}

/** Реестр коннекторов */
const registry = new Map<string, Connector>();

export function registerConnector(connector: Connector): void {
  registry.set(connector.platform, connector);
}

export function getConnector(platform: string): Connector | undefined {
  return registry.get(platform);
}

export function listConnectors(): Connector[] {
  return Array.from(registry.values());
}
