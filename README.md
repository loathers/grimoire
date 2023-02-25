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

## Scripts using Grimoire

#### Full-day loop wrappers
- [goorbo](https://github.com/frazazel/goorbo): A wrapper for Grey You and garbo.
- [loop](https://github.com/Kasekopf/loop)
- [full-day](https://github.com/MrFizzyBubbs/full-day)

#### Ascension automation
- [phccs](https://github.com/horrible-little-slime/phccs), [loop-cs](https://github.com/MrFizzyBubbs/loop-cs): for Community Service runs.
- [loop-gyou](https://github.com/Kasekopf/loop-casual/tree/gyou): for Grey You softcore runs.
- [loop-casual](https://github.com/Kasekopf/loop-casual): for Casual runs.

#### Farming scripts 
- [baggo](https://github.com/MrFizzyBubbs/bag-collector): For the Neverending Party.
- [garbo](https://github.com/Loathing-Associates-Scripting-Society/garbage-collector): For Barf Mountain.
- [chrono](https://github.com/loathers/chrono-collector/tree/main/src): For the Time-Twitching Tower.
- [railo](https://github.com/loathers/railo): For Crimbo 2022.

#### Other scripts
- [levelup](https://github.com/frazazel/levelup): A script that levels you up using your available resources.
