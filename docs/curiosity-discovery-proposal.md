# Curiosity-Led Discovery

Status: v1 implemented. Production supports a persisted three-position search
range, bounded adjacent-role families, explicit close/adjacent labels, and a
deterministic brief mix. Free-form introduction interpretation remains a future
onboarding enhancement.

## Audience And Promise

People who have a job but wonder whether something better is out there. The
product should ask what would tempt them, not require a fully formed job search.
AI selects the shortlist; do not imply a human has reviewed every job.

## Quick Start

1. One short introduction: current work, strengths, and what might tempt a move.
   Example: "I lead brand campaigns. I'd consider climate work or more autonomy."
2. Location selection: searchable cities/countries/regions, plus remote/hybrid/
   on-site. Keep relocation openness and remote hiring eligibility separate.
3. Three-position exploration control: Close matches / A little stretch /
   Surprise me. Default to A little stretch, with a visible sample mix.
4. Email delivery: up to three roles. CV upload remains optional and
   detailed employment history can wait until preparing an application.

Interpret the introduction once, show editable inferred role families and
strengths, and cache the interpretation. The user should not have to know their
next exact job title. Do not call AI on every keystroke or slider movement.

## Mix, Not Lower Standards

Illustrative targets, never quotas that must be filled:

| Choice | Three-role brief |
| --- | --- |
| Close matches | Up to 3 close matches |
| A little stretch | Up to 2 close + 1 adjacent |
| Surprise me | Up to 1 close + 2 adjacent |

An unexpected role needs an evidenced transferable skill, relevant responsibility
or credible industry bridge. It does not mean a random occupation or reduced fit
threshold. Explain "why this fits" and, for adjacent roles, "why this may surprise
you" using source evidence. If there are not enough strong roles, send fewer.

Salary, chosen geography, work arrangement, excluded employers and stated firm
limits are never relaxed by the exploration control. Unknown requirements are
not confirmed benefits. An adventurous career setting and a career change are
different preferences, not automatic implications of one slider position.

## Implementation Notes

Implemented: location text, remote regions, work arrangement, target titles,
strengths, move criteria, three-role delivery, shared public-search caching,
per-user cadence, spending caps, evidence-grounded private AI ranking, persisted
exploration preference, bounded adjacent-family search, explicit close/adjacent
assessment, deterministic mixture selection, structured role feedback, and
pre-send source verification.

Still optional future work: interpreting one free-form introduction into editable,
confirmed role families. The v1 experience uses the user's existing title,
target roles, skills, and move criteria to select from a conservative role bridge
taxonomy without adding a model call to each search.

Preserve the existing generation/application flow. New profile fields need
normalization for old accounts, workspace persistence, settings, fixtures and
matching-cache invalidation. Add the exploration preference to cache criteria.

## Cost And Verification

Allocate bounded public queries across core and adjacent role families instead
of adding unrestricted searches. Reuse shared public results and private matching
caches. Keep current cadence and daily credit caps; search does not run on slider
movement. Retain one bounded ranking batch and the seven-day suggestion lifetime.

Test all three modes with three-role briefs, sparse pools, duplicate/expired jobs,
hard-filter conflicts, unsupported adjacent occupations, malicious listing text,
AI unavailable, budget exhausted, and profile changes. Verify the preference
survives refresh and affects actual delivered roles, not merely UI labels.
