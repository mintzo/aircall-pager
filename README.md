# aircall-pager
this repository is the homework assingment sent to me by Aircall (19/10/2021)

[Assignament description](https://github.com/aircall/technical-test-pager)

---
## How To Run Tests

1) clone repository to a machine with node > 12
2) in the repository directory run `npm i`
3) in the repository directory run `npm test`

## Folder Structure
- `/domain` :  contains code related to core domain logic (Business Logic)
- `/adapters` :  contains code related to interfaces with outer services (DB/API)
- `/adapters/repositories` :  contains code related to data access (DAL)
- `/infrastructure` : contains code related to local infrastructure such as logging

## TLDR;
the class [PagingCoordinator](src/domain/PagingCoordinator/PagingCoordinator.ts) should be triggered by "Alerting Service" and "Timer Adapter"

`processAlert()` handles incoming alerts and `processEscalationRequest()` handles "timer events" 

the class [IncidentManagement](src/domain/IncidentManagement/IncidentManagement.ts) should be triggered by the "Engineer web console"



_______

# ToDo (Notes for Reviewer):
- add distributed lock mechanism when checking if alert exists and when checking if theres a need to escalate ( currently because of the async nature there is a possibility that 2 or more calls can run this critical code )
- test coverage was set to 0% for convenience (should be at least 80%)
- missing alot of tests, and logs.
- pageContacts function and logic is not implemented , should be by contactMethod array.