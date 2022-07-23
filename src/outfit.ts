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

  private equipItem(item: Item, slot?: Slot): boolean {
    if (this.avoid?.includes(item)) return false;
    if (item === $item`none`) {
      if (slot === undefined) return true;
      if (slot === $slot`weapon` && this.equips.has($slot`off-hand`)) return false;
      this.equips.set(slot, item);
      return true;
    }
    const equipment = [...this.equips.values(), ...this.accessories];
    if (slot === undefined && equipment.includes(item)) return true;
    const needed = equipment.filter((i) => i === item).length + 1;
    if (!have(item, needed)) return false;
    if (booleanModifier(item, "Single Equip") && needed > 1) return false;

    const category = toSlot(item);
    const handsFull =
      weaponHands(this.equips.get($slot`weapon`)) === 2 || this.equips.has($slot`off-hand`);
    const holder = new Map([
      [$slot`weapon`, $familiar`Disembodied Hand`],
      [$slot`off-hand`, $familiar`Left-Hand Man`],
    ]).get(category);
    if (
      holder !== undefined &&
      (slot === $slot`familiar` || (slot === undefined && (handsFull || !canEquip(item)))) &&
      !booleanModifier(item, "Single Equip") &&
      this.equipFamiliar(holder)
    ) {
      this.equips.set($slot`familiar`, item);
      return true;
    }

    // Items equipped on equipment-holding familiars ignore stat requirements
    if (!canEquip(item)) return false;
    switch (category) {
      case $slot`weapon`:
        if (
          [undefined, $slot`off-hand`].includes(slot) &&
          weaponHands(this.equips.get($slot`weapon`)) === 1 &&
          have($skill`Double-Fisted Skull Smashing`) &&
          weaponHands(item) === 1 &&
          !this.equips.has($slot`off-hand`)
        ) {
          this.equips.set($slot`off-hand`, item);
          return true;
        }
        break;
      case $slot`acc1`:
        if (![undefined, ...$slots`acc1, acc2, acc3`].includes(slot)) return false;
        if (this.accessories.length >= 3) return false;
        this.accessories.push(item);
        return true;
    }
    if (slot !== undefined && slot !== category) return false;
    if (this.equips.has(category)) return false;
    this.equips.set(category, item);
    return true;
  }

  private equipFamiliar(familiar: Familiar): boolean {
    if (familiar !== $familiar`none` && !have(familiar)) return false;
    if (this.familiar !== undefined && this.familiar !== familiar) return false;
    this.familiar = familiar;
    return true;
  }

  equip(item?: Item | Familiar | (Item | Familiar)[], slot?: Slot): boolean {
    if (item === undefined) return true;
    if (Array.isArray(item)) {
      if (slot !== undefined) return item.some((val) => this.equip(val, slot));
      return item.every((val) => this.equip(val));
    }
    return item instanceof Item ? this.equipItem(item, slot) : this.equipFamiliar(item);
  }

  canEquip(item?: Item | Familiar | (Item | Familiar)[]): boolean {
    if (item === undefined) return true;
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

  clone(): this {
    const result = { ...this };
    result.equips = new Map(result.equips);
    result.accessories = [...result.accessories];
    return result;
  }
}
