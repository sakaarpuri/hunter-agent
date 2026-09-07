# Pricing And AI Unit Economics

## Product Decision

- Current access: **free beta**, with no payment details collected.
- Planned founding-member price: **£4.99 per month**, offered before beta members decide whether to continue.
- A **£49 per year** always-on career-radar option is under consideration, not promised or implemented.
- Brief size: up to three genuine new matches.
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
| Match ranking | 30 Haiku calls; 5,000 input and 1,500 output tokens each | $0.375 |
| Preference interpretation | 1 Sonnet call; 1,000 input and 400 output tokens | $0.006 |
| Application materials | 3 Sonnet calls; 5,000 input and 1,500 output tokens each | $0.075 |
| Follow-up help | 1 Haiku call; 1,000 input and 250 output tokens | $0.002 |
| **Estimated average** | | **$0.458 per user/month** |

Use **$0.35-$0.65 per active user per month** as the expected AI range and
reserve **$1 per active user per month** for AI while usage is still unknown.
At £4.99, AI inference alone is unlikely to be the margin constraint.

The estimate uses standard text API rates of $1/$5 per million input/output
tokens for Claude Haiku 4.5 and $2/$10 for Claude Sonnet 5. It assumes one
matching pass per day, one interpreted preference update, one selected role
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
| One basic search per day | 30 | $0.24 |
| Planning average: 1.5 credits per day | 45 | $0.36 |
| Hard per-user maximum: 4 credits per day | 120 | $0.96 |

The public-query cache is shared across users for a day, so users looking for
similar roles in similar regions can reuse the same search results. That makes
the marginal cost lower than this per-user estimate as the customer base grows.
The 1,000-credit free allowance covers about 22 planning-average users before
shared-cache savings, but should be treated as a launch allowance rather than
part of long-term unit economics.

## Combined Planning Estimate

- Average Claude usage: **$0.46 per active user per month**.
- Average Tavily usage before shared-cache savings: **$0.36 per active user per month**.
- Combined planning average: **about $0.82 per active user per month**.
- Expected working range: **$0.59-$1.25 per active user per month**.
- Conservative upper case at the current daily search cap: **about $1.61 per active user per month**.

Reserve **$1.50 per active user per month** for Claude plus Tavily during the
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
