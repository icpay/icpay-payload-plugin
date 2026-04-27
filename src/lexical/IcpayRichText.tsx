import { RichText } from '@payloadcms/richtext-lexical/react';

import {
  IcpayLexicalWidgetRenderer,
  type IcpayLexicalWidgetBlockData,
  type IcpayLexicalWidgetDefaults
} from './IcpayLexicalWidgetRenderer';

export type { IcpayLexicalWidgetDefaults };

export type IcpayRichTextProps = {
  /** Serialized Lexical editor state from Payload `richText`. */
  data: NonNullable<Parameters<typeof RichText>[0]['data']>;
  /** Values from Globals → `icpay-settings` (or your own fallbacks). */
  widgetDefaults: IcpayLexicalWidgetDefaults;
  /** Optional wrapper class for prose styling (e.g. `cms-rich-text`). */
  className?: string;
};

/** Strip Lexical block envelope fields before passing widget props to the renderer. */
export function lexicalIcpayFieldsToBlockData(fields: Record<string, unknown>): IcpayLexicalWidgetBlockData {
  const { id: _id, blockName: _blockName, blockType: _blockType, ...rest } = fields;
  return rest;
}

/**
 * Renders Payload Lexical rich text and maps embedded **ICPay Widget** blocks to
 * {@link IcpayLexicalWidgetRenderer} (client island). Use with {@link icpayWidgetBlocksFeature}
 * on the same field’s `lexicalEditor`.
 */
export function IcpayRichText({ data, widgetDefaults, className = 'cms-rich-text' }: IcpayRichTextProps) {
  return (
    <div className={className}>
      <RichText
        data={data}
        converters={({ defaultConverters }) => ({
          ...defaultConverters,
          blocks: {
            ...(defaultConverters.blocks ?? {}),
            icpayWidget: ({
              node
            }: {
              node: { fields: Record<string, unknown> };
            }) => (
              <IcpayLexicalWidgetRenderer
                block={lexicalIcpayFieldsToBlockData(node.fields)}
                defaults={widgetDefaults}
              />
            )
          }
        })}
      />
    </div>
  );
}
