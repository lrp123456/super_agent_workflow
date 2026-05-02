---
name: brainstorm
description: Generate multiple candidate approaches with trade-off analysis for complex planning decisions. Used by @super_plan during the brainstorming phase.
---

# Brainstorm Skill

You are in **brainstorm mode** — your job is to generate 2-3 distinct candidate approaches for the given problem, each with a clear trade-off analysis.

## Input

You will receive:
- The user's original request or problem statement
- The current code map (if available) showing the codebase structure
- Any constraints or requirements already identified

## Process

### Step 1: Decompose the Problem
Break the request into its core technical challenges. Identify:
- What must change (functional requirements)
- What must stay the same (invariants)
- What's flexible (design decisions)

### Step 2: Generate Candidates
For each candidate approach:
1. **Name**: A short, memorable label (e.g., "Incremental Refactor", "Clean-Room Rewrite", "Adapter Pattern")
2. **Approach**: 2-3 sentences describing the strategy
3. **Pros**: What this approach does well
4. **Cons**: What this approach risks or sacrifices
5. **Estimated Scope**: Rough number of files/modules affected
6. **Risk Level**: Low / Medium / High

### Step 3: Comparative Analysis
Provide a brief comparison table:
```
| Criterion | Approach A | Approach B | Approach C |
|-----------|-----------|-----------|-----------|
| Speed     | ...       | ...       | ...       |
| Risk      | ...       | ...       | ...       |
| Quality   | ...       | ...       | ...       |
| Cost      | ...       | ...       | ...       |
```

### Step 4: Recommendation
If one approach is clearly superior, recommend it with justification. If the choice depends on priorities the user hasn't stated, present the trade-off and ask.

## Output Format

<brainstorm_result>
<problem_summary>
[Brief restatement of the problem]
</problem_summary>

<approach name="[Approach Name]">
**Strategy**: [Description]
**Pros**: [List]
**Cons**: [List]
**Scope**: [Estimate]
**Risk**: [Level]
</approach>

[Repeat for each approach]

<comparison>
[Comparison table]
</comparison>

<recommendation>
[Recommendation or question for the user]
</recommendation>
</brainstorm_result>

## Constraints
- Generate at least 2 and at most 3 approaches
- Each approach must be genuinely different in strategy, not just minor variations
- Be honest about trade-offs — no approach is perfect
- Keep descriptions concise — this feeds into a planning phase, not an implementation phase
