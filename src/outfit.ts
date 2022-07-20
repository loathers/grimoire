import {
  canEquip,
  equip,
  equippedAmount,
  equippedItem,
  Familiar,
  Item,
  Slot,
  toSlot,
  useFamiliar,
  weaponHands,
} from "kolmafia";
import { $familiar, $item, $skill, $slot, $slots, get, have, Requirement } from "libram";

export class Outfit {
  equips: Map<Slot, Item> = new Map<Slot, Item>();
  accessories: Item[] = [];
  skipDefaults = false;
  familiar?: Familiar;
  modifier?: string;
  avoid?: Item[];

  private equipItem(item: Item): boolean {
    if (!have(item) || !canEquip(item)) return false;
    if (this.avoid?.find((i) => i === item)) return false;

    const slot = toSlot(item);
    switch (slot) {
      case $slot`acc1`:
        if (this.accessories.length >= 3) return false;
        this.accessories.push(item);
        return true;

      case $slot`off-hand`:
        if (
          weaponHands(this.equips.get($slot`weapon`) ?? $item`none`) === 2 ||
          this.equips.has($slot`off-hand`)
        ) {
          if (
            have($familiar`Left-Hand Man`) &&
            [undefined, $familiar`Left-Hand Man`].includes(this.familiar) &&
            !this.equips.get($slot`familiar`)
          ) {
            if (item === $item`cursed magnifying glass` && !canChargeVoid()) {
              const current = this.equips.get($slot`off-hand`);
              this.equips.set($slot`off-hand`, item);
              current
                ? this.equips.set($slot`familiar`, current)
                : this.equips.delete($slot`familiar`);
              return true;
            }
            this.equips.set($slot`familiar`, item);
            this.familiar = $familiar`Left-Hand Man`;
            return true;
          }
          return false;
        }
        break;

      case $slot`weapon`:
        if (
          weaponHands(this.equips.get($slot`weapon`) ?? $item`none`) === 1 &&
          have($skill`Double-Fisted Skull Smashing`) &&
          weaponHands(item) === 1
        ) {
          this.equips.set($slot`off-hand`, item);
          return true;
        }
    }

    if (!this.equips.has(slot)) {
      this.equips.set(slot, item);
      return true;
    }

    return false;
  }

  private equipFamiliar(familiar: Familiar): boolean {
    if (!have(familiar)) return false;
    if (this.familiar && this.familiar !== familiar) return false;
    this.familiar = familiar;
    return true;
  }

  equip(item?: Item | Familiar | (Item | Familiar)[]): boolean {
    if (item === undefined) return true;
    if (Array.isArray(item)) return item.every((val) => this.equip(val));
    return item instanceof Item ? this.equipItem(item) : this.equipFamiliar(item);
  }

  canEquip(item?: Item | Familiar | (Item | Familiar)[]): boolean {
    if (item === undefined) return true;
    if (Array.isArray(item)) return item.every((val) => this.canEquip(val)); // TODO: smarter
    if (!have(item)) return false;
    if (item instanceof Item && !canEquip(item)) return false;
    if (this.avoid && this.avoid.find((i) => i === item) !== undefined) return false;

    if (item instanceof Item) {
      const slot = toSlot(item);
      if (slot === $slot`acc1`) {
        if (this.accessories.length >= 3) return false;
        return true;
      }
      if (slot === $slot`off-hand`) {
        const weapon = this.equips.get($slot`weapon`);
        if (weapon && weaponHands(weapon) === 2) return false;
      }
      if (!this.equips.has(slot)) {
        return true;
      }
      if (
        slot === $slot`weapon` &&
        !this.equips.has($slot`off-hand`) &&
        have($skill`Double-Fisted Skull Smashing`) &&
        weaponHands(item)
      ) {
        return true;
      }
      if (
        slot === $slot`off-hand` &&
        have($familiar`Left-Hand Man`) &&
        this.familiar === undefined &&
        !this.equips.has($slot`familiar`)
      ) {
        return true;
      }
      return false;
    } else {
      if (this.familiar && this.familiar !== item) return false;
      if (!have(item)) return false;
      return true;
    }
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
}

function canChargeVoid(): boolean {
  return get("_voidFreeFights") < 5 && get("cursedMagnifyingGlassCount") < 13;
}
