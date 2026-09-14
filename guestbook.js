/**
 * guestbook.js — <nostr-guestbook>, comments for ANY web page, stored on
 * nostr (NIP-22, kind 1111). No build step, no server, no Disqus.
 *
 * Part of https://github.com/nostr-client — one repo, one thing.
 * License: AGPL-3.0-or-later
 *
 * Drop TWO TAGS on any website and it has a comment section with login:
 *
 *   <script type="module" src="https://nostr-client.github.io/guestbook/guestbook.js"></script>
 *   <nostr-guestbook></nostr-guestbook>
 *
 * Comments are addressed to the page URL (canonicalized: origin + pathname;
 * override with the url attribute). Anyone reading the same URL in any
 * NIP-22 client sees the same comments — the site owner owns nothing,
 * hosts nothing, moderates via their own client.
 */

import { defaultPool } from 'https://nostr-client.github.io/pool/pool.js'
import 'https://nostr-client.github.io/note/note.js'
import 'https://nostr-client.github.io/login/login.js'

const COMMENT_KIND = 1111

export const canonicalUrl = (href = location.href) => {
  const u = new URL(href)
  return u.origin + u.pathname
}

const TEMPLATE = /* html */ `
<style>
  :host { display: block;
    font-family: var(--nc-font, ui-sans-serif, system-ui, sans-serif);
    font-size: .95rem; color: var(--nc-ink, #201d26); }
  .top { display: flex; justify-content: space-between; align-items: center;
    gap: 1rem; margin-bottom: .8rem; flex-wrap: wrap; }
  .top strong { font-size: 1.02rem; }
  .top .n { color: var(--nc-faint, #a8a4b0); font-weight: 400; }
  form { display: grid; gap: .5rem; margin-bottom: 1rem; }
  textarea { font: inherit; padding: .6em .7em; min-height: 3.6em; line-height: 1.5;
    border-radius: var(--nc-radius-sm, 9px); border: 1px solid var(--nc-line, #e9e6e0);
    background: var(--nc-surface, #fff); color: inherit; resize: vertical;
    width: 100%; box-sizing: border-box; }
  textarea:focus { outline: 2px solid var(--nc-accent, #7a5cff); outline-offset: 1px;
    border-color: var(--nc-accent, #7c3aed); }
  .row { display: flex; justify-content: space-between; align-items: center; gap: .6rem; }
  .hint { font-size: .8rem; color: var(--nc-soft, #6d6a76); }
  button { font: inherit; cursor: pointer; border: none; border-radius: 999px;
    padding: .5em 1.4em; font-weight: 650;
    background: var(--nc-accent, #7c3aed); color: var(--nc-accent-ink, #fff); }
  button:disabled { opacity: .45; cursor: default; }
  #comments { display: grid; gap: .65rem; }
  .empty { text-align: center; color: var(--nc-faint, #a8a4b0); padding: 1.4rem;
    border: 1px dashed var(--nc-line, #e9e6e0); border-radius: var(--nc-radius, 14px); }
  .status { font-size: .8rem; color: var(--nc-soft, #6d6a76); }
  .powered { font-size: .72rem; color: var(--nc-faint, #a8a4b0); margin-top: .8rem;
    text-align: right; }
  .powered a { color: inherit; }
</style>
<div class="top">
  <strong>Comments <span class="n" id="count"></span></strong>
  <nostr-login></nostr-login>
</div>
<form id="form">
  <textarea id="text" placeholder="Say something…"></textarea>
  <div class="row"><span class="hint" id="hint"></span><button id="send">Comment</button></div>
  <div class="status" id="status"></div>
</form>
<div id="comments"></div>
<div class="powered">comments live on <a href="https://nostr-client.github.io/guestbook/" target="_blank" rel="noopener">nostr</a> — no server, no tracker</div>
`

class NostrGuestbook extends HTMLElement {
  static observedAttributes = ['url']

  constructor() {
    super()
    this.attachShadow({ mode: 'open' }).innerHTML = TEMPLATE
    this.$ = (id) => this.shadowRoot.getElementById(id)
    this.sub = null
    this.seen = new Set()
    this.count = 0
    this._onAuth = () => this._refreshAuth()
  }

  connectedCallback() {
    window.addEventListener('nostr:login', this._onAuth)
    window.addEventListener('nostr:logout', this._onAuth)
    this.$('form').onsubmit = (e) => { e.preventDefault(); this._publish() }
    this._refreshAuth()
    this._load()
  }

  disconnectedCallback() {
    window.removeEventListener('nostr:login', this._onAuth)
    window.removeEventListener('nostr:logout', this._onAuth)
    this.sub?.close()
  }

  attributeChangedCallback(_n, o, n) { if (o !== n && this.isConnected) this._load() }

  get url() { return this.getAttribute('url') || canonicalUrl() }

  _refreshAuth() {
    const on = !!window.nostrSigner
    this.$('send').disabled = !on
    this.$('hint').textContent = on ? '' : 'log in above to comment — takes 10 seconds, no signup'
  }

  _load() {
    this.sub?.close()
    this.$('comments').innerHTML = ''
    this.seen.clear()
    this.count = 0
    const empty = document.createElement('div')
    empty.className = 'empty'
    empty.textContent = 'No comments yet — start the conversation.'
    this.$('comments').append(empty)
    this.sub = defaultPool().subscribe(
      [{ kinds: [COMMENT_KIND], '#I': [this.url], limit: 100 }],
      { onEvent: (event) => this._add(event) }
    )
  }

  _add(event) {
    if (this.seen.has(event.id)) return
    this.seen.add(event.id)
    this.count++
    this.$('count').textContent = '· ' + this.count
    this.shadowRoot.querySelector('.empty')?.remove()
    const note = document.createElement('nostr-note')
    note.event = event
    note.dataset.ts = event.created_at
    const list = this.$('comments')
    let next = null
    for (const el of list.children) {
      if (Number(el.dataset.ts) < event.created_at) { next = el; break }
    }
    list.insertBefore(note, next)
  }

  async _publish() {
    const content = this.$('text').value.trim()
    if (!content || !window.nostrSigner) return
    const send = this.$('send')
    send.disabled = true
    this.$('status').textContent = 'publishing…'
    try {
      const event = await window.nostrSigner.signEvent({
        kind: COMMENT_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['I', this.url], ['K', 'web'],   // NIP-22 root scope: this page
          ['i', this.url], ['k', 'web'],   // parent = root for top-level comments
        ],
        content,
      })
      const results = await defaultPool().publish(event)
      const ok = results.filter((r) => r.ok).length
      if (!ok) throw new Error('no relay accepted the comment')
      this.$('status').textContent = ''
      this.$('text').value = ''
      this._add(event)
      this.dispatchEvent(new CustomEvent('nostr:published', {
        detail: { event, results }, bubbles: true, composed: true,
      }))
    } catch (err) {
      this.$('status').textContent = '✗ ' + (err.message || err)
    } finally {
      send.disabled = false
    }
  }
}

if (!customElements.get('nostr-guestbook')) customElements.define('nostr-guestbook', NostrGuestbook)
