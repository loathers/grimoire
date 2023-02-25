# grimoire
`grimoire` is a library with task-based engine for KoLmafia. It is hosted on NPM as `grimoire-kolmafia`.

## Introduction
Grimoire is a framework for writing adventuring scripts. It uses a list of tasks that all include:
- a unique name
- a test to know if the task is complete
- the actual adventuring task
Each task also optionally includes built-in support for outfits, combat macros, as well as effect maintenance and item acquisition, and safeguards to ensure that errors in tasks don't accidentally eat up all your adventures.

Grimoire also features a robust argument-parsing and setting system that allows users to add runtime arguments or set kolmafia preferences to control things.

Because of the way tasks need to be written, each task can take more lines to write than what you may be used to, but a grimoire script tends to be re-entrant by its nature, and it is often easier to debug. It also often requires less explicit documentation, because the required fields provide significant insight into what the task is intending to do.

### Strengths compared to traditional sequential script writing:
- Building your completed check forces your script to be re-entrant
- Robust args system
- Tasks are easier to read, modify, and debug
- Easy access to outfits, combat macros, profit tracking, safety guards, and other features for each task

### Weaknesses compared to traditional sequential script writing:
- Need to set up a ts development environment
- More total lines of code - your codebase gets large
- Figuring out how to make each task's completed check work the way you want is sometimes challenging (forced re-entrance is a double-edged sword)

### Quirks:
- Non-adventuring tasks that do not change your in-game state require special handling, either setting a custom user preference, or caching results using in-script variables.

