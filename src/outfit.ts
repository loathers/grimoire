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
  accesories: Item[] = [];
  skipDefaults = false;
  familiar?: Familiar;
  modifier?: string;
  avoid?: Item[];

  equip(item?: Item | Familiar | (Item | Familiar)[]): boolean {
    if (item === undefined) return true;
    if (Array.isArray(item)) return item.every((val) => this.equip(val));
    if (!have(item)) return false;
    if (item instanceof Item && !canEquip(item)) return false;
    if (this.avoid && this.avoid.find((i) => i === item) !== undefined) return false;

    if (item instanceof Item) {
      const slot = toSlot(item);
      if (slot === $slot`acc1`) {
        if (this.accesories.length >= 3) return false;
        this.accesories.push(item);
        return true;
      }
      if (slot === $slot`off-hand`) {
        const weapon = this.equips.get($slot`weapon`);
        if (weapon && weaponHands(weapon) === 2) return false;
      }
      if (!this.equips.has(slot)) {
        this.equips.set(slot, item);
        return true;
      }
      if (
        slot === $slot`weapon` &&
        !this.equips.has($slot`off-hand`) &&
        have($skill`Double-Fisted Skull Smashing`) &&
        weaponHands(item)
      ) {
        this.equips.set($slot`off-hand`, item);
        return true;
      }
      if (
        slot === $slot`off-hand` &&
        have($familiar`Left-Hand Man`) &&
        this.familiar === undefined &&
        !this.equips.has($slot`familiar`)
      ) {
        // eslint-disable-next-line libram/verify-constants
        if (item === $item`cursed magnifying glass` && !canChargeVoid()) {
          // Cursed magnifying glass cannot trigger in Lefty
          this.equips.set($slot`familiar`, this.equips.get($slot`off-hand`) ?? $item`none`);
          this.equips.set($slot`off-hand`, item);
        } else {
          this.familiar = $familiar`Left-Hand Man`;
          this.equips.set($slot`familiar`, item);
        }
        return true;
      }
      return false;
    } else {
      if (this.familiar && this.familiar !== item) return false;
      if (!have(item)) return false;
      this.familiar = item;
      return true;
    }
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
        if (this.accesories.length >= 3) return false;
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
    const accessoryEquips = this.accesories;
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
