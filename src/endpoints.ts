import type { Endpoint, PayloadRequest } from 'payload';
import type { IcpayPluginOptions, IcpayCheckoutInput, IcpayWebhookRecord } from './types';
import { createIcpayClient, mergeSdkFromSettings, toCreateTransactionRequest } from './sdk';

const json = (status: number, body: Record<string, unknown>): Response =>
  Response.json(body, { status });

const parseBody = async (req: PayloadRequest): Promise<Record<string, unknown>> => {
  if (typeof req.json === 'function') {
    const body = await req.json();
    return (body ?? {}) as Record<string, unknown>;
  }
  return ((req as unknown as { body?: Record<string, unknown> }).body ?? {}) as Record<string, unknown>;
};

const parseCheckoutInput = async (req: PayloadRequest): Promise<IcpayCheckoutInput> => {
  const body = await parseBody(req);
  return body as IcpayCheckoutInput;
};

const signatureHeader = (req: PayloadRequest): string | undefined => {
  return (
    req.headers.get('x-icpay-signature') ??
    req.headers.get('x-icpay-webhook-signature') ??
    undefined
  );
};

const upsertPayment = async (
  req: PayloadRequest,
  collection: string,
  data: Record<string, unknown>,
  paymentIntentId?: string
): Promise<void> => {
  try {
    if (paymentIntentId) {
      const existing = await req.payload.find({
        collection,
        where: {
          paymentIntentId: {
            equals: paymentIntentId
          }
        },
        limit: 1,
        overrideAccess: true
      });

      const existingDoc = Array.isArray((existing as any)?.docs) ? (existing as any).docs[0] : null;
      if (existingDoc?.id) {
        await req.payload.update({
          collection,
          id: existingDoc.id,
          data,
          overrideAccess: true
        });
        return;
      }
    }

    await req.payload.create({ collection, data, overrideAccess: true });
  } catch {
    // Endpoint should continue even if storage fails.
  }
};

