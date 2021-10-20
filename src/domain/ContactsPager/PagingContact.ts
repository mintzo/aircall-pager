export enum CONTACT_PAGING_METHODS {
  EMAIL,
  PHONE,
}

export interface PagingContact {
  phoneNumber: string;
  email: string;
  contactBy: [CONTACT_PAGING_METHODS];
  pageContact(): Promise<void>;
}
