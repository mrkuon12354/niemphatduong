// info.js — Trang "Giới thiệu" và "Chính sách riêng tư".

import { S } from './strings.js';
import { el, button, pageTitle, card } from './ui.js';

const doneButton = (ctx) => button(S.common.done, { variant: 'primary', onclick: ctx.goBack });

export function renderAbout(page, ctx) {
  page.append(
    pageTitle(S.about.title),
    card(S.about.purposeTitle, ...S.about.purpose.map((text) => el('p', {}, text))),
    card(S.about.principlesTitle,
      el('ul', { class: 'list' }, S.about.principles.map((text) => el('li', {}, text)))),
    card(S.about.draftTitle, el('p', {}, S.about.draft)),
    doneButton(ctx));
}

export function renderPrivacy(page, ctx) {
  page.append(
    pageTitle(S.privacy.title),
    ...S.privacy.items.map((item) => card(item.heading, el('p', {}, item.body))),
    doneButton(ctx));
}
