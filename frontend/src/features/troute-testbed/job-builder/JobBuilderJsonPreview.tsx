import { Button, Classes, Intent, Tag } from '@blueprintjs/core';
import { useEffect, useMemo, useState } from 'react';
import type { TrouteOptimizeRequest } from '@trasolve/shared';

interface JobBuilderJsonPreviewProps {
  request: TrouteOptimizeRequest;
  valid: boolean;
}

export function JobBuilderJsonPreview({
  request,
  valid,
}: JobBuilderJsonPreviewProps) {
  const [copied, setCopied] = useState(false);
  const json = useMemo(() => JSON.stringify(request, null, 2), [request]);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 1_500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <details className="job-builder-json-preview">
      <summary>
        <span>Advanced / 요청 JSON</span>
        <Tag
          intent={valid ? Intent.SUCCESS : Intent.WARNING}
          icon={valid ? 'tick' : 'warning-sign'}
          minimal
        >
          {valid ? '유효함' : '입력 필요'}
        </Tag>
      </summary>
      <div>
        <header>
          <code className={Classes.TEXT_MUTED}>{request.job_id}</code>
          <Button
            icon={copied ? 'tick' : 'clipboard'}
            intent={copied ? Intent.SUCCESS : Intent.NONE}
            size="small"
            variant="minimal"
            onClick={() => {
              void navigator.clipboard
                .writeText(json)
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
          >
            {copied ? '복사됨' : '복사'}
          </Button>
        </header>
        <pre className={`${Classes.CODE_BLOCK} job-builder-json-code`}>
          {json}
        </pre>
      </div>
    </details>
  );
}
