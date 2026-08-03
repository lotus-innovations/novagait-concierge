/**
 * Novagait Concierge embeddable chat widget (spec 01 task 6).
 *
 * Built with esbuild to public/widget.js as a self-contained IIFE: no
 * framework, no external assets, styles inside a shadow root so host-page
 * CSS and widget CSS cannot collide. The same bundle powers the floating
 * launcher on the clinic site (cross-origin, CORS-allowlisted) and the
 * inline standalone page at /chat.
 *
 * Embed (documented in README):
 *   <script src="https://concierge.lotusinnovations.io/widget.js" defer
 *           data-ngc-auto="1"></script>
 *
 * Programmatic:
 *   NovagaitConcierge.init({ mode: "inline", target: "#chat-root" });
 *
 * Accessibility bar (spec 01 §8): full keyboard operability, focus trap
 * while the floating panel is open with focus restore on close, new
 * messages announced via a polite live region, visible focus, AA contrast
 * in both themes, reduced-motion respected, 44px minimum targets.
 */

import css from "./widget.css";

declare const __WIDGET_VERSION__: string;

interface InitOptions {
  /** "floating" (launcher bottom-right, default) or "inline" (fills target). */
  mode?: "floating" | "inline";
  /** Element or selector to mount into (required for inline mode). */
  target?: string | HTMLElement;
  /** Chat API endpoint; defaults to /api/chat on the script's own origin. */
  endpoint?: string;
  /** Panel heading. */
  title?: string;
}

interface ChatResponse {
  reply?: string;
  sources?: string[];
  mocked?: boolean;
  handoff?: boolean;
  capped?: boolean;
  capacity?: boolean;
  rateLimited?: boolean;
  error?: string;
}

const SESSION_KEY = "ngc:sessionId";
const MAX_MESSAGE_CHARS = 1000;
const CONTACT_URL = "https://lotusinnovations.io/#contact";
const GENERIC_ERROR =
  "The concierge is briefly unavailable. Please try again in a moment.";
const GREETING =
  "Hi! I'm the Novagait concierge, an AI assistant demo. Ask me about " +
  "services, insurance, hours, or booking an appointment. I answer only " +
  "from the demo clinic's own documents and cite my sources.";

const CHAT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H9.4L5.7 19.7A1 1 0 0 1 4 19v-3.2A2.5 2.5 0 0 1 4 13.5v-8Z" fill="currentColor"/></svg>';
const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

/** The executing <script> element, captured synchronously at load. */
const ownScript = document.currentScript as HTMLScriptElement | null;

function defaultEndpoint(): string {
  try {
    if (ownScript?.src) return new URL("/api/chat", ownScript.src).toString();
  } catch {
    /* fall through to same-origin */
  }
  return "/api/chat";
}

function getSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing;
    const id = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    // Storage unavailable (e.g. blocked third-party context): session lives
    // for the lifetime of the page instead.
    return crypto.randomUUID();
  }
}

class ConciergeWidget {
  private readonly mode: "floating" | "inline";
  private readonly endpoint: string;
  private readonly sessionId: string;
  private readonly host: HTMLElement;
  private readonly root: ShadowRoot;

  private panel!: HTMLElement;
  private launcher: HTMLButtonElement | null = null;
  private closeBtn: HTMLButtonElement | null = null;
  private messages!: HTMLElement;
  private typing!: HTMLElement;
  private form!: HTMLFormElement;
  private input!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;

  private busy = false;
  private ended = false;
  private greeted = false;

  constructor(options: InitOptions) {
    this.mode = options.mode ?? "floating";
    this.endpoint = options.endpoint ?? defaultEndpoint();
    this.sessionId = getSessionId();

    this.host = document.createElement("div");
    this.host.id = "novagait-concierge";
    this.root = this.host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = css;
    this.root.appendChild(style);

    const wrapper = document.createElement("div");
    wrapper.className =
      this.mode === "floating" ? "root-floating" : "root-inline";
    this.root.appendChild(wrapper);

    this.buildPanel(wrapper, options.title ?? "Novagait Concierge");

    if (this.mode === "floating") {
      this.buildLauncher(wrapper);
      document.body.appendChild(this.host);
    } else {
      const target =
        typeof options.target === "string"
          ? document.querySelector<HTMLElement>(options.target)
          : (options.target ?? null);
      if (!target) {
        throw new Error(
          "NovagaitConcierge: inline mode needs a valid `target` element",
        );
      }
      target.appendChild(this.host);
      this.panel.hidden = false;
      this.greetOnce();
    }
  }

