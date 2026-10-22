# Controlled self-improvement loop

Cortana can begin a measured improvement cycle without granting the running agent authority to rewrite itself.

## Loop
1. **Observe:** a maintainer or future evaluator supplies a reproducible failure, metric, or capability gap.
2. **Propose:** create an `ImprovementProposal` with a problem statement, suggested change, acceptance criteria, and risk.
3. **Isolate:** an implementation agent may work only in a feature branch or disposable sandbox.
4. **Validate:** run unit, regression, security, and platform CI checks; inspect the diff for secrets and unintended side effects.
5. **Review:** a human maintainer approves or requests changes.
6. **Integrate:** merge only through the repository's normal protected-review flow.
7. **Roll back:** revert the merge commit if quality regresses.

## Current implementation
`cortana.self_improvement.ProposalStore` saves structured proposals as JSON files. It does not compile, import, execute, commit, push, merge, or deploy proposed code. Proposal payloads are untrusted data.

## Future automation
A future evaluator may open a pull request in a dedicated branch using a narrowly scoped GitHub App token. Keep that token outside the agent process where possible, restrict it to a single repository, require CI and human review, and never grant repository administration or secret-management permission to the agent.

## Acceptance checklist
- [ ] Each proposal has a reproducible problem and testable acceptance criteria.
- [ ] Changes are isolated from the running process.
- [ ] CI succeeds on Windows and Linux.
- [ ] Secret scanning and dependency checks pass.
- [ ] A human reviews the complete diff.
- [ ] Rollback instructions are documented.
