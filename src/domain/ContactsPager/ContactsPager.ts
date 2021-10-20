import { singleton } from 'tsyringe';
import { PagingContact } from './PagingContact';

@singleton()
export class ContactsPager {
  constructor() {}
  async pageContacts(contactsToPage: [PagingContact]) {
    Promise.all(contactsToPage.map((contact) => contact.pageContact()));
  }
}
