# Word library

Add your words and phrases to `words.txt` as comma-separated, double-quoted entries.

```text
"aardvark", "aardwolf", "baboon", "badger", "crocodile",
"elephant", "flamingo", "giraffe", "hedgehog", "jaguar"
```

Rules:

- Put every entry inside double quotes.
- Separate entries with commas.
- You can continue the list across multiple lines, but keep a comma between entries even when an entry ends a line.
- Spaces inside an entry are preserved, so phrases are supported.
- A comma inside a word or phrase is allowed because the entry is quoted.
- To include a double quote inside an entry, write it twice (`""`).
- Duplicate entries are ignored without regard to capitalization.
- Blank lines and whitespace around entries are ignored.
- Each entry can contain up to 80 characters.

The project contains no sample words. Supply at least five entries for the five daily rounds. The same supplied library is used for every daily puzzle; five entries are selected deterministically for each date.
