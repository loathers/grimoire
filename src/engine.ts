import { outfitSlots, Task } from "./task";
import {
  $skill,
  $slot,
  ensureEffect,
  get,
  have,
  isSong,
  Macro,
  PropertiesManager,
  set,
  uneffect,
} from "libram";
import {
  adv1,
  buy,
  choiceFollowsFight,
  cliExecute,
  equippedAmount,
  getRelated,
  inMultiFight,
  itemAmount,
  Location,
  myEffects,
  print,
  retrieveItem,
  runChoice,
  runCombat,
  toEffect,
  toSlot,
  writeCcs,
} from "kolmafia";
import { Outfit } from "./outfit";
import { ActionDefaults, CombatResources, CombatStrategy } from "./combat";

export class EngineOptions<A extends string = never> {
  combat_defaults?: ActionDefaults<A>;
}

export class Engine<A extends string = never, T extends Task<A> = Task<A>> {
  tasks: T[];
  options: EngineOptions<A>;
  attempts: { [task_name: string]: number } = {};
  propertyManager = new PropertiesManager();
  tasks_by_name = new Map<string, T>();

  /**
   * Create the engine.
   * @param tasks A list of tasks for looking up task dependencies.
   * @param options Basic configuration of the engine.
   */
  constructor(tasks: T[], options?: EngineOptions<A>) {
    this.tasks = tasks;
    this.options = options ?? {};
    for (const task of tasks) {
      this.tasks_by_name.set(task.name, task);
    }
    this.initPropertiesManager(this.propertyManager);
  }

  /**
   * Determine the next task to perform.
   * By default, this is the first task in the task list that is available.
   * @returns The next task to perform, or undefined if no tasks are available.
   */
  public getNextTask(): T | undefined {
    return this.tasks.find((task) => this.available(task));
  }

  /**
   * Continually get the next task and execute it.
   * @param actions If given, only perform up to this many tasks.
   */
  public run(actions?: number): void {
    for (let i = 0; i < (actions ?? Infinity); i++) {
      const task = this.getNextTask();
      if (!task) return;
      this.execute(task);
    }
  }

  /**
   * Close the engine and reset all properties.
   * After this has been called, this object should not be used.
   */
  public destruct(): void {
    this.propertyManager.resetAll();
  }

  /**
   * Check if the given task is available at this moment.
   * @returns true if all dependencies are complete and the task is ready.
   *  Note that dependencies are not checked transitively. That is, if
   *  A depends on B which depends on C, then A is ready if B is complete
   *  (regardless of if C is complete or not).
   */
  public available(task: T): boolean {
    for (const after of task.after ?? []) {
      const after_task = this.tasks_by_name.get(after);
      if (after_task === undefined) throw `Unknown task dependency ${after} on ${task.name}`;
      if (!after_task.completed()) return false;
    }
    if (task.ready && !task.ready()) return false;
    if (task.completed()) return false;
    return true;
  }

  /**
   * Perform all steps to execute the provided task.
   * This is the main entry point for the Engine.
   * @param task The current executing task.
   */
  public execute(task: T): void {
    print(``);
    print(`Executing ${task.name}`, "blue");

    // Acquire any items and effects first, possibly for later execution steps.
    this.acquireItems(task);
    this.acquireEffects(task);

    // Prepare the outfit, with resources.
    const task_combat = task.combat?.clone() ?? new CombatStrategy<A>();
    const outfit = this.createOutfit(task);

    const task_resources = new CombatResources<A>();
    this.customize(task, outfit, task_combat, task_resources);
    this.dress(task, outfit);

    // Prepare combat and choices
    const macro = task_combat.compile(
      task_resources,
      this.options?.combat_defaults,
      task.do instanceof Location ? task.do : undefined
    );
    macro.save();
    writeCcs("[ default ]\nscrollwhendone", "scrollwhendone");
    cliExecute("scrollwhendone");
    this.setChoices(task, this.propertyManager);

    // Actually perform the task
    for (const resource of task_resources.all()) resource.prepare?.();
    this.prepare(task);
    this.do(task);
    while (this.shouldRepeatAdv(task)) {
      set("lastEncounter", "");
      this.do(task);
    }
    this.post(task);

    // Mark that we tried the task, and apply limits
    this.markAttempt(task);
    if (!task.completed()) this.checkLimits(task);
  }

