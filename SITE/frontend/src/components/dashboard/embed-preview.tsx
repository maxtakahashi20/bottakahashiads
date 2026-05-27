'use client';

type EmbedPreviewProps = {
  title?: string | null;
  description?: string | null;
  color?: number | null;
  bannerUrl?: string | null;
  thumbnailUrl?: string | null;
  footerText?: string | null;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
};

export function EmbedPreview(props: EmbedPreviewProps) {
  const colorHex = props.color != null ? `#${props.color.toString(16).padStart(6, '0')}` : '#5865F2';

  return (
    <div className="rounded-lg border border-border bg-[#2b2d31] p-4 text-sm">
      <div className="flex gap-3">
        <div className="w-1 shrink-0 rounded-full" style={{ backgroundColor: colorHex }} />
        <div className="min-w-0 flex-1 space-y-2">
          {props.title && <p className="font-semibold text-white">{props.title}</p>}
          {props.description && (
            <p className="whitespace-pre-wrap text-[#dbdee1]">{props.description}</p>
          )}
          {props.bannerUrl && (
            <img src={props.bannerUrl} alt="" className="max-h-48 w-full rounded object-cover" />
          )}
          {props.footerText && (
            <p className="text-xs text-[#949ba4]">{props.footerText}</p>
          )}
          {props.buttonLabel && props.buttonUrl && (
            <a
              href={props.buttonUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded bg-[#5865f2] px-4 py-1.5 text-xs font-medium text-white"
            >
              {props.buttonLabel}
            </a>
          )}
        </div>
        {props.thumbnailUrl && (
          <img src={props.thumbnailUrl} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
        )}
      </div>
    </div>
  );
}
