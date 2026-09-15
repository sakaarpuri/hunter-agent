# Pricing And AI Unit Economics

## Product Decision

- Current access: **free beta**, with no payment details collected.
- Planned founding-member price: **£4.99 per month**, offered before beta members decide whether to continue.
- A **£49 per year** always-on career-radar option is under consideration, not promised or implemented.
- Opportunity brief size: one to three genuine new matches.
- Launch search cadence: Monday, Wednesday and Friday. Daily search remains a future premium or user-controlled option.
- Do not offer permanent free daily searches until measured search costs, recommendation quality, and retention are known.
- Do not increase pricing until recommendation quality has been proven with production feedback and retention data.
- Billing is not implemented yet. The public product must not imply that it can
  collect a subscription until checkout, subscription state, webhooks, and
  cancellation are working and tested.

## Average Monthly AI Estimate

This is a planning estimate, not measured production usage. The application
does not yet persist provider token usage. It uses Claude Haiku 4.5 for matching
and follow-ups, and Claude Sonnet 5 for intent interpretation and application
materials.

| Workload | Planning assumption | Estimated cost |
| --- | --- | ---: |
| Match ranking | 13 Haiku calls; 5,000 input and 1,500 output tokens each | $0.163 |
| Preference interpretation | 1 Sonnet call; 1,000 input and 400 output tokens | $0.006 |
| Application materials | 3 Sonnet calls; 5,000 input and 1,500 output tokens each | $0.075 |
| Follow-up help | 1 Haiku call; 1,000 input and 250 output tokens | $0.002 |
| **Estimated average** | | **$0.246 per user/month** |

Use **$0.20-$0.45 per active user per month** as the expected AI range and
reserve **$0.75 per active user per month** for AI while usage is still unknown.
At £4.99, AI inference alone is unlikely to be the margin constraint.

The estimate uses standard text API rates of $1/$5 per million input/output
tokens for Claude Haiku 4.5 and $2/$10 for Claude Sonnet 5. It assumes one
matching pass each Monday, Wednesday and Friday, one interpreted preference update, one selected role
with an initial pack plus two refinements, and one follow-up request. Caching
already prevents identical work from being repeatedly charged.

## Tavily Search Estimate

Tavily charges one credit for a basic search and two credits for an advanced
search. Pay-as-you-go credits cost $0.008 each; the free plan currently includes
1,000 credits per month. HunterAgent starts with basic searches and can make one
advanced search when results are sparse. The server-side limit is four credits
per user per due search day.

| Search usage | Monthly credits before shared caching | Estimated cost |
| --- | ---: | ---: |
| One basic search each Mon/Wed/Fri | 13 | $0.10 |
| Planning average: 1.5 credits per search day | 20 | $0.16 |
| Hard per-user maximum: 4 credits per search day | 52 | $0.42 |

The public-query cache is shared across users for a day, so users looking for
similar roles in similar regions can reuse the same search results. That makes
the marginal cost lower than this per-user estimate as the customer base grows.
The 1,000-credit free allowance covers about 50 planning-average users before
shared-cache savings, but should be treated as a launch allowance rather than
part of long-term unit economics.

## Combined Planning Estimate

- Average Claude usage: **$0.25 per active user per month**.
- Average Tavily usage before shared-cache savings: **$0.16 per active user per month**.
- Combined planning average: **about $0.41 per active user per month**.
- Expected working range: **$0.30-$0.75 per active user per month**.
- Conservative upper case at the launch search cap: **about $1.17 per active user per month**.

Reserve **$1 per active user per month** for Claude plus Tavily during the
first paid cohort, add alerts before the daily caps are raised, and replace the
estimate with measured usage as soon as production traffic exists.

## Costs Not Included

- AgentMail delivery
- Netlify and Supabase
- payment processing and failed-payment handling
- VAT, refunds, support, observability, and foreign-exchange movement

Before paid acquisition, record Anthropic's returned input/output token counts
per task without storing prompts or responses. Compare measured p50, p90, and
p99 monthly costs with this estimate and revisit the daily budget limits.

Before enabling billing, measure listing-open rate, positive role feedback,
negative-feedback reasons, shortlist-to-materials conversion, and four-week
retention. Price changes should follow demonstrated customer value, not a
model-cost estimate alone.
