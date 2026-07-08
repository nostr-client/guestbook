# guestbook

**A comment section for any website, stored on nostr.** NIP-22 (kind 1111)
comments addressed to the page URL. No server, no Disqus, no tracker, no
moderation queue you have to host. No build step. One file:
[`guestbook.js`](guestbook.js).

**Live (comment on it!):** https://nostr-client.github.io/guestbook/

```html
<script type="module" src="https://nostr-client.github.io/guestbook/guestbook.js"></script>
<nostr-guestbook></nostr-guestbook>
```

That's the whole integration — login included (NIP-07 extension, guest key,
or pasted key). Comments default to the canonical page URL
(origin + pathname); pin a specific thread with `url="https://…"`.

- comments are [note](https://github.com/nostr-client/note) cards: rich
  content, profiles, live streaming as new ones arrive
- interoperable: any NIP-22 client sees the same comments for the same URL
- the site owner owns nothing and can't lose your comments — they're the
  commenter's events on the commenter's relays

Part of [nostr-client](https://nostr-client.github.io/). AGPL-3.0-or-later.