  /**
   * Acquire all items for the task.
   * @param task The current executing task.
   */
  acquireItems(task: T): void {
    for (const to_get of task.acquire || []) {
      const num_needed = to_get.num ?? 1;
      const num_have = itemAmount(to_get.item) + equippedAmount(to_get.item);
      if (num_needed <= num_have) continue;
      if (to_get.useful !== undefined && !to_get.useful()) continue;
      if (to_get.get) {
        to_get.get();
      } else if (to_get.price !== undefined) {
        buy(to_get.item, num_needed - num_have, to_get.price);
      } else if (Object.keys(getRelated(to_get.item, "fold")).length > 0) {
        cliExecute(`fold ${to_get.item}`);
      } else {
        retrieveItem(to_get.item, num_needed);
      }
      if (itemAmount(to_get.item) + equippedAmount(to_get.item) < num_needed && !to_get.optional) {
        throw `Task ${task.name} was unable to acquire ${num_needed} ${to_get.item}`;
      }
    }
  }

  /**
   * Acquire all effects for the task.
   * @param task The current executing task.
   */
  acquireEffects(task: T): void {
    const songs = task.effects?.filter((effect) => isSong(effect)) ?? [];
    if (songs.length > maxSongs()) throw "Too many AT songs";
    const extraSongs = Object.keys(myEffects())
      .map((effectName) => toEffect(effectName))
      .filter((effect) => isSong(effect) && !songs.includes(effect));
    while (songs.length + extraSongs.length > maxSongs()) {
      const toRemove = extraSongs.pop();
      if (toRemove === undefined) {
        break;
      } else {
        uneffect(toRemove);
      }
    }

    for (const effect of task.effects ?? []) ensureEffect(effect);
  }

  /**
   * Create an outfit for the task with all required equipment.
   * @param task The current executing task.
   */
  createOutfit(task: T): Outfit {
    const spec = typeof task.outfit === "function" ? task.outfit() : task.outfit;
    const outfit = new Outfit();
    if (spec !== undefined) {
      for (const slotName of outfitSlots) {
        const slot =
          new Map([
            ["famequip", $slot`familiar`],
            ["offhand", $slot`off-hand`],
          ]).get(slotName) ?? toSlot(slotName);
        const itemOrItems = spec[slotName];
        if (itemOrItems !== undefined && !outfit.equip(itemOrItems, slot)) {
          throw `Unable to equip one of [${itemOrItems}] in slot ${slot}`;
        }
      }
      for (const item of spec?.equip ?? []) {
        if (!outfit.equip(item)) throw `Unable to equip item ${item}`;
      }
      if (spec?.familiar !== undefined) {
        if (!outfit.equip(spec.familiar)) throw `Unable to equip familiar ${spec.familiar}`;
      }
      outfit.avoid = spec?.avoid;
      outfit.skipDefaults = spec?.skipDefaults ?? false;
      outfit.modifier = spec?.modifier;
    }
    return outfit;
  }

