import { ITEM_DEFINITIONS } from '@dtr/shared-items';
import type { ItemType } from '@dtr/shared-protocol';

interface Props {
  heldItem: ItemType | null;
  speedBoostMs: number;
  shieldMs: number;
}

/** Who an item affects, spelled out so players do not need to memorise icons. */
export function itemTargetLabel(item: ItemType): string {
  const effect = ITEM_DEFINITIONS[item].effect;
  return effect.category === 'selfBenefit' ? 'Affects: you' : 'Affects: the race leader';
}

export function PowerUpHUD({ heldItem, speedBoostMs, shieldMs }: Props) {
  const item = heldItem ? ITEM_DEFINITIONS[heldItem] : null;
  const active = speedBoostMs > 0 || shieldMs > 0;
  const state = item ? 'ready' : active ? 'active' : 'empty';
  return (
    <section className="hud-item" aria-label="Power-up" data-state={state}>
      <div className={`item-slot${item ? ' full' : ''}`}>
        <span aria-hidden="true">{item?.icon ?? '?'}</span>
      </div>
      <div>
        <strong>{item ? item.displayName : active ? 'Effect active' : 'No item'}</strong>
        {item && <small className="item-target">{itemTargetLabel(item.type)}</small>}
        <small>{item ? 'Press E to use' : 'Grab a ? box'}</small>
        {speedBoostMs > 0 && (
          <small className="effect">Kaffe Boost {(speedBoostMs / 1000).toFixed(1)}s</small>
        )}
        {shieldMs > 0 && <small className="effect">Shield {(shieldMs / 1000).toFixed(1)}s</small>}
      </div>
    </section>
  );
}
