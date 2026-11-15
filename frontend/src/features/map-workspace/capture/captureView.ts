// DOM capture saves directly. WebGL maps require native tab pixels: their drawing
// buffers are not preserved and cannot be faithfully copied by DOM renderers.
export function requiresNativeCapture(root: HTMLElement): boolean {
  return root.querySelector('canvas') !== null;
}

async function nativeCapture(): Promise<HTMLCanvasElement> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'browser' },
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
    surfaceSwitching: 'exclude',
  } as DisplayMediaStreamOptions);
  const video = document.createElement('video');
  try {
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    await new Promise<void>((resolve, reject) => {
      let timer = 0;
      const abort = () => {
        clearTimeout(timer);
        reject(new Error('Capture ended'));
      };
      const frame = () => {
        clearTimeout(timer);
        stream.getVideoTracks()[0]?.removeEventListener('ended', abort);
        resolve();
      };
      stream
        .getVideoTracks()[0]
        ?.addEventListener('ended', abort, { once: true });
      timer = window.setTimeout(abort, 10000);
      video.requestVideoFrameCallback(frame);
    });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    if (!canvas.width || !canvas.height) {
      throw new Error('Empty capture');
    }
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas unavailable');
    }
    context.drawImage(video, 0, 0);
    return canvas;
  } finally {
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    video.remove();
  }
}

export async function captureView(
  root: HTMLElement,
  native: boolean,
): Promise<void> {
  const canvas = native
    ? await nativeCapture()
    : await (async () => {
        const { default: html2canvas } = await import('html2canvas-pro');
        await document.fonts.ready;
        return html2canvas(root, {
          useCORS: true,
          allowTaint: false,
          logging: false,
          width: window.innerWidth,
          height: window.innerHeight,
          x: window.scrollX,
          y: window.scrollY,
          scale: Math.min(window.devicePixelRatio || 1, 2),
          ignoreElements: (element) =>
            element.hasAttribute('data-capture-ignore'),
        });
      })();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value ? resolve(value) : reject(new Error('PNG export failed')),
      'image/png',
    ),
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = `trasolve-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
