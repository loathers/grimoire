import { Item, Location, Monster, Skill } from "kolmafia";
import { Macro } from "libram";

/**
 * A macro, or something that can become a macro.
 * The function will be called after the outfit has been equipped,
 * but before any task-specific preparation.
 */
export type DelayedMacro = Macro | (() => Macro);
function undelay(macro: DelayedMacro): Macro {
  if (macro instanceof Macro) return macro;
  else return macro();
}

/**
 * The strategy to use for combat for a task, which indicates what to do
 * for each monster.
 *
 * There are two ways to specify in a task what to do for a given monster:
 *   1. Provide a macro directly through .macro(macro, ...monsters)
 *   2. Provide an action through .action(action, ...monsters)
 *
 * An action is a strategy for dealing with a monster that is not fully
 * defined in the task. The possible actions are set with the type parameter A.
 *
 * For example, a task may want to banish a monster but not necessarily know or
 * care which banisher is used. Instead, it is best for the engine to determine
 * which banisher to use on the monster. To facilitate this, "banish" can be
 * defined as an action, e.g. with CombatStrategy<"banish">;
 *
 * Each action can be resolved by the engine by:
 *   1. Providing a default macro for the action through ActionDefaults<A>,
 *      which can be done through combat_defaults in Engine options, or
 *   2. Providing a CombatResource for the action through CombatResources<A>.
 *      This is typically done in Engine.customize() by checking if a given
 *      action is requested by the task with combat.can(.), and then providing
 *      an appropriate resource with resources.provide(.).
 *
 * A monster may have both a macro and an action defined, and a macro or action
 * can be specified to be done on all monsters. The order of combat is then:
 * 1. The macro given in .startingMacro().
 * 2. The monster-specific macro(s) from .macro().
 * 3. The monster-specific action from .action().
 * 4. The general macro(s) from .macro().
 * 5. The general action from .action().
 */
export class CombatStrategy<A extends string = never> {
  private starting_macro?: DelayedMacro;
  private default_macro?: DelayedMacro[];
  private macros: Map<Monster, DelayedMacro[]> = new Map();
  private default_action?: A;
  private actions: Map<Monster, A> = new Map();

  /**
   * Add a macro to perform for this monster. If multiple macros are given
   * for the same monster, they are concatinated.
   *
   * @param macro The macro to perform.
   * @param monsters Which monsters to use the macro on. If not given, add the
   *  macro as a general macro.
   * @param prepend If true, add the macro before all previous macros for
   *    the same monster.
   * @returns this
   */
  public macro(macro: DelayedMacro, monsters?: Monster[] | Monster, prepend?: boolean): this {
    if (monsters === undefined) {
      if (this.default_macro === undefined) this.default_macro = [];
      if (prepend) this.default_macro.unshift(macro);
      else this.default_macro.push(macro);
    } else {
      if (monsters instanceof Monster) monsters = [monsters];
      for (const monster of monsters) {
        if (!this.macros.has(monster)) this.macros.set(monster, []);
        if (prepend) this.macros.get(monster)?.unshift(macro);
        else this.macros.get(monster)?.push(macro);
      }
    }
    return this;
  }

  /**
   * Add a macro to perform at the start of combat.
   * @param macro The macro to perform.
   * @returns this
   */
  public startingMacro(macro: DelayedMacro): this {
    this.starting_macro = macro;
    return this;
  }

  /**
   * Add an action to perform for this monster. Only one action can be set for
   * each monster; any previous actions are overwritten.
   *
   * @param action The action to perform.
   * @param monsters Which monsters to use the action on. If not given, set the
   *  action as the general action for all monsters.
   * @returns this
   */
  public action(action: A, monsters?: Monster[] | Monster): this {
    if (monsters === undefined) {
      this.default_action = action;
    } else if (monsters instanceof Monster) {
      this.actions.set(monsters, action);
    } else {
      for (const monster of monsters) {
        this.actions.set(monster, action);
      }
    }
    return this;
  }

  /**
   * Check if the provided action was requested for any monsters, or for the
   * general action.
   */
  public can(action: A): boolean {
    if (action === this.default_action) return true;
    return Array.from(this.actions.values()).includes(action);
  }

  /**
   * Return the general action (if it exists).
   */
  public getDefaultAction(): A | undefined {
    return this.default_action;
  }

  /**
   * Return all monsters where the provided action was requested.
   */
  public where(action: A): Monster[] {
    return Array.from(this.actions.keys()).filter((key) => this.actions.get(key) === action);
  }

  /**
   * Return the requested action (if it exists) for the provided monster.
   */
  public currentStrategy(monster: Monster): A | undefined {
    return this.actions.get(monster) ?? this.default_action;
  }

  /**
   * Perform a deep copy of this combat strategy.
   */
  public clone(): this {
    const result = { ...this };
    if (result.default_macro) result.default_macro = [...result.default_macro];
    for (const pair of this.macros) result.macros.set(pair[0], [...pair[1]]);
    for (const pair of this.actions) result.actions.set(pair[0], pair[1]);
    return result;
  }

