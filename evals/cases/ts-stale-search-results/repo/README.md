# catalog-search

The client-side logic behind the product search box. `src/search-box.ts` turns what the user types into requests and keeps the state the UI draws; `src/render.ts` turns that state into text lines.

## Using it

```ts
const box = createSearchBox(fetchResults);   // fetchResults(query) returns a promise of results
box.subscribe((state) => redraw(state));
box.setQuery("react hooks");                 // call on every keystroke
box.getState();                              // { query, results, loading, error }
```

`fetchResults` is injected, so the box never touches the network itself and tests can fake it. Several boxes can exist on one page (the header and the catalog page each have one); they are independent.

## Behavior

- `state.query` is exactly what the user typed. The request uses the trimmed text.
- A query shorter than `minLength` (default 2, after trimming) sends nothing: results are cleared, `loading` is false and `error` is null.
- Otherwise every `setQuery` sends a request, even for a query that was sent before. `loading` is true and `error` is null until the answer arrives; the previous results stay visible meanwhile.
- When the answer arrives, `results` are replaced and `loading` goes false. If the request fails, `results` are cleared, `loading` goes false and `error` holds the error's message.
- Listeners are called after every state change, with the new state.
- The results on screen always belong to the most recent `setQuery`. Responses and errors from earlier requests are ignored: they change nothing, and they don't notify listeners.

`getState()` returns a snapshot; mutating it does not affect the box.
