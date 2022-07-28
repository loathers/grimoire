import {
  booleanModifier,
  canEquip,
  equip,
  equippedAmount,
  equippedItem,
  Familiar,
  Item,
  weaponHands as mafiaWeaponHands,
  Slot,
  toSlot,
  useFamiliar,
} from "kolmafia";
import { $familiar, $item, $skill, $slot, $slots, have, Requirement } from "libram";

const weaponHands = (i?: Item) => (i ? mafiaWeaponHands(i) : 0);

export class Outfit {
  equips: Map<Slot, Item> = new Map<Slot, Item>();
  accessories: Item[] = [];
  skipDefaults = false;
  familiar?: Familiar;
  modifier?: string;
  avoid?: Item[];

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
    if (item !== $item`none`) return false;
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
        if (this.familiar === undefined || !canEquip(this.familiar, item)) return false;
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
      (this.isAvailable(item) &&
        (this.equipItemNone(item, slot) ||
          this.equipNonAccessory(item, slot) ||
          this.equipAccessory(item, slot) ||
          this.equipUsingDualWield(item, slot) ||
          this.equipUsingFamiliar(item, slot)))
    );
  }

  private equipFamiliar(familiar: Familiar): boolean {
    if (familiar === this.familiar) return true;
    if (this.familiar !== undefined) return false;
    if (familiar !== $familiar`none` && !have(familiar)) return false;
    const item = this.equips.get($slot`familiar`);
    if (item !== undefined && item !== $item`none` && !canEquip(familiar, item)) return false;
    this.familiar = familiar;
    return true;
  }

  equip(item: Item | Familiar | (Item | Familiar)[], slot?: Slot): boolean {
    if (Array.isArray(item)) {
      if (slot !== undefined) return item.some((val) => this.equip(val, slot));
      return item.every((val) => this.equip(val));
    }
    return item instanceof Item ? this.equipItem(item, slot) : this.equipFamiliar(item);
  }

  canEquip(item: Item | Familiar | (Item | Familiar)[]): boolean {
    const outfit = this.clone();
    if (!Array.isArray(item)) item = [item];
    return item.every((val) => outfit.equip(val));
  }

  dress(): void {
    if (this.familiar) useFamiliar(this.familiar);
    const targetEquipment = Array.from(this.equips.values());
    const accessorySlots = $slots`acc1, acc2, acc3`;
    for (const slot of $slots`weapon, off-hand, hat, shirt, pants, familiar, buddy-bjorn, crown-of-thrones, back`) {
      if (
        targetEquipment.includes(equippedItem(slot)) &&
        this.equips.get(slot) !== equippedItem(slot)
      )
        equip(slot, $item`none`);
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
        currentEquip === $item`none` ||
        equippedAmount(currentEquip) >
          accessoryEquips.filter((accessory) => accessory === currentEquip).length
      ) {
        equip(slot, toEquip);
      }
    }

    if (this.modifier) {
      // Handle familiar equipment manually to avoid weird Left-Hand Man behavior
      const fam_equip = this.equips.get($slot`familiar`);
      if (fam_equip !== undefined) {
        const index = targetEquipment.indexOf(fam_equip);
        if (index > -1) targetEquipment.splice(index, 1);
      }

      let requirements = Requirement.merge([
        new Requirement([this.modifier], {
          forceEquip: targetEquipment.concat(...accessoryEquips),
        }),
      ]);

      if (fam_equip !== undefined) {
        requirements = Requirement.merge([
          requirements,
          new Requirement([], { preventSlot: [$slot`familiar`] }),
        ]);
      }

      if (this.avoid !== undefined) {
        requirements = Requirement.merge([
          requirements,
          new Requirement([], { preventEquip: this.avoid }),
        ]);
      }

      if (!requirements.maximize()) {
        throw `Unable to maximize ${this.modifier}`;
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
