export interface MapObjectHandle {
  readonly id: string;
  setVisible(visible: boolean): void;
  setZIndex(zIndex: number): void;
  /** Idempotent. Setters and subscriptions on removed handles are no-ops. */
  remove(): void;
}

export type MapObjectBaseOptions = {
  /** Unique within the adapter; duplicates throw before creating an object. */
  id?: string;
  layer?: string;
  visible?: boolean;
  zIndex?: number;
};
