# Launch Metrics

## Opportunity brief yield

Every scheduled Monday, Wednesday and Friday search records one
`shortlist_outcome` event after source verification. Its `count` is the number
of roles actually emailed: 0, 1, 2 or 3. A zero means the search ran but no
current listing cleared the final quality and availability checks.

Use this query in the Supabase SQL editor to review the weekly distribution:

```sql
SELECT
  date_trunc('week', occurred_at) AS week,
  (properties->>'count')::int AS roles_sent,
  count(*) AS scheduled_searches,
  count(DISTINCT user_id) AS users
FROM product_events
WHERE event_name = 'shortlist_outcome'
  AND properties->>'scheduled' = 'true'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
```

Review at least four weeks before changing cadence. Compare the zero-result
share with role-open, positive-feedback, materials-generated and application
events. A higher frequency is not an improvement unless useful-role engagement
rises without materially increasing low-quality or zero-result searches.
