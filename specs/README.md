# Specs

Spec-driven development (SDD) for papa-online. Every change beyond a one-line
fix or dependency bump starts here, as a spec, before any implementation code.

## Workflow

1. Copy `_TEMPLATE/` to `specs/<change-name>/`.
2. Fill in `spec.md`: problem, numbered requirements (R1, R2, ...), acceptance
   criteria (each mapped to a requirement and verifiable by a named test), and
   explicit out-of-scope items.
3. Get the spec reviewed/approved before implementing.
4. Generate `tasks.md` from the spec. Do not add tasks without a matching
   requirement.
5. Implement test-first: the first task is always writing the failing tests for
   each acceptance criterion. Mark tasks done as you go.
6. If scope shifts mid-change, update the spec first — the spec is the source
   of truth until the change is merged.
7. A change is done when `npm run verify` is green and every acceptance
   criterion lists a passing test.

## Lifecycle

Specs live in git alongside the change and are kept after merge: they are the
decision record for why the code looks the way it does.
