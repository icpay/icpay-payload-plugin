import { BlocksFeature } from '@payloadcms/richtext-lexical';

import { icpayWidgetBlock } from './icpayWidgetBlock';

/**
 * Add to your `lexicalEditor({ features })` so editors can insert {@link icpayWidgetBlock}
 * anywhere in Lexical rich text (WordPress-style block inserter).
 *
 * @example
 * ```ts
 * import { lexicalEditor } from '@payloadcms/richtext-lexical';
 * import { icpayWidgetBlocksFeature } from '@ic-pay/payload-plugin-icpay/lexical';
 *
 * { name: 'content', type: 'richText', editor: lexicalEditor({
 *   features: ({ defaultFeatures }) => [...defaultFeatures, icpayWidgetBlocksFeature()],
 * }) }
 * ```
 */
export const icpayWidgetBlocksFeature = () => BlocksFeature({ blocks: [icpayWidgetBlock] });