  /**
   * Compile this combat strategy into a complete macro.
   *
   * @param resources The resources to use to fulfil actions.
   * @param defaults Macros to perform for each action without a resource.
   * @param location The adventuring location, if known.
   * @returns The compiled macro.
   */
  public compile(
    resources: CombatResources<A>,
    defaults: ActionDefaults<A> | undefined,
    location: Location | undefined
  ): Macro {
    const result = new Macro();

    // If there is macro precursor, do it now
    if (this.starting_macro) {
      result.step(undelay(this.starting_macro));
    }

    // Perform any monster-specific macros (these may or may not end the fight)
    const monster_macros = new CompressedMacro();
    this.macros.forEach((value, key) => {
      monster_macros.add(key, new Macro().step(...value.map(undelay)));
    });
    result.step(monster_macros.compile());

    // Perform any monster-specific actions
    const monster_actions = new CompressedMacro();
    this.actions.forEach((action, key) => {
      const macro = resources.getMacro(action) ?? defaults?.[action]?.(key);
      if (macro) monster_actions.add(key, new Macro().step(macro));
    });
    result.step(monster_actions.compile());

    // Perform the non-monster specific macro
    if (this.default_macro) result.step(...this.default_macro.map(undelay));

    // Perform the non-monster specific action
    if (this.default_action) {
      const macro =
        resources.getMacro(this.default_action) ?? defaults?.[this.default_action]?.(location);
      if (macro) result.step(macro);
    }
    return result;
  }

  /**
   * For advanced users, this method will generate a fluent API for requesting
   * actions. That is, it allows you to do
   *   combat.banish(monster1).kill(monster2)
   * instead of
   *   combat.action("banish", monster1).action("kill", monster2)
   *
   * Example usage:
   *   const myActions = ["kill", "banish"] as const;
   *   class MyCombatStrategy extends CombatStrategy.withActions(myActions) {}
   *
   *   const foo: MyCombatStrategy = new MyCombatStrategy();
   *   const bar: MyCombatStrategy = foo.banish($monster`crate`).kill($monster`tumbleweed`);
   */
  static withActions<A extends string>(actions: readonly A[]): Constructor<CombatStrategyWith<A>> {
    class CombatStrategyWithActions extends this<A> {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proto = CombatStrategyWithActions.prototype as any;
    for (const action of actions) {
      proto[action] = function (this: CombatStrategy<A>, monsters?: Monster[] | Monster) {
        return this.action(action, monsters);
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return CombatStrategyWithActions as unknown as Constructor<CombatStrategyWith<A>>;
  }
}

/**
 * Get the default macro for each defined action.
 */
export type ActionDefaults<A extends string> = Record<
  A,
  (target: Monster | Location | undefined) => Macro
>;

/**
 * Type voodoo to support CombatStrategy.withActions
 */
type Constructor<T> = new () => T;
export type CombatStrategyWith<A extends string> = {
  [k in A as k extends keyof CombatStrategy<A> ? never : k]: (
    monsters?: Monster[] | Monster
  ) => CombatStrategyWith<A>;
} & CombatStrategy<A>;

/**
 * A class to build a macro that combines if statements (keyed on monster) with
 * identical body into a single if statement, to avoid the 37-action limit.
 * Ex: [if x; A; if y; B; if z; A;] will turn into [if x || z; A; if y; B]
 */
class CompressedMacro {
  components = new Map<string, Monster[]>();
  /**
   * Set the macro for a given monster (replacing any previous macros).
   */
  public add(monster: Monster, macro: Macro): void {
    const macro_text = macro.toString();
    if (macro_text.length === 0) return;
    if (!this.components.has(macro_text)) this.components.set(macro_text, [monster]);
    else this.components.get(macro_text)?.push(monster);
  }

  /**
   * Compile the compressed form of the macro.
   */
  public compile(): Macro {
    const result = new Macro();
    this.components.forEach((monsters, macro) => {
      const condition = monsters.map((mon) => `monsterid ${mon.id}`).join(" || ");
      result.if_(condition, macro);
    });
    return result;
  }
}

/**
 * An interface specifying a resource to be used for fulfilling an action.
 */
export interface CombatResource {
  prepare?: () => void;
  do: Item | Skill | Macro;
}

/**
 * A class for providing resources to fulfil combat actions.
 */
export class CombatResources<A extends string> {
  private resources = new Map<A, CombatResource>();

  /**
   * Use the provided resource to fulfil the provided action.
   * (If the resource is undefined, this does nothing).
   */
  public provide(action: A, resource: CombatResource | undefined): void {
    if (resource === undefined) return;
    this.resources.set(action, resource);
  }

  /**
   * Return true if the provided action has a resource provided.
   */
  public has(action: A): boolean {
    return this.resources.has(action);
  }

  /**
   * Return all provided combat resources.
   */
  public all(): CombatResource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get the macro provided by the resource for this action, or undefined if
   * no resource was provided.
   */
  public getMacro(action: A): Macro | undefined {
    const resource = this.resources.get(action);
    if (resource === undefined) return undefined;
    if (resource.do instanceof Item) return new Macro().item(resource.do);
    if (resource.do instanceof Skill) return new Macro().skill(resource.do);
    return resource.do;
  }
}
