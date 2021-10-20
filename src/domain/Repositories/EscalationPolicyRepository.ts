import { PagingContact } from "../ContactsPager/PagingContact";

export interface EscalationPolicy {
  serviceIdentifier: string;
  pagingContactsByPolicyLevel: [[PagingContact]];
}

export class PolicyFoundError extends Error {}

export interface EscalationPolicyRepository {
  getEscalationPolicy(
    serviceIdentifier: EscalationPolicy['serviceIdentifier'],
  ): Promise<EscalationPolicy>;
}
