// info.js — Trang "Giới thiệu" và "Chính sách riêng tư".

import { S } from './strings.js';
import { el, pageTitle, card } from './ui.js';

const backLink = () =>
  el('a', { class: 'btn btn-secondary', href: '#/cai-dat' }, S.common.back);

export function renderAbout(page) {
  page.append(
    pageTitle(S.about.title),
    card(S.about.purposeTitle, ...S.about.purpose.map((text) => el('p', {}, text))),
    card(S.about.principlesTitle,
      el('ul', { class: 'list' }, S.about.principles.map((text) => el('li', {}, text)))),
    card(S.about.draftTitle, el('p', {}, S.about.draft)),
    backLink());
}

export function renderPrivacy(page) {
  page.append(
    pageTitle(S.privacy.title),
    ...S.privacy.items.map((item) => card(item.heading, el('p', {}, item.body))),
    backLink());
}
