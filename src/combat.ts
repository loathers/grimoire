import { Monster } from "kolmafia";
import { Macro } from "libram";

export type DelayedMacro = Macro | (() => Macro);
function undelay(macro: DelayedMacro): Macro {
  if (macro instanceof Macro) return macro;
  else return macro();
}

export class CombatStrategy {
  init_macro?: DelayedMacro;
  default_macro?: DelayedMacro[];
  macros: Map<Monster, DelayedMacro[]> = new Map();

  public macro(strategy: DelayedMacro, ...monsters: Monster[]): CombatStrategy {
    if (monsters.length === 0) {
      if (this.default_macro === undefined) this.default_macro = [];
      this.default_macro.push(strategy);
    }
    for (const monster of monsters) {
      if (!this.macros.has(monster)) this.macros.set(monster, []);
      this.macros.get(monster)?.push(strategy);
    }
    return this;
  }

  public prependMacro(strategy: DelayedMacro, ...monsters: Monster[]): CombatStrategy {
    if (monsters.length === 0) {
      this.init_macro = strategy;
    }
    for (const monster of monsters) {
      if (!this.macros.has(monster)) this.macros.set(monster, []);
      this.macros.get(monster)?.unshift(strategy);
    }
    return this;
  }

  public clone(): CombatStrategy {
    const result = new CombatStrategy();
    result.default_macro = this.default_macro;
    result.macros = new Map(this.macros);
    return result;
  }

  public compile(): Macro {
    const result = new Macro();

    // If there is macro precursor, do it now
    if (this.init_macro) {
      result.step(undelay(this.init_macro));
    }

    // Perform any monster-specific macros (these may or may not end the fight)
    const monster_macros = new CompressedMacro();
    this.macros.forEach((value, key) => {
      monster_macros.add(key, new Macro().step(...value.map(undelay)));
    });
    result.step(monster_macros.build());

    // Perform the non-monster specific macro
    if (this.default_macro) result.step(new Macro().step(...this.default_macro.map(undelay)));
    return result;
  }
}

export class CompressedMacro {
  // Build a macro that combines if statements (keyed on monster) with
  // identical body into a single if statement, to avoid the 37-action limit.
  //  Ex: [if x; A; if y; B; if z; A;] => [if x || z; A; if y; B]
  components = new Map<string, Monster[]>();
  public add(monster: Monster, macro: Macro): void {
    const macro_text = macro.toString();
    if (macro_text.length === 0) return;
    if (!this.components.has(macro_text)) this.components.set(macro_text, [monster]);
    else this.components.get(macro_text)?.push(monster);
  }

  public build(): Macro {
    const result = new Macro();
    this.components.forEach((monsters, macro) => {
      const condition = monsters.map((mon) => `monsterid ${mon.id}`).join(" || ");
      result.if_(condition, macro);
    });
    return result;
  }
}
