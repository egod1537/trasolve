import { memo, useState } from 'react';
import type { ChatWebImage } from '@trasolve/shared';

export const ChatWebImages = memo(function ChatWebImages({
  images,
}: {
  images: readonly ChatWebImage[] | undefined;
}) {
  if (!images?.length) {
    return null;
  }
  return (
    <div className="chat-v2-web-images">
      {images.map((image) => (
        <WebImage key={image.imageUrl} image={image} />
      ))}
    </div>
  );
});

function WebImage({ image }: { image: ChatWebImage }) {
  const [source, setSource] = useState(image.thumbnailUrl ?? image.imageUrl);
  const [visible, setVisible] = useState(true);
  if (!visible) {
    return null;
  }
  const host = getSourceHost(image.sourceUrl);
  return (
    <figure className="chat-v2-web-image">
      <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer">
        <img
          src={source}
          alt={image.caption ?? host}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            if (source !== image.imageUrl) {
              setSource(image.imageUrl);
            } else {
              setVisible(false);
            }
          }}
        />
        <figcaption>
          {image.caption && <span>{image.caption}</span>}
          <small>{host}</small>
        </figcaption>
      </a>
    </figure>
  );
}

function getSourceHost(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    return sourceUrl;
  }
}
