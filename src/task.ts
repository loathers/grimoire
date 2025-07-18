import { Effect, Item, Location } from "kolmafia";
import { Delayed, get } from "libram";
import { StringProperty } from "libram/dist/propertyTypes";
import { CombatStrategy } from "./combat";
import { Limit } from "./limit";
import { Outfit, OutfitSpec } from "./outfit";

export type Quest<T, Context = void> = {
  name: string;
  completed?: (ctx: Context) => boolean;
  ready?: (ctx: Context) => boolean;
  tasks: T[];
};

export type AcquireItem<Context = void> = {
  item: Item;
  num?: number;
  price?: number;
  useful?: (ctx: Context) => boolean;
  optional?: boolean;
  get?: (ctx: Context) => void;
};

/**
 * A single script step or action to take.
 *
 * Most scripts will not need to change the generic parameters from the default
 * values; they are only needed for advanced use cases.
 *
 * @param A The set of combat placeholder actions.
 * @param Context The type for global state passed from the engine (@see ContextualEngine).
 */
export type Task<A extends string = never, Context = void> = {
  name: string;
  after?: string[];

  ready?: (ctx: Context) => boolean;
  completed: (ctx: Context) => boolean;

  // How to perform the task
  // Executed as:
  //  1. prepare();
  //  2. adv1(do) OR do();
  //  3. post();
  prepare?: (ctx: Context) => void;
  do: Location | ((ctx: Context) => Location) | ((context: Context) => void);
  post?: (ctx: Context) => void;

  acquire?: Delayed<AcquireItem[], [Context]>;
  effects?: Delayed<Effect[], [Context]>;
  choices?: Delayed<{ [id: number]: number | string }, [Context]>;
  limit?: Limit<Context>;
  outfit?: Delayed<OutfitSpec | Outfit, [Context]>;
  combat?: CombatStrategy<A, Context>;
};

export type StrictCombatTask<
  A extends string = never,
  Context = void,
  C extends CombatStrategy<A, Context> = CombatStrategy<A, Context>,
  O extends OutfitSpec | Outfit = OutfitSpec | Outfit,
> = Omit<Task<A, Context>, "do" | "combat" | "outfit"> &
  (
    | {
        do: Delayed<Location, [Context]> | ((context: Context) => void);
        combat: C;
        outfit: Delayed<O, [Context]>;
      }
    | { do: () => void; outfit?: Delayed<O, [Context]> }
  );

/**
 * Returns the state of a quest as a numeric value as follows:
 *   "unstarted" => -1
 *   "started" => 0
 *   "stepNUM" => NUM
 *   "finished" => 999
 */
export function step(questName: StringProperty): number {
  const stringStep = get(questName);
  if (stringStep === "unstarted") return -1;
  else if (stringStep === "started") return 0;
  else if (stringStep === "finished") return 999;
  else {
    if (stringStep.substring(0, 4) !== "step") {
      throw "Quest state parsing error.";
    }
    return parseInt(stringStep.substring(4), 10);
  }
}
