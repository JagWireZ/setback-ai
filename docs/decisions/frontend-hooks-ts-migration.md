# Decision: frontend hooks stay `.js` for now

Date: 2026-09-20

The frontend hooks (`src/hooks/*.js`) will **not** migrate to `.ts`/`.tsx` as part of the
quality-audit tooling pass. The backend already gets type safety from `tsc --noEmit`, and the
ESLint config now lints the frontend `.js`/`.jsx` files directly, which covers the immediate
tooling gap.

Revisit this once Phase 2/3 test build-out is further along — migrating file-by-file alongside
test coverage would de-risk the conversion more than a big-bang rewrite.
