# orders-api

A small orders service. `src/paginate.ts` splits any list into pages for the list endpoints in `src/orders.ts`.

Pages are numbered from 1. A page past the end is empty. With no items there are no pages.