const getSettings = async (req: PayloadRequest): Promise<Record<string, unknown>> => {
  try {
    const settings = await req.payload.findGlobal({
      slug: 'icpay-settings',
      overrideAccess: true
    });
    return (settings ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const normalizePaymentRecord = (sourcePayment: any): Record<string, unknown> => {
  const paymentIntent = sourcePayment?.paymentIntent ?? sourcePayment?.intent ?? sourcePayment ?? {};
  const payment = sourcePayment?.payment ?? sourcePayment ?? {};
  const paymentIntentId = String(
    paymentIntent?.id ?? payment?.paymentIntentId ?? sourcePayment?.paymentIntentId ?? ''
  );
  return {
    kind: String(paymentIntent?.metadata?.icpay_kind ?? 'payment'),
    status: String(paymentIntent?.status ?? payment?.status ?? 'pending'),
    amountUsd:
      paymentIntent?.amountUsd != null
        ? Number(paymentIntent.amountUsd)
        : payment?.amountUsd != null
          ? Number(payment.amountUsd)
          : null,
    fiatCurrency: String(paymentIntent?.fiatCurrency ?? paymentIntent?.fiat_currency ?? 'USD'),
    paymentIntentId: paymentIntentId || 'unknown',
    transactionId:
      payment?.transactionId != null
        ? Number(payment.transactionId)
        : sourcePayment?.transactionId != null
          ? Number(sourcePayment.transactionId)
          : null,
    checkoutUrl: paymentIntent?.checkoutUrl ?? payment?.checkoutUrl ?? null,
    metadata: (paymentIntent?.metadata ?? payment?.metadata ?? {}) as Record<string, unknown>,
    raw: sourcePayment as Record<string, unknown>
  };
};

export const createIcpayEndpoints = (options: IcpayPluginOptions): Endpoint[] => {
  const basePath = options.apiBasePath ?? '/icpay';
  const paymentsCollection = options.collections?.payments ?? 'icpay-payments';
  const allowedKinds = options.allowedKinds ?? ['payment', 'donation', 'topup', 'custom'];

  const createPaymentEndpoint: Endpoint = {
    path: `${basePath}/create-payment`,
    method: 'post',
    handler: async (req) => {
      try {
        const checkout = await parseCheckoutInput(req);
        const kind = checkout.kind ?? 'payment';

        if (!allowedKinds.includes(kind)) {
          return json(400, {
            error: `Unsupported checkout kind "${kind}". Allowed: ${allowedKinds.join(', ')}`
          });
        }

        if (!checkout.amountUsd && !checkout.paymentIntentId) {
          return json(400, {
            error: 'Either amountUsd or paymentIntentId is required.'
          });
        }

        const settings = await getSettings(req);
        const client = createIcpayClient(options, settings);
        const request = toCreateTransactionRequest(checkout, options);
        const response = await client.createPayment(request);

        const paymentIntentId =
          (response as any)?.payment?.paymentIntent?.id ??
          (response as any)?.payment?.id ??
          checkout.paymentIntentId ??
          null;

        await upsertPayment(
          req,
          paymentsCollection,
          {
          kind,
          status: (response as any)?.status ?? 'pending',
          amountUsd:
            typeof checkout.amountUsd === 'string'
              ? Number.parseFloat(checkout.amountUsd)
              : checkout.amountUsd,
          fiatCurrency: request.fiat_currency,
          paymentIntentId: paymentIntentId ?? 'unknown',
          transactionId: (response as any)?.transactionId ?? null,
          checkoutUrl: (response as any)?.checkoutUrl ?? null,
          metadata: request.metadata ?? {},
          source: 'create-payment',
          raw: response as unknown as Record<string, unknown>
          },
          paymentIntentId ?? undefined
        );

        if (options.onPaymentCreated) {
          await options.onPaymentCreated({
            checkout,
            response,
            req
          });
        }

        return json(200, {
          ok: true,
          data: response
        });
      } catch (error: any) {
        return json(500, {
          ok: false,
          error: error?.message ?? 'Unknown ICPay payment creation error.'
        });
      }
    }
  };

  const syncHandler: Endpoint['handler'] = async (req) => {
    try {
      const httpMethod = String((req as { method?: string }).method ?? 'POST').toUpperCase();
      const body =
        httpMethod === 'GET'
          ? ({} as { limit?: number })
          : ((await parseBody(req)) as { limit?: number });
      const settings = await getSettings(req);
      const merged = mergeSdkFromSettings(options, settings);
      const apiUrl = String(merged.apiUrl ?? '').replace(/\/$/, '');
      const secretKey = String(merged.secretKey ?? '');
      if (!apiUrl || !secretKey) {
        return json(400, { ok: false, error: 'apiUrl and secretKey are required (options or icpay-settings).' });
      }

      const endpointPath = options.sync?.endpointPath ?? '/sdk/private/payments';
      const method = options.sync?.method ?? 'GET';
      const limit = body.limit ?? options.sync?.limit ?? 100;
      const target = `${apiUrl}${endpointPath}${endpointPath.includes('?') ? '&' : '?'}limit=${encodeURIComponent(String(limit))}`;

      const response = await fetch(target, {
        method,
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const text = await response.text();
        return json(502, { ok: false, error: `Sync request failed: ${response.status} ${text}` });
      }

      const sourceData = (await response.json()) as any;
      const items = Array.isArray(sourceData) ? sourceData : Array.isArray(sourceData?.items) ? sourceData.items : [];
      let synced = 0;
      for (const item of items) {
        const record = normalizePaymentRecord(item);
        await upsertPayment(req, paymentsCollection, { ...record, source: 'sync' }, String(record.paymentIntentId ?? ''));
        synced += 1;
      }

      return json(200, {
        ok: true,
        synced
      });
    } catch (error: any) {
      return json(500, {
        ok: false,
        error: error?.message ?? 'Failed to sync payments.'
      });
    }
  };

  const syncEndpointPost: Endpoint = {
    path: `${basePath}/sync-payments`,
    method: 'post',
    handler: syncHandler
  };

  const syncEndpointGet: Endpoint = {
    path: `${basePath}/sync-payments`,
    method: 'get',
    handler: async (req) => {
      return syncHandler(req);
    }
  };

  const webhookEndpoint: Endpoint = {
    path: `${basePath}/webhook`,
    method: 'post',
    handler: async (req) => {
      try {
        const payload = (await parseBody(req)) as Record<string, unknown>;
        const incomingSignature = signatureHeader(req);
        const settings = await getSettings(req);
        const webhookSecret = String(settings.webhookSecret ?? options.webhookSecret ?? '');

        if (webhookSecret) {
          if (!incomingSignature || incomingSignature !== webhookSecret) {
            return json(401, { ok: false, error: 'Invalid webhook signature.' });
          }
        }

        const event: IcpayWebhookRecord = {
          eventType: String(payload.type ?? payload.eventType ?? 'unknown'),
          eventId: payload.id ? String(payload.id) : undefined,
          paymentIntentId:
            payload.paymentIntentId
              ? String(payload.paymentIntentId)
              : payload.paymentIntent && typeof payload.paymentIntent === 'object'
                ? String((payload.paymentIntent as Record<string, unknown>).id ?? '')
                : undefined,
          signature: incomingSignature,
          payload
        };

        const webhookPayment = normalizePaymentRecord(payload);
        await upsertPayment(
          req,
          paymentsCollection,
          {
            ...webhookPayment,
            source: 'webhook',
            lastWebhookEventId: event.eventId ?? null,
            raw: event.payload
          },
          event.paymentIntentId ?? String(webhookPayment.paymentIntentId ?? '')
        );

        if (options.onWebhook) {
          await options.onWebhook(event, req);
        }

        return json(200, { ok: true });
      } catch (error: any) {
        return json(500, {
          ok: false,
          error: error?.message ?? 'Failed to process webhook.'
        });
      }
    }
  };

  return [createPaymentEndpoint, syncEndpointPost, syncEndpointGet, webhookEndpoint, ...(options.additionalEndpoints ?? [])];
};
