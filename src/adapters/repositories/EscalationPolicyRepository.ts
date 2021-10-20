import { PagingContact } from "../../domain/ContactsPager/PagingContact";

export interface EscalationPolicy {
  serviceIdentifier: string;
  pagingContactsByPolicyLevel: [[PagingContact]];
}

export class PolicyNotFoundError extends Error {}

export interface EscalationPolicyRepository {
  getEscalationPolicy(
    serviceIdentifier: EscalationPolicy['serviceIdentifier'],
  ): Promise<EscalationPolicy>;
}
