# Commit Message Guidelines

To ensure a clear, readable, and automated history for the Ourobion project, we follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

## Commit Message Format

Each commit message consists of a **header**, an optional **body**, and an optional **footer**. The header has a special format that includes a **type**, an optional **scope**, and a **subject**:

```text
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

### 1. Type

Must be one of the following:

*   **feat**: A new feature (e.g., adding a new screen or module)
*   **fix**: A bug fix (e.g., resolving a build error or UI glitch)
*   **docs**: Documentation only changes (e.g., updating README or context documents)
*   **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
*   **refactor**: A code change that neither fixes a bug nor adds a feature (e.g., renaming variables, extracting functions)
*   **perf**: A code change that improves performance
*   **test**: Adding missing tests or correcting existing tests
*   **build**: Changes that affect the build system or external dependencies (e.g., pubspec.yaml, package.json, setup scripts)
*   **ci**: Changes to our CI configuration files and scripts (e.g., GitHub Actions)
*   **chore**: Other changes that don't modify `src` or `test` files (e.g., updating dependencies)
*   **revert**: Reverts a previous commit

### 2. Scope (Optional)

The scope provides more context on where the change took place. It should be the name of the module or component affected (e.g., `auth`, `ui`, `db`, `m1_core`, `m2`).

### 3. Subject

The subject contains a succinct description of the change:

*   Use the imperative, present tense: "change" not "changed" nor "changes"
*   Don't capitalize the first letter
*   No dot (.) at the end

### 4. Body (Optional)

Just as in the subject, use the imperative, present tense: "change" not "changed" nor "changes". The body should include the motivation for the change and contrast this with previous behavior.

### 5. Footer (Optional)

The footer should contain any information about **Breaking Changes** and is also the place to reference GitHub issues that this commit **Closes** or **Fixes**.

## Examples

**Feature commit:**
```text
feat(auth): implement google sign-in flow

Added Google OAuth provider initialization and the button UI in the sign-in screen.
```

**Bug fix commit:**
```text
fix(m1_core): resolve UserIdentity import conflict

Hid UserIdentity from supabase_flutter import to prevent naming collision with local model.
```

**Documentation commit:**
```text
docs: create commit message guidelines
```

**Breaking change:**
```text
refactor(db): rewrite profile schema

BREAKING CHANGE: The `profiles` table now uses `uuid` instead of integer IDs.
```
