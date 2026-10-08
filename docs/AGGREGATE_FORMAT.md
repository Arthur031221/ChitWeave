# Aggregate format

The renderer never sees a message. It sees this: per day and per hour, how many
records each of two people sent. Any chat app, or any pair of hourly counts, can
be woven by writing this file.

```json
{
  "version": 1,
  "start": "2026-05-08",
  "a": [[0, 2, 0, "... 24 numbers for the first day"], ["... 24 numbers for the second day"]],
  "b": [[1, 0, 0, "... 24 numbers for the first day"], ["... 24 numbers for the second day"]]
}
```

| Field | Meaning |
| --- | --- |
| `version` | Always `1`. Anything else is refused. |
| `start` | Date of the first row, `YYYY-MM-DD`. Must be a real calendar date. |
| `a` | One row per calendar day, in order, with no gaps. Each row has 24 whole numbers, hour 0 to hour 23. Drawn as horizontal threads. |
| `b` | The same shape for the other person. Drawn as vertical threads. Must have as many rows as `a`. |

Rules the loader enforces: every count is a whole number from 0 to 100,000, every
row has exactly 24 entries, and `a` and `b` have the same number of rows. A day
nobody wrote on is a row of zeros, so the days stay consecutive.

The loader is `checkAggregate` in `src/core/aggregate.js`. A complete example is
[`fixtures/sample.weave.json`](../fixtures/sample.weave.json), made up and not from a real chat.

## What is drawn

- One row per day, one cell per hour. Thread A runs along the row, thread B down the column.
- Thickness is `log1p(count) / log1p(max)`, where `max` is the busiest single cell of
  either person in the range shown. Both people share one scale. A count of 0 draws no thread.
- At each crossing one thread lies on top, alternating like a plain weave.
- The picture shows at most 90 days. It shows the last 90 days of the data unless you pick an end date.

## Make one from a LINE export

```sh
npx github:Arthur031221/ChitWeave chat.txt --json -o chat.weave.json
```

The file holds counts only: no names, no text. You can read it before you share it.