  // ---------- DOM construction ----------

  private buildLauncher(wrapper: HTMLElement): void {
    const launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "launcher";
    launcher.setAttribute("aria-haspopup", "dialog");
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Open Novagait concierge chat");
    launcher.innerHTML = CHAT_ICON;
    launcher.addEventListener("click", () => this.open());
    wrapper.appendChild(launcher);
    this.launcher = launcher;
  }

  private buildPanel(wrapper: HTMLElement, title: string): void {
    const panel = document.createElement("section");
    panel.className = "panel";
    panel.hidden = true;
    if (this.mode === "floating") {
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
    } else {
      panel.setAttribute("role", "region");
    }
    panel.setAttribute("aria-label", title);

    const header = document.createElement("header");
    header.className = "header";
    const headerText = document.createElement("div");
    headerText.className = "header-text";
    const heading = document.createElement("h2");
    heading.className = "title";
    heading.textContent = title;
    const tagline = document.createElement("p");
    tagline.className = "tagline";
    tagline.textContent = "AI assistant demo. All data is synthetic.";
    headerText.append(heading, tagline);
    header.appendChild(headerText);

    if (this.mode === "floating") {
      const close = document.createElement("button");
      close.type = "button";
      close.className = "close";
      close.setAttribute("aria-label", "Close chat");
      close.innerHTML = CLOSE_ICON;
      close.addEventListener("click", () => this.close());
      header.appendChild(close);
      this.closeBtn = close;
    }
    panel.appendChild(header);

    const messages = document.createElement("div");
    messages.className = "messages";
    messages.setAttribute("role", "log");
    messages.setAttribute("aria-live", "polite");
    messages.setAttribute("aria-label", "Conversation");
    panel.appendChild(messages);
    this.messages = messages;

    const typing = document.createElement("p");
    typing.className = "typing";
    typing.textContent = "Concierge is replying";
    typing.hidden = true;
    typing.setAttribute("aria-hidden", "true");
    messages.appendChild(typing);
    this.typing = typing;

    const form = document.createElement("form");
    form.className = "composer";
    const label = document.createElement("label");
    label.className = "sr-only";
    label.htmlFor = "ngc-input";
    label.textContent = "Message the concierge";
    const input = document.createElement("textarea");
    input.id = "ngc-input";
    input.rows = 2;
    input.maxLength = MAX_MESSAGE_CHARS;
    input.required = true;
    input.className = "input";
    input.placeholder = "Ask about services, insurance, booking…";
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    const send = document.createElement("button");
    send.type = "submit";
    send.className = "send";
    send.textContent = "Send";
    form.append(label, input, send);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      void this.send();
    });
    panel.appendChild(form);
    this.form = form;
    this.input = input;
    this.sendBtn = send;

    const footnote = document.createElement("p");
    footnote.className = "footnote";
    footnote.textContent =
      "Demo by Lotus Innovations. Fictional clinic; conversations are " +
      "visible in the demo admin panel.";
    panel.appendChild(footnote);

    panel.addEventListener("keydown", (e) => this.onPanelKeydown(e));
    wrapper.appendChild(panel);
    this.panel = panel;
  }

  // ---------- Open / close / focus management ----------

  open(): void {
    if (this.mode !== "floating") return;
    this.panel.hidden = false;
    if (this.launcher) {
      this.launcher.style.display = "none";
      this.launcher.setAttribute("aria-expanded", "true");
    }
    this.greetOnce();
    if (this.input.disabled) {
      this.closeBtn?.focus();
    } else {
      this.input.focus();
    }
  }

  close(): void {
    if (this.mode !== "floating") return;
    this.panel.hidden = true;
    if (this.launcher) {
      this.launcher.style.display = "";
      this.launcher.setAttribute("aria-expanded", "false");
      this.launcher.focus();
    }
  }

  private onPanelKeydown(e: KeyboardEvent): void {
    if (this.mode !== "floating" || this.panel.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
      return;
    }
    if (e.key !== "Tab") return;
    // Focus trap while the dialog is open (spec 01 §8).
    const focusables = Array.from(
      this.panel.querySelectorAll<HTMLElement>(
        "button, textarea, a[href], input, select",
      ),
    ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = (this.root.activeElement ?? null) as HTMLElement | null;
    if (e.shiftKey && (active === first || active === null)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  private greetOnce(): void {
    if (this.greeted) return;
    this.greeted = true;
    this.appendBot(GREETING, []);
  }

  // ---------- Messages ----------

  private appendParagraphs(container: HTMLElement, text: string): void {
    for (const part of text.split(/\n{2,}/)) {
      const p = document.createElement("p");
      p.textContent = part.trim();
      if (p.textContent) container.appendChild(p);
    }
  }

  private appendUser(text: string): void {
    const msg = document.createElement("div");
    msg.className = "msg msg-user";
    const who = document.createElement("span");
    who.className = "sr-only";
    who.textContent = "You said:";
    msg.appendChild(who);
    this.appendParagraphs(msg, text);
    this.messages.insertBefore(msg, this.typing);
    this.scrollToEnd();
  }

  private appendBot(text: string, sources: string[]): void {
    const msg = document.createElement("div");
    msg.className = "msg msg-bot";
    const who = document.createElement("span");
    who.className = "sr-only";
    who.textContent = "Concierge said:";
    msg.appendChild(who);
    this.appendParagraphs(msg, text);
    if (sources.length > 0) {
      const src = document.createElement("p");
      src.className = "sources";
      src.textContent = `From: ${sources.join(" · ")}`;
      msg.appendChild(src);
    }
    this.messages.insertBefore(msg, this.typing);
    this.scrollToEnd();
  }

  private appendNotice(text: string, kind: "info" | "error"): HTMLElement {
    const notice = document.createElement("div");
    notice.className = kind === "error" ? "notice notice-error" : "notice";
    this.appendParagraphs(notice, text);
    this.messages.insertBefore(notice, this.typing);
    this.scrollToEnd();
    return notice;
  }

  private scrollToEnd(): void {
    this.messages.scrollTop = this.messages.scrollHeight;
  }

  private endConversation(placeholder: string): void {
    this.ended = true;
    this.input.disabled = true;
    this.input.placeholder = placeholder;
    this.sendBtn.disabled = true;
  }

  // ---------- Send flow ----------

  private async send(): Promise<void> {
    const message = this.input.value.trim();
    if (!message || this.busy || this.ended) return;

    this.busy = true;
    this.sendBtn.disabled = true;
    this.appendUser(message);
    this.input.value = "";
    this.typing.hidden = false;
    this.scrollToEnd();

    let body: ChatResponse | null = null;
    let status = 0;
    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: this.sessionId, message }),
      });
      status = res.status;
      body = (await res.json()) as ChatResponse;
    } catch {
      body = null;
    }

    this.typing.hidden = true;

    if (!body) {
      this.appendNotice(GENERIC_ERROR, "error");
    } else if (status === 429 || body.rateLimited) {
      this.appendNotice(body.reply ?? GENERIC_ERROR, "info");
    } else if (body.error || !body.reply) {
      this.appendNotice(body.error ?? GENERIC_ERROR, "error");
    } else {
      this.appendBot(body.reply, body.sources ?? []);
      if (body.handoff) {
        this.appendNotice(
          "This conversation was shared with the front desk team " +
            "(demo: the follow-up is simulated).",
          "info",
        );
      }
      if (body.capped) {
        const notice = this.appendNotice(
          "Demo conversation complete. ",
          "info",
        );
        const link = document.createElement("a");
        link.href = CONTACT_URL;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = "Book a live walkthrough with Lotus Innovations";
        notice.querySelector("p")?.appendChild(link);
        this.endConversation("Demo conversation complete");
      }
      if (body.capacity) {
        this.endConversation("Daily demo capacity reached");
      }
    }

    this.busy = false;
    if (!this.ended) {
      this.sendBtn.disabled = false;
      this.input.focus();
    }
  }
}

// ---------- Public API + auto-init ----------

let instance: ConciergeWidget | null = null;

const api = {
  version: __WIDGET_VERSION__,
  init(options: InitOptions = {}): ConciergeWidget {
    if (!instance) instance = new ConciergeWidget(options);
    return instance;
  },
  open(): void {
    instance?.open();
  },
  close(): void {
    instance?.close();
  },
};

declare global {
  interface Window {
    NovagaitConcierge: typeof api;
  }
}

window.NovagaitConcierge = api;

if (ownScript?.dataset.ngcAuto === "1") {
  const options: InitOptions = {
    mode: ownScript.dataset.ngcMode === "inline" ? "inline" : "floating",
    target: ownScript.dataset.ngcTarget,
    endpoint: ownScript.dataset.ngcEndpoint,
    title: ownScript.dataset.ngcTitle,
  };
  const boot = (): void => {
    api.init(options);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}
