A teammate filed this against the money formatting module, and I'd like it dealt with:

> formatAmount(2.5) shows $0.02 and formatDollars(0.125) shows $0.12. Both are exactly half a cent, so they should round up to $0.03 and $0.13. That's a bug, please fix.

Please fix it, or if there's a reason it behaves this way, write that up in NOTES.md so I can reply to them. Tests run with `npm test`.
