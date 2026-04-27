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
        collection: collection as any,
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
          collection: collection as any,
          id: existingDoc.id,
          data,
          overrideAccess: true
        });
        return;
      }
    }

    await req.payload.create({ collection: collection as any, data, overrideAccess: true });
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
    return (settings ?? {}) as unknown as Record<string, unknown>;
  } catch {
    return {};
  }
};

/** Parse ICPay / JSON date into ISO string for Payload `date` fields. */
const parseSourceDate = (value: unknown): string | undefined => {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const d = new Date(value as string | Date);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

/**
 * `createdAt` / `updatedAt` on icpay-payments come from API / webhook bodies only
 * (payment + intent + transaction), never Payload’s ingest clock.
 */
const timestampsFromSource = (sourcePayment: any): { createdAt?: string; updatedAt?: string } => {
  const payment = sourcePayment?.payment ?? {};
  const intent = sourcePayment?.intent ?? sourcePayment?.paymentIntent ?? {};
  const tx = sourcePayment?.transaction ?? {};

  const created =
    parseSourceDate(payment.createdAt) ??
    parseSourceDate(intent.createdAt) ??
    parseSourceDate(tx.createdAt) ??
    parseSourceDate((sourcePayment as Record<string, unknown>)?.createdAt);

  const updated =
    parseSourceDate(payment.updatedAt) ??
    parseSourceDate(intent.updatedAt) ??
    parseSourceDate(tx.updatedAt) ??
    parseSourceDate((sourcePayment as Record<string, unknown>)?.updatedAt) ??
    created;

  const out: { createdAt?: string; updatedAt?: string } = {};
  if (created) out.createdAt = created;
  if (updated) out.updatedAt = updated;
  else if (created) out.updatedAt = created;
  return out;
};

const normalizePaymentRecord = (sourcePayment: any): Record<string, unknown> => {
  // icpay-api `GET /sdk/payments` returns `{ payment, intent, invoice, transaction }` per row.
  const paymentIntent =
    sourcePayment?.paymentIntent ?? sourcePayment?.intent ?? sourcePayment ?? {};
  const payment = sourcePayment?.payment ?? {};
  const tx = sourcePayment?.transaction;
  const paymentIntentId = String(
    paymentIntent?.id ??
      payment?.paymentIntentId ??
      sourcePayment?.paymentIntentId ??
      ''
  );
  const rawTxId =
    payment?.transactionId ?? tx?.id ?? sourcePayment?.transactionId ?? null;
  const txIdParsed =
    rawTxId != null && String(rawTxId).trim() !== '' && !Number.isNaN(Number(rawTxId))
      ? Number(rawTxId)
      : null;
  return {
    ...timestampsFromSource(sourcePayment),
    kind: String(paymentIntent?.metadata?.icpay_kind ?? 'payment'),
    status: String(paymentIntent?.status ?? payment?.status ?? 'pending'),
    amountUsd:
      paymentIntent?.amountUsd != null
        ? Number(paymentIntent.amountUsd)
        : payment?.amountUsd != null
          ? Number(payment.amountUsd)
          : null,
    fiatCurrency: String(
      paymentIntent?.fiatCurrencyCode ??
        paymentIntent?.fiatCurrency ??
        paymentIntent?.fiat_currency ??
        'USD'
    ),
    paymentIntentId: paymentIntentId || 'unknown',
    transactionId: txIdParsed,
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

        const r = response as any;
        const aggregate = {
          payment: r?.payment,
          intent: r?.payment?.paymentIntent ?? r?.paymentIntent ?? r?.intent,
          transaction: r?.transaction
        };
        const normalized = normalizePaymentRecord(aggregate);

        await upsertPayment(
          req,
          paymentsCollection,
          {
            ...normalized,
            kind,
            status: r?.status ?? 'pending',
            amountUsd:
              typeof checkout.amountUsd === 'string'
                ? Number.parseFloat(checkout.amountUsd)
                : checkout.amountUsd,
            fiatCurrency: request.fiat_currency,
            paymentIntentId: paymentIntentId ?? 'unknown',
            transactionId: r?.transactionId ?? normalized.transactionId ?? null,
            checkoutUrl: r?.checkoutUrl ?? normalized.checkoutUrl ?? null,
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

      // icpay-api: `SdkPaymentsController` @ `sdk/payments` + SecretKeyAuthGuard (Bearer secret).
      const endpointPath = options.sync?.endpointPath ?? '/sdk/payments';
      const method = options.sync?.method ?? 'GET';
      const path = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
      const targetUrl = new URL(path, `${apiUrl.replace(/\/$/, '')}/`);
      const limit = body.limit ?? options.sync?.limit;
      if (limit != null) {
        targetUrl.searchParams.set('limit', String(limit));
      }
      const target = targetUrl.href;

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
        const merged = mergeSdkFromSettings(options, settings);
        const secretKey = String(merged.secretKey ?? '');

        if (!secretKey) {
          return json(400, { ok: false, error: 'secretKey is required for webhook signature verification.' });
        }

        if (!incomingSignature || incomingSignature !== secretKey) {
          return json(401, { ok: false, error: 'Invalid webhook signature.' });
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

  const publicLedgersEndpoint: Endpoint = {
    path: `${basePath}/public-ledgers`,
    method: 'get',
    handler: async (req) => {
      try {
        const user = (req as { user?: unknown }).user;
        if (!user) {
          return json(401, { ok: false, error: 'Unauthorized' });
        }

        const settings = await getSettings(req);
        const publishableKey = String(
          settings.publishableKey ?? options.sdk?.publishableKey ?? ''
        ).trim();
        const apiUrl = String(settings.apiUrl ?? options.sdk?.apiUrl ?? '').replace(/\/$/, '');
        if (!publishableKey || !apiUrl) {
          return json(400, {
            ok: false,
            error: 'Set publishableKey and apiUrl in Globals → icpay-settings (or plugin sdk).'
          });
        }

        const upstream = `${apiUrl}/sdk/public/ledgers/all-with-prices`;
        const res = await fetch(upstream, {
          headers: {
            Authorization: `Bearer ${publishableKey}`,
            Accept: 'application/json'
          }
        });

        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          return json(502, {
            ok: false,
            error: `ICPay API ledgers request failed (${res.status}).`,
            detail: detail.slice(0, 500)
          });
        }

        const data = (await res.json()) as unknown;
        const list = Array.isArray(data) ? data : [];
        const verified = list.filter((l: any) => l && l.verified === true);
        const mapped = verified
          .map((l: any) => ({
            shortcode: String(l.shortcode || l.symbol || '').trim(),
            symbol: l.symbol,
            name: l.name,
            chainName: String(l.chainName || '').trim() || 'Other'
          }))
          .filter((l) => l.shortcode);

        const chainMap = new Map<string, typeof mapped>();
        for (const item of mapped) {
          const c = item.chainName;
          if (!chainMap.has(c)) chainMap.set(c, []);
          chainMap.get(c)!.push(item);
        }

        const chains = Array.from(chainMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([chainName, ledgers]) => ({
            chainName,
            ledgers: ledgers.sort((a, b) =>
              String(a.symbol || a.shortcode).localeCompare(String(b.symbol || b.shortcode))
            )
          }));

        return json(200, { ok: true, chains });
      } catch (error: any) {
        return json(500, {
          ok: false,
          error: error?.message ?? 'Failed to load ledgers.'
        });
      }
    }
  };

  const clearPaymentsEndpoint: Endpoint = {
    path: `${basePath}/clear-payments`,
    method: 'post',
    handler: async (req) => {
      try {
        const user = (req as { user?: unknown }).user;
        if (!user) {
          return json(401, { ok: false, error: 'You must be signed in to the admin.' });
        }
        let deleted = 0;
        for (;;) {
          const page = await req.payload.find({
            collection: paymentsCollection as any,
            limit: 200,
            page: 1,
            depth: 0,
            overrideAccess: true
          });
          const docs = (page as { docs?: { id: string | number }[] }).docs ?? [];
          if (!docs.length) break;
          for (const doc of docs) {
            await req.payload.delete({
              collection: paymentsCollection as any,
              id: doc.id,
              overrideAccess: true
            });
            deleted += 1;
          }
        }
        return json(200, { ok: true, deleted });
      } catch (error: any) {
        return json(500, {
          ok: false,
          error: error?.message ?? 'Failed to clear payments.'
        });
      }
    }
  };

  return [
    createPaymentEndpoint,
    syncEndpointPost,
    syncEndpointGet,
    publicLedgersEndpoint,
    clearPaymentsEndpoint,
    webhookEndpoint,
    ...(options.additionalEndpoints ?? [])
  ];
};