  /**
   * Equip the outfit for the task.
   * @param task The current executing task.
   * @param outfit The outfit for the task, possibly augmented by the engine.
   */
  dress(task: T, outfit: Outfit): void {
    outfit.dress();
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  /**
   * Perform any engine-specific customization for the outfit and combat plan.
   *
   * This is a natural method to override in order to:
   *   * Enable the use of any resources in the outfit or combat (e.g., allocate banishers).
   *   * Equip a default outfit.
   *   * Determine additional monster macros at a global level (e.g., use flyers).
   * @param task The current executing task.
   * @param outfit The outfit for the task.
   * @param combat The combat strategy so far for the task.
   * @param resources The combat resources assigned so far for the task.
   */
  customize(
    task: T,
    outfit: Outfit,
    combat: CombatStrategy<A>,
    resources: CombatResources<A>
  ): void {
    // do nothing by default
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  /**
   * Set the choice settings for the task.
   * @param task The current executing task.
   * @param manager The property manager to use.
   */
  setChoices(task: T, manager: PropertiesManager): void {
    const choices: { [choice: number]: number } = {};
    for (const choice_id_str in task.choices) {
      const choice_id = parseInt(choice_id_str);
      const choice = task.choices[choice_id];
      if (typeof choice === "number") choices[choice_id] = choice;
      else choices[choice_id] = choice();
    }
    manager.setChoices(choices);
  }

  /**
   * Do any task-specific preparation.
   * @param task The current executing task.
   */
  prepare(task: T): void {
    task.prepare?.();
  }

  /**
   * Actually perform the task.
   * @param task The current executing task.
   */
  do(task: T): void {
    const macroString = Macro.load().toString();
    if (typeof task.do === "function") {
      task.do();
    } else {
      adv1(task.do, 0, macroString);
    }
    runCombat(macroString);
    while (inMultiFight()) runCombat(macroString);
    if (choiceFollowsFight()) runChoice(-1);
  }

  /**
   * Check if the task.do should be immediately repeated without any prep.
   *
   * By default, this is only used to repeat a task if we hit one of:
   *   1. Halloweener dog noncombats,
   *   2. June cleaver noncombats, or
   *   3. Lil' Doctor™ bag noncombt.
   * @param task The current executing task.
   * @returns True if the task should be immediately repeated.
   */
  shouldRepeatAdv(task: T): boolean {
    return task.do instanceof Location && lastEncounterWasWanderingNC();
  }

  /**
   * Do any task-specific wrapup activities.
   * @param task The current executing task.
   */
  post(task: T): void {
    task.post?.();
  }

  /**
   * Mark that an attempt was made on the current task.
   * @param task The current executing task.
   */
  markAttempt(task: T): void {
    if (!(task.name in this.attempts)) this.attempts[task.name] = 0;
    this.attempts[task.name]++;
  }

  /**
   * Check if the task has passed any of its internal limits.
   * @param task The task to check.
   * @throws An error if any of the internal limits have been passed.
   */
  checkLimits(task: T): void {
    if (!task.limit) return;
    const failureMessage = task.limit.message ? ` ${task.limit.message}` : "";
    if (task.limit.tries && this.attempts[task.name] >= task.limit.tries)
      throw `Task ${task.name} did not complete within ${task.limit.tries} attempts. Please check what went wrong.${failureMessage}`;
    if (task.limit.soft && this.attempts[task.name] >= task.limit.soft)
      throw `Task ${task.name} did not complete within ${task.limit.soft} attempts. Please check what went wrong (you may just be unlucky).${failureMessage}`;
    if (task.limit.turns && task.do instanceof Location && task.do.turnsSpent >= task.limit.turns)
      throw `Task ${task.name} did not complete within ${task.limit.turns} turns. Please check what went wrong.${failureMessage}`;
  }

  /**
   * Initialize properties for the script.
   * @param manager The properties manager to use.
   */
  initPropertiesManager(manager: PropertiesManager): void {
    // Properties adapted from garbo
    manager.set({
      logPreferenceChange: true,
      logPreferenceChangeFilter: [
        ...new Set([
          ...get("logPreferenceChangeFilter").split(","),
          "libram_savedMacro",
          "maximizerMRUList",
          "testudinalTeachings",
          "_lastCombatStarted",
        ]),
      ]
        .sort()
        .filter((a) => a)
        .join(","),
      battleAction: "custom combat script",
      autoSatisfyWithMall: true,
      autoSatisfyWithNPCs: true,
      autoSatisfyWithCoinmasters: true,
      autoSatisfyWithStash: false,
      dontStopForCounters: true,
      maximizerFoldables: true,
      hpAutoRecovery: "-0.05",
      hpAutoRecoveryTarget: "0.0",
      mpAutoRecovery: "-0.05",
      mpAutoRecoveryTarget: "0.0",
      afterAdventureScript: "",
      betweenBattleScript: "",
      choiceAdventureScript: "",
      familiarScript: "",
      currentMood: "apathetic",
      autoTuxedo: true,
      autoPinkyRing: true,
      autoGarish: true,
      allowNonMoodBurning: false,
      allowSummonBurning: true,
      libramSkillsSoftcore: "none",
    });
  }
}

export function maxSongs(): number {
  return have($skill`Mariachi Memory`) ? 4 : 3;
}

export const wanderingNCs = new Set<string>([
  "Wooof! Wooooooof!",
  "Playing Fetch*",
  "A Pound of Cure",
  "Aunts not Ants",
  "Bath Time",
  "Beware of Aligator",
  "Delicious Sprouts",
  "Hypnotic Master",
  "Lost and Found",
  "Poetic Justice",
  "Summer Days",
  "Teacher's Pet",
]);

/**
 * Return true if the last adv was one of:
 *   1. Halloweener dog noncombats,
 *   2. June cleaver noncombats, or
 *   3. Lil' Doctor™ bag noncombt.
 */
export function lastEncounterWasWanderingNC(): boolean {
  return wanderingNCs.has(get("lastEncounter"));
}
