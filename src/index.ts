import type { Config } from 'payload';
import { createIcpayEndpoints } from './endpoints';
import {
  createIcpayPaymentsCollection,
  createIcpaySettingsGlobal
} from './collections';
import type { IcpayPluginOptions } from './types';
import { resolveIcpaySyncPaymentsButtonPath } from './resolveSyncButtonPath';

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
      const beforeListSyncButtonPath =
        opts.enableSyncPaymentsButton !== false ? resolveIcpaySyncPaymentsButtonPath() : undefined;
      collections.push(
        createIcpayPaymentsCollection(
          opts,
          beforeListSyncButtonPath ? { beforeListSyncButtonPath } : undefined
        )
      );
    }

    if (opts.createGlobalSettings ?? true) {
      globals.push(
        createIcpaySettingsGlobal({
          clearPaymentsField: opts.enableClearPaymentsSettingsButton !== false,
          webhookEndpointHelpField: opts.enableWebhookEndpointHelp !== false
        })
      );
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
