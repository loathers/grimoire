import { get } from "libram";

/**
 * Specification for checking if a task actually sucessfully ran.
 * @member tries Number of attempts per script run, after which we abort.
 * @member turns Number of turns_spent in the task location, after which we abort.
 * @member soft Number of attempts per script run, after which we abort with "unlucky".
 * @member unready If true, .ready() on the task should return false after an execution.
 * @member completed If true, .completed() on the task should return true after an execution.
 * @member guard A pre/postcondition for the task; see {@link Guards}.
 *    The outer function is run before the task executes, and then the
 *    returned inner function is run after the task executes.
 * @member message An extra message to include with the error.
 */
export type Limit = {
  tries?: number;
  turns?: number;
  soft?: number;
  unready?: boolean;
  completed?: boolean;
  guard?: Guard;
  message?: string;
};

export type Guard = () => () => boolean;

export class Guards {
  /**
   * A guard that computes a value before the task executes which is available
   * for the condition checker.
   * @param before
   * @param after
   */
  static create<T>(before: () => T, after: (old: T) => boolean): Guard {
    return () => {
      const old = before();
      return () => after(old);
    };
  }

  /**
   * A guard that asserts a condition holds after the task executes.
   * @param condition A condition that should return true if the task
   *    sucessfully executed.
   */
  static after(condition: () => boolean): Guard {
    return () => condition;
  }

  /**
   * A guard that asserts the provided property changed.
   * @param property The property to check.
   */
  static changed(property: string): Guard {
    return this.create<string>(
      () => get(property),
      (old: string) => get(property) !== old
    );
  }
}
