import type { Config } from 'payload';
import { createIcpayEndpoints } from './endpoints';
import {
  createIcpayPaymentsCollection,
  createIcpaySettingsGlobal,
  createIcpayWebhooksCollection
} from './collections';
import type { IcpayPluginOptions } from './types';

const defaults = (options: IcpayPluginOptions): Required<Pick<IcpayPluginOptions, 'enabled'>> => ({
  enabled: options.enabled ?? true
});

export const icpayPayloadPlugin =
  (rawOptions: IcpayPluginOptions) =>
  (incomingConfig: Config): Config => {
    const opts = {
      ...rawOptions,
      ...defaults(rawOptions)
    };

    if (!opts.enabled) {
      return incomingConfig;
    }

    let config: Config = {
      ...incomingConfig
    };

    const collections = [...(config.collections ?? [])];
    const globals = [...(config.globals ?? [])];
    const endpoints = [...(config.endpoints ?? [])];

    if (opts.createCollections ?? true) {
      collections.push(createIcpayPaymentsCollection(opts));
      collections.push(createIcpayWebhooksCollection(opts));
    }

    if (opts.createGlobalSettings ?? true) {
      globals.push(createIcpaySettingsGlobal());
    }

    endpoints.push(...createIcpayEndpoints(opts));

    config.collections = collections;
    config.globals = globals;
    config.endpoints = endpoints;

    config.onInit = async (payload) => {
      if (incomingConfig.onInit) {
        await incomingConfig.onInit(payload);
      }

      payload.logger.info('[icpay-payload-plugin] initialized');
    };

    if (opts.extendConfig) {
      config = opts.extendConfig(config);
    }

    return config;
  };

export type * from './types';
export * from './widgets';
export * from './commerce';
export default icpayPayloadPlugin;
