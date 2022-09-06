import {
  booleanModifier,
  canEquip,
  equip,
  equippedAmount,
  equippedItem,
  Familiar,
  Item,
  weaponHands as mafiaWeaponHands,
  myFamiliar,
  Slot,
  toSlot,
  useFamiliar,
} from "kolmafia";
import { $familiar, $item, $skill, $slot, $slots, have, MaximizeOptions, Requirement } from "libram";
import { outfitSlots, OutfitSpec } from "./task";

const weaponHands = (i?: Item) => (i ? mafiaWeaponHands(i) : 0);

export class Outfit {
  equips: Map<Slot, Item> = new Map<Slot, Item>();
  accessories: Item[] = [];
  skipDefaults = false;
  familiar?: Familiar;
  modifier = "";
  avoid: Item[] = [];

  private countEquipped(item: Item): number {
    return [...this.equips.values(), ...this.accessories].filter((i) => i === item).length;
  }

  private isAvailable(item: Item): boolean {
    if (this.avoid?.includes(item)) return false;
    if (!have(item, this.countEquipped(item) + 1)) return false;
    if (booleanModifier(item, "Single Equip") && this.countEquipped(item) > 0) return false;
    return true;
  }

  private haveEquipped(item: Item, slot?: Slot): boolean {
    if (slot === undefined) return this.countEquipped(item) > 0;
    if ($slots`acc1, acc2, acc3`.includes(slot)) return this.accessories.includes(item); // TODO handle equipping multiple of an accessory
    return this.equips.get(slot) === item;
  }

  private equipItemNone(item: Item, slot?: Slot): boolean {
    if (item !== $item.none) return false;
    if (slot === undefined) return true;
    if (this.equips.has(slot)) return false;
    this.equips.set(slot, item);
    return true;
  }

  private equipNonAccessory(item: Item, slot?: Slot) {
    if ($slots`acc1, acc2, acc3`.includes(toSlot(item))) return false;
    if (slot !== undefined && slot !== toSlot(item)) return false;
    if (this.equips.has(toSlot(item))) return false;
    switch (toSlot(item)) {
      case $slot`off-hand`:
        if (this.equips.has($slot`weapon`) && weaponHands(this.equips.get($slot`weapon`)) !== 1) {
          return false;
        }
        break;
      case $slot`familiar`:
        if (this.familiar !== undefined && !canEquip(this.familiar, item)) return false;
    }
    if (toSlot(item) !== $slot`familiar` && !canEquip(item)) return false;
    this.equips.set(toSlot(item), item);
    return true;
  }

  private equipAccessory(item: Item, slot?: Slot): boolean {
    if (![undefined, ...$slots`acc1, acc2, acc3`].includes(slot)) return false;
    if (toSlot(item) !== $slot`acc1`) return false;
    if (this.accessories.length >= 3) return false;
    if (!canEquip(item)) return false;
    this.accessories.push(item);
    return true;
  }

  private equipUsingDualWield(item: Item, slot?: Slot): boolean {
    if (![undefined, $slot`off-hand`].includes(slot)) return false;
    if (toSlot(item) !== $slot`weapon`) return false;
    if (this.equips.has($slot`weapon`) && weaponHands(this.equips.get($slot`weapon`)) !== 1) {
      return false;
    }
    if (this.equips.has($slot`off-hand`)) return false;
    if (!have($skill`Double-Fisted Skull Smashing`)) return false;
    if (weaponHands(item) !== 1) return false;
    if (!canEquip(item)) return false;
    this.equips.set($slot`off-hand`, item);
    return true;
  }

  private getHoldingFamiliar(item: Item): Familiar | undefined {
    switch (toSlot(item)) {
      case $slot`weapon`:
        return $familiar`Disembodied Hand`;
      case $slot`off-hand`:
        return $familiar`Left-Hand Man`;
      default:
        return undefined;
    }
  }

  private equipUsingFamiliar(item: Item, slot?: Slot): boolean {
    if (![undefined, $slot`familiar`].includes(slot)) return false;
    if (this.equips.has($slot`familiar`)) return false;
    if (booleanModifier(item, "Single Equip")) return false;
    const familiar = this.getHoldingFamiliar(item);
    if (familiar === undefined || !this.equip(familiar)) return false;
    this.equips.set($slot`familiar`, item);
    return true;
  }

  private equipItem(item: Item, slot?: Slot): boolean {
    return (
      this.haveEquipped(item, slot) ||
      this.equipItemNone(item, slot) ||
      (this.isAvailable(item) &&
        (this.equipNonAccessory(item, slot) ||
          this.equipAccessory(item, slot) ||
          this.equipUsingDualWield(item, slot) ||
          this.equipUsingFamiliar(item, slot)))
    );
  }

