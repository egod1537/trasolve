import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GoogleOverlayHost } from '../src/adapters/map/GoogleOverlayHost.ts';

function setup(t) {
  const children = new Set();
  const pane = { append: (element) => children.add(element) };
  const camera = { x: 10, y: 20, width: 1024, zoom: 2, heading: 0, tilt: 0 };
  const map = {
    getCenter: () => ({ lat: 35, lng: 139 }),
    getZoom: () => camera.zoom,
    getHeading: () => camera.heading,
    getTilt: () => camera.tilt,
  };
  let overlay;
  let protectedElement;
  class OverlayView {
    constructor() {
      overlay = this;
    }
    static preventMapHitsFrom(element) {
      protectedElement = element;
    }
    setMap(value) {
      if (this.map) this.onRemove();
      this.map = value;
      if (value) this.onAdd();
    }
    getPanes() {
      return { overlayMouseTarget: pane };
    }
    getProjection() {
      return {
        fromLatLngToDivPixel: () => ({ x: camera.x, y: camera.y }),
        getWorldWidth: () => camera.width,
      };
    }
  }
  class LatLng {
    constructor(lat, lng) {
      this.lat = lat;
      this.lng = lng;
    }
  }
  const previousDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document',
  );
  const previousGoogle = Object.getOwnPropertyDescriptor(globalThis, 'google');
  globalThis.document = {
    createElement: () => ({
      remove() {
        children.delete(this);
      },
    }),
  };
  globalThis.google = { maps: { OverlayView, LatLng } };
  t.after(() => {
    for (const [key, previous] of [
      ['document', previousDocument],
      ['google', previousGoogle],
    ]) {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else delete globalThis[key];
    }
  });
  const host = new GoogleOverlayHost();
  t.after(() => host.dispose());
  return { host, overlay, camera, map, children, protectedElement };
}

test('attaches to the interactive pane and waits for the first SDK draw', (t) => {
  const { host, overlay, map, children, protectedElement } = setup(t);
  const point = { lat: 35, lng: 139 };
  assert.equal(host.project(point), null);
  host.attach(map);
  assert.ok(children.has(host.getElement()));
  assert.equal(protectedElement, host.getElement());
  assert.equal(host.project(point), null);
  overlay.draw();
  assert.deepEqual(host.project(point), { x: 10, y: 20 });
  const revision = host.getProjectionRevision();
  host.attach(map);
  assert.equal(host.getProjectionRevision(), revision);
  assert.deepEqual(host.project(point), { x: 10, y: 20 });
});

test('panning notifies culling without invalidating unchanged pane coordinates', (t) => {
  const { host, overlay, map, camera } = setup(t);
  let draws = 0;
  const stop = host.subscribeDraw(() => draws++);
  host.attach(map);
  overlay.draw();
  let revision = host.getProjectionRevision();
  map.getCenter = () => ({ lat: 36, lng: 140 });
  overlay.draw();
  assert.equal(draws, 2);
  assert.equal(host.getProjectionRevision(), revision);

  for (const key of ['x', 'y', 'width', 'zoom', 'heading', 'tilt']) {
    camera[key] += 1;
    overlay.draw();
    assert.ok(host.getProjectionRevision() > revision, key);
    revision = host.getProjectionRevision();
  }
  stop();
  stop();
  const previousDraws = draws;
  overlay.draw();
  assert.equal(draws, previousDraws);
});

test('reattaching invalidates coordinates and disposal removes the pane and listeners', (t) => {
  const { host, overlay, map, children } = setup(t);
  const point = { lat: 35, lng: 139 };
  host.attach(map);
  overlay.draw();
  const revision = host.getProjectionRevision();
  host.attach({ ...map });
  assert.ok(host.getProjectionRevision() > revision);
  assert.equal(host.project(point), null);
  overlay.draw();
  assert.deepEqual(host.project(point), { x: 10, y: 20 });

  host.subscribeDraw(() => assert.fail('draw after disposal'));
  host.dispose();
  host.dispose();
  host.subscribeDraw(() => assert.fail('subscription after disposal'));
  overlay.draw();
  host.attach(map);
  assert.equal(children.size, 0);
  assert.equal(overlay.map, null);
  assert.equal(host.project(point), null);
});
