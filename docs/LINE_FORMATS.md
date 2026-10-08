# LINE export layouts

ChitWeave reads the text file that LINE's "Export chat" writes. The parser follows
the layouts below. They are the ones other open LINE analyzers document and test
against, written down here so a failure can be explained. The files in
`fixtures/` are made up in these layouts. **I have not run the parser on a fresh
export from every phone and app version**, so if your file is refused, the
line numbers it prints are the place to start.

The made-up fixtures use the extension `.chat`, because they hold Traditional
Chinese text. A real export is a `.txt` file, and the page and the command line
accept both. Open [`fixtures/sample-zh-hant-12h.chat`](../fixtures/sample-zh-hant-12h.chat)
to see a full file.

## What a file looks like

A header, then one date line for each day, then one line for each message. Fields
on a message line are separated by a tab character.

```text
<header line: [LINE] and the chat title>
<save date line>
<empty line>
2026/05/08 (weekday character in full width brackets)
<day part><TAB>Mika<TAB>text of the message
<day part><TAB>Ren<TAB>"first line of a message
second line of the same message"
<time><TAB><TAB>notice text with no sender
```

| Piece | Accepted |
| --- | --- |
| Date line | `YYYY/MM/DD` or `YYYY.MM.DD`, then the weekday, either in brackets (full width or plain) or after a space. The weekday may be one Chinese character with or without the prefix for "week", or an English day name or its usual short form (`Fri`, `Thur`). Anything else is not a weekday. It must be the right weekday for the date. |
| Time | A 12 hour clock with the Chinese morning or afternoon marker in front (`U+4E0A U+5348` is morning, `U+4E0B U+5348` is afternoon) as in `04:46`, a 24 hour clock as in `16:46`, or `4:46 PM`. A narrow no-break space before AM or PM is fine. |
| Message | time, tab, sender, tab, text. Counts as one record, whatever the text is, including stickers and photos, which LINE writes as a bracketed word. |
| Notice | time, tab, tab, text with an empty sender field, or time, tab, text with no sender field. Not counted. |
| Call | A record with a sender, such as a call duration or a missed call, counts as one record like any other message. |
| Anything else | A continuation of the message above. Not counted. |

## Counting rules

- Each message line is one message from that sender in that hour of that day.
- A message that spans several lines is one record. Its extra lines are not counted.
- Records under a date line that does not exist, whose weekday is wrong, whose year is outside 2000 to 2100, or whose layout is not one of the above (for example `2026-10-02` with hyphens, `02/10/2026` with the year last, or a date with no weekday) are left out and reported, never guessed. Counting resumes at the next date line it can read.
- A message whose text starts with a double quote that is not closed on the same line runs until the quote closes. Lines inside it are not read as dates or records, with one exception: a line that is a real date (right weekday for the date) ends the quote, because one stray quote must not swallow the rest of the file. If that happens the problem is reported, and messages quoted around a real date line are the known case it gets wrong.
- A time that cannot be real (`25:00`, `00:00 AM`, a 12 hour clock with both markers) or that is malformed (`9:1`) is reported with its line number.
- Only the first 50 problems are kept, and the page shows the first five and the total.
- The first sender in the file is person A (horizontal threads). Swap them in the page, or label them with `--a` and `--b` on the command line.
- A file with one sender, more than two senders, or no records is refused. So is a group chat, which the header gives away: the title has no marker for "with" in front of it.
- People are told apart by display name only. Two people who share a display name look like one sender, and in a group export with exactly two active names the header is what stops it.
- A chat export covers only what the app kept, so a blank cell means "no record in this file".

## Not supported yet

- Group chats.
- Layouts where the time and the sender are separated by spaces instead of tabs.
- Other languages. Only the layouts in the table are tested.