  private equipFamiliar(familiar: Familiar): boolean {
    if (familiar === this.familiar) return true;
    if (this.familiar !== undefined) return false;
    if (familiar !== $familiar.none && !have(familiar)) return false;
    const item = this.equips.get($slot`familiar`);
    if (item !== undefined && item !== $item.none && !canEquip(familiar, item)) return false;
    this.familiar = familiar;
    return true;
  }

  private equipSpec(spec: OutfitSpec): boolean {
    let succeeded = true;
    for (const slotName of outfitSlots) {
      const slot =
        new Map([
          ["famequip", $slot`familiar`],
          ["offhand", $slot`off-hand`],
        ]).get(slotName) ?? toSlot(slotName);
      const itemOrItems = spec[slotName];
      if (itemOrItems !== undefined && !this.equip(itemOrItems, slot)) succeeded = false;
    }
    for (const item of spec?.equip ?? []) {
      if (!this.equip(item)) succeeded = false;
    }
    if (spec?.familiar !== undefined) {
      if (!this.equip(spec.familiar)) succeeded = false;
    }
    this.avoid.push(...spec?.avoid ?? [])
    this.skipDefaults = this.skipDefaults && (spec.skipDefaults ?? false);
    if (spec.modifier) {
      this.modifier += (this.modifier ? ", " : "") + spec.modifier;
    }
    return succeeded;
  }

  equip(item: Item | Familiar | OutfitSpec | Item[], slot?: Slot): boolean {
    if (Array.isArray(item)) {
      if (slot !== undefined) return item.some((val) => this.equip(val, slot));
      return item.every((val) => this.equip(val));
    }
    if (item instanceof Item) return this.equipItem(item, slot);
    if (item instanceof Familiar) return this.equipFamiliar(item);
    return this.equipSpec(item);
  }

  canEquip(item: Item | Familiar | OutfitSpec | Item[]): boolean {
    const outfit = this.clone();
    if (Array.isArray(item)) return item.every((val) => outfit.equip(val));
    return outfit.equip(item);
  }

  /**
   * Equip this outfit.
   * @param extraOptions Passed to any maximizer calls made.
   */
  dress(extraOptions?: Partial<MaximizeOptions>): void {
    if (this.familiar) useFamiliar(this.familiar);
    const targetEquipment = Array.from(this.equips.values());
    const accessorySlots = $slots`acc1, acc2, acc3`;
    for (const slot of $slots`weapon, off-hand, hat, shirt, pants, familiar, buddy-bjorn, crown-of-thrones, back`) {
      if (
        targetEquipment.includes(equippedItem(slot)) &&
        this.equips.get(slot) !== equippedItem(slot)
      )
        equip(slot, $item.none);
    }

    //Order is anchored here to prevent DFSS shenanigans
    for (const slot of $slots`weapon, off-hand, hat, back, shirt, pants, familiar, buddy-bjorn, crown-of-thrones`) {
      const equipment = this.equips.get(slot);
      if (equipment) equip(slot, equipment);
    }

    //We don't care what order accessories are equipped in, just that they're equipped
    const accessoryEquips = this.accessories;
    for (const slot of accessorySlots) {
      const toEquip = accessoryEquips.find(
        (equip) =>
          equippedAmount(equip) < accessoryEquips.filter((accessory) => accessory === equip).length
      );
      if (!toEquip) break;
      const currentEquip = equippedItem(slot);
      //We never want an empty accessory slot
      if (
        currentEquip === $item.none ||
        equippedAmount(currentEquip) >
          accessoryEquips.filter((accessory) => accessory === currentEquip).length
      ) {
        equip(slot, toEquip);
      }
    }

    if (this.modifier) {
      const allRequirements = [new Requirement([this.modifier], {
        preventSlot: [...this.equips.keys()],
        forceEquip: accessoryEquips,
        preventEquip: this.avoid,
      })];
      if (extraOptions) allRequirements.push(new Requirement([], extraOptions));

      if (!Requirement.merge(allRequirements).maximize()) {
        throw `Unable to maximize ${this.modifier}`;
      }
    }

    // Verify that all equipment was indeed equipped
    if (this.familiar !== undefined && myFamiliar() !== this.familiar)
      throw `Failed to fully dress (expected: familiar ${this.familiar})`;
    for (const slotted_item of this.equips) {
      if (equippedItem(slotted_item[0]) !== slotted_item[1]) {
        throw `Failed to fully dress (expected: ${slotted_item[0]} ${slotted_item[1]})`;
      }
    }
    for (const accessory of this.accessories) {
      if (!$slots`acc1, acc2, acc3`.some((slot) => equippedItem(slot) === accessory)) {
        throw `Failed to fully dress (expected: acc ${accessory})`;
      }
    }
  }

  clone(): Outfit {
    const result = new Outfit();
    result.equips = new Map(this.equips);
    result.accessories = [...this.accessories];
    result.skipDefaults = this.skipDefaults;
    result.familiar = this.familiar;
    result.modifier = this.modifier;
    result.avoid = this.avoid;
    return result;
  }
}
