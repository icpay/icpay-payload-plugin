import type { Endpoint, PayloadRequest } from 'payload';
import type { IcpayPluginOptions, IcpayCheckoutInput, IcpayWebhookRecord } from './types';
import { createIcpayClient, toCreateTransactionRequest } from './sdk';

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

const safeCreate = async (
  req: PayloadRequest,
  collection: string,
  data: Record<string, unknown>
): Promise<void> => {
  try {
    await req.payload.create({
      collection,
      data
    });
  } catch {
    // Collection may be disabled intentionally; endpoint should continue to work.
  }
};

export const createIcpayEndpoints = (options: IcpayPluginOptions): Endpoint[] => {
  const basePath = options.apiBasePath ?? '/icpay';
  const paymentsCollection = options.collections?.payments ?? 'icpay-payments';
  const webhooksCollection = options.collections?.webhooks ?? 'icpay-webhooks';
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

        const client = createIcpayClient(options);
        const request = toCreateTransactionRequest(checkout, options);
        const response = await client.createPayment(request);

        const paymentIntentId =
          (response as any)?.payment?.paymentIntent?.id ??
          (response as any)?.payment?.id ??
          checkout.paymentIntentId ??
          null;

        await safeCreate(req, paymentsCollection, {
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
          raw: response as unknown as Record<string, unknown>
        });

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

  const notifyEndpoint: Endpoint = {
    path: `${basePath}/notify`,
    method: 'post',
    handler: async (req) => {
      try {
        const body = (await parseBody(req)) as {
          paymentIntentId?: string;
          transactionId?: string;
          canisterTransactionId?: string;
          orderId?: string;
        };

        if (!body?.paymentIntentId) {
          return json(400, {
            error: 'paymentIntentId is required.'
          });
        }

        const client = createIcpayClient(options);
        const result = await client.notifyPaymentIntentOnRamp({
          paymentIntentId: body.paymentIntentId,
          orderId: body.orderId
        });
        result.stop();

        return json(200, {
          ok: true,
          paymentIntentId: body.paymentIntentId
        });
      } catch (error: any) {
        return json(500, {
          ok: false,
          error: error?.message ?? 'Failed to notify payment intent.'
        });
      }
    }
  };

  const webhookEndpoint: Endpoint = {
    path: `${basePath}/webhook`,
    method: 'post',
    handler: async (req) => {
      try {
        const payload = (await parseBody(req)) as Record<string, unknown>;
        const incomingSignature = signatureHeader(req);

        if (options.webhookSecret) {
          if (!incomingSignature || incomingSignature !== options.webhookSecret) {
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

        await safeCreate(req, webhooksCollection, {
          eventType: event.eventType,
          eventId: event.eventId,
          paymentIntentId: event.paymentIntentId,
          signature: event.signature,
          payload: event.payload
        });

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

  return [createPaymentEndpoint, notifyEndpoint, webhookEndpoint, ...(options.additionalEndpoints ?? [])];
};
