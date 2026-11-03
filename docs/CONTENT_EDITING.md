# Edit Hood Hero’s writing on iPhone

The words live in **[src/content/copy](../src/content/copy)**. Open a file and change the text on the right side of a colon. You do not need to edit TypeScript.

| What to edit                                                 | File inside `src/content/copy/`                |
| ------------------------------------------------------------ | ---------------------------------------------- |
| Action names, descriptions, outcomes and some action buttons | `actions.json`                                 |
| Navigation, HUD labels, menus, static interface messages     | `interface.json` (grouped by screen/component) |
| Neighborhood descriptions, subtitles and image flavor        | `neighborhoods.json`                           |
| Character descriptions                                       | `characters.json`                              |
| Crew conversations, requests, offers and availability        | `crew-dialogue.json`                           |
| Workplace conversations, choices and outcome reactions       | `workplace-dialogue.json`                      |
| Supplier conversations, repayment choices and terms          | `supplier-dialogue.json`                       |
| Selected city developments and victory writing               | `city-events.json`                             |
| Mega’s opening, choices, follow-ups and outcomes             | `storylines/the-chains.json`                   |

Some simulation messages still live in code; see [the implementation report](CONTENT_AUTHORING_REPORT.md). Existing saves retain their recorded event text, names and descriptions. New conversations use the current build’s writing; new-game character/neighborhood descriptions use the latest writing.

## Make an edit from Safari

1. Open [Hood-Hero on GitHub](https://github.com/kalikeefbiz/Hood-Hero). Use the branch selector to select your working branch. For this review use **`goal-007a-content-authoring`**; after approval, create a fresh writing branch from main.
2. Open **src → content → copy**, then the relevant file above. GitHub’s **… → Edit file** or pencil opens its web editor. If controls are hidden, Safari’s **Request Desktop Website** can help.
3. Find the sentence and edit only its text value. Preserve surrounding straight `"` marks, commas, keys and any `{placeholders}`. Keep intentional spaces at the beginning/end of short interface fragments.
4. Tap **Commit changes**. Enter a short description such as “Revise Mega’s opening.” Commit to the working branch, never directly to main.
5. Open **Pull requests → New pull request**, base `main`, compare your branch. If that branch already has an open PR, the commit updates it automatically.
6. Wait for **Validate Hood Hero** to turn green. Open a failed check’s details to see the file/key to repair; commit the correction to the same branch.
7. Review the writing and phone layout, then approve the PR. This authoring implementation stays unmerged until creator approval.
8. Publish using the deployment steps below. Confirm the public game after publishing.

## Change words, keep identifiers

Correct (key unchanged):

```json
"description": "Make contact and build a little trust."
```

Incorrect (renamed key):

```json
"newDescription": "Make contact and build a little trust."
```

Keep outer groups such as `reachOut`, `opening`, `choices` and `reactions` too. They are stable addresses, not words displayed in the game. Do not add/delete entries or rename files. A developer wires new scenes into the existing engine; the creator can then author their text here. Writing alone never creates actions or branches.

Do not change quoted prices, AP costs, percentages or other instructions to describe different rules: the writing does not change those rules. Ask for an implementation change if the rules need updating.

## Dynamic text

Example from supplier copy:

```json
"dialogue": "You still have ${amount} with me. {terms} Losing the goods doesn't settle that. Bring what you can; I'll count every dollar."
```

The `$` is ordinary text; `{amount}` is the current number. Keep **all existing placeholder names** in that entry. You may move them within the sentence or repeat them. Never add a new placeholder, remove the last occurrence, change its capitalization, or replace it with a fixed value.

Supported placeholders are explicit **per entry**. Only use those already present:

| Names                                                                                                   | Supplied by the game                                                                                            |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `{player}`, `{character}`, `{contact}`, `{successor}`, `{faction}`                                      | Current names/attribution                                                                                       |
| `{amount}`, `{gross}`, `{price}`, `{quantity}`, `{chance}`                                              | Current values; `price` is already formatted currency, other currency templates keep `$` before the placeholder |
| `{deadline}`, `{day}`, `{workdays}`                                                                     | Dates/schedule                                                                                                  |
| `{availability}`, `{status}`, `{decision}`, `{reason}`                                                  | Current availability/request state                                                                              |
| `{intro}`, `{tone}`, `{details}`, `{reaction}`, `{terms}`, `{risk}`                                     | Text chosen by existing conditions, often from another entry                                                    |
| `{stage}`, `{permission}`, `{workplace}`, `{neighborhood}`, `{employment}`, `{description}`, `{choice}` | Current presentation context                                                                                    |

There is no JavaScript, HTML or condition syntax in these files. Text displays as text. The engine still decides whether a promise was kept, an offer was accepted, or someone is owed money.

## Fix common errors

- **Missing comma:** put a comma after each entry except the last in its `{ ... }` group.
- **Invalid quotes:** JSON uses straight `"` delimiters, not curly `“ ”`. Curly quotation marks inside a sentence are fine. Escape a straight quote inside text as `\"`; write a line break as `\n` rather than pressing Return inside the string.
- **Broken JSON:** open the failed check, restore the punctuation around the reported line, and commit again. GitHub’s file **History** shows the last working version.
- **Missing/unknown placeholder:** copy its exact spelling from the previous version. The check lists expected placeholders.
- **Accidentally edited identifier:** restore the key from History; keep your revised text value. Duplicate and unused keys also fail validation.

## Publish to the playable game

A GitHub commit or merged PR **does not publish itself**. The existing workflow is manual.

1. For this review go to **Actions → Deploy content authoring review → Run workflow**, run from **main**, and enter the reviewed content commit SHA in **ref**. This is the established preview pattern: a main workflow checks out the unmerged review commit because the Pages environment only permits main workflows.
2. For later approved/merged writing use **Actions → Publish playable preview → Run workflow**, selecting **main**. Run the appropriate workflow and wait for both **build** and **deploy** to succeed. It runs content validation and tests before building.
3. Open **https://kalikeefbiz.github.io/Hood-Hero/**. Refresh/reopen Safari if it shows cached text. Start a new game to check changed starting descriptions.
4. Check [build-info.json](https://kalikeefbiz.github.io/Hood-Hero/build-info.json): `commit` must match the commit you published. Old event records in an existing save keep their original wording.

This preview replaces the game at the same public URL; it is not a separate preview site. Avoid running older goal-specific playtest workflows: those intentionally deploy older commits. If publishing fails, the previous playable build remains; fix the check and run the workflow again.
