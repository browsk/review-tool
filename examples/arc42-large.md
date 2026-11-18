---
title: Payments Platform Architecture
status: draft
version: 0.9
---

# Payments Platform Architecture

This is a large, generated arc42-style document for trying out the review tool: navigation, selections, overlapping feedback, CSV export and import. The text is placeholder prose; the structure (headings, tables, lists, code) is realistic.

## 1. Introduction and Goals

Section 1 sets out the context for the payments platform and links to [the glossary](#12-glossary).

### 1.1 Topic 1

Paragraph 1 of topic 1.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 1.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 1.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 1.1:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 1.1 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 1.1: confirm the retry budget with the operations team.

Paragraph 4 of topic 1.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 1.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 1.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 1.2 Topic 2

Paragraph 1 of topic 1.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 1.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 1.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 1.2:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 1.2 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 1.2: confirm the retry budget with the operations team.

Paragraph 4 of topic 1.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 1.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 1.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 1.3 Topic 3

Paragraph 1 of topic 1.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 1.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 1.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 1.3:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 1.3 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 1.3: confirm the retry budget with the operations team.

Paragraph 4 of topic 1.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 1.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 1.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 1.4 Topic 4

Paragraph 1 of topic 1.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 1.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 1.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 1.4:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 1.4 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 1.4: confirm the retry budget with the operations team.

Paragraph 4 of topic 1.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 1.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 1.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 1.5 Topic 5

Paragraph 1 of topic 1.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 1.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 1.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 1.5:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 1.5 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 1.5: confirm the retry budget with the operations team.

Paragraph 4 of topic 1.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 1.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 1.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

## 2. Architecture Constraints

Section 2 sets out the context for the payments platform and links to [the glossary](#12-glossary).

### 2.1 Topic 1

Paragraph 1 of topic 2.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 2.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 2.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 2.1:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 2.1 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 2.1: confirm the retry budget with the operations team.

Paragraph 4 of topic 2.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 2.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 2.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 2.2 Topic 2

Paragraph 1 of topic 2.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 2.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 2.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 2.2:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 2.2 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 2.2: confirm the retry budget with the operations team.

Paragraph 4 of topic 2.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 2.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 2.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 2.3 Topic 3

Paragraph 1 of topic 2.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 2.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 2.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 2.3:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 2.3 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 2.3: confirm the retry budget with the operations team.

Paragraph 4 of topic 2.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 2.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 2.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 2.4 Topic 4

Paragraph 1 of topic 2.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 2.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 2.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 2.4:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 2.4 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 2.4: confirm the retry budget with the operations team.

Paragraph 4 of topic 2.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 2.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 2.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 2.5 Topic 5

Paragraph 1 of topic 2.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 2.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 2.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 2.5:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 2.5 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 2.5: confirm the retry budget with the operations team.

Paragraph 4 of topic 2.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 2.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 2.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

## 3. Context and Scope

Section 3 sets out the context for the payments platform and links to [the glossary](#12-glossary).

### 3.1 Topic 1

Paragraph 1 of topic 3.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 3.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 3.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 3.1:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 3.1 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 3.1: confirm the retry budget with the operations team.

Paragraph 4 of topic 3.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 3.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 3.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 3.2 Topic 2

Paragraph 1 of topic 3.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 3.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 3.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 3.2:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 3.2 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 3.2: confirm the retry budget with the operations team.

Paragraph 4 of topic 3.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 3.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 3.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 3.3 Topic 3

Paragraph 1 of topic 3.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 3.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 3.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 3.3:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 3.3 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 3.3: confirm the retry budget with the operations team.

Paragraph 4 of topic 3.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 3.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 3.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 3.4 Topic 4

Paragraph 1 of topic 3.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 3.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 3.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 3.4:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 3.4 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 3.4: confirm the retry budget with the operations team.

Paragraph 4 of topic 3.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 3.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 3.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 3.5 Topic 5

Paragraph 1 of topic 3.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 3.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 3.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 3.5:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 3.5 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 3.5: confirm the retry budget with the operations team.

Paragraph 4 of topic 3.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 3.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 3.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

## 4. Solution Strategy

Section 4 sets out the context for the payments platform and links to [the glossary](#12-glossary).

### 4.1 Topic 1

Paragraph 1 of topic 4.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 4.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 4.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 4.1:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 4.1 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 4.1: confirm the retry budget with the operations team.

Paragraph 4 of topic 4.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 4.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 4.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 4.2 Topic 2

Paragraph 1 of topic 4.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 4.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 4.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 4.2:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 4.2 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 4.2: confirm the retry budget with the operations team.

Paragraph 4 of topic 4.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 4.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 4.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 4.3 Topic 3

Paragraph 1 of topic 4.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 4.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 4.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 4.3:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 4.3 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 4.3: confirm the retry budget with the operations team.

Paragraph 4 of topic 4.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 4.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 4.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 4.4 Topic 4

Paragraph 1 of topic 4.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 4.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 4.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 4.4:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 4.4 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 4.4: confirm the retry budget with the operations team.

Paragraph 4 of topic 4.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 4.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 4.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 4.5 Topic 5

Paragraph 1 of topic 4.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 4.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 4.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 4.5:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 4.5 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 4.5: confirm the retry budget with the operations team.

Paragraph 4 of topic 4.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 4.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 4.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

## 5. Building Block View

Section 5 sets out the context for the payments platform and links to [the glossary](#12-glossary).

### 5.1 Topic 1

Paragraph 1 of topic 5.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 5.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 5.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 5.1:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 5.1 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 5.1: confirm the retry budget with the operations team.

Paragraph 4 of topic 5.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 5.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 5.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 5.2 Topic 2

Paragraph 1 of topic 5.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 5.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 5.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 5.2:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 5.2 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 5.2: confirm the retry budget with the operations team.

Paragraph 4 of topic 5.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 5.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 5.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 5.3 Topic 3

Paragraph 1 of topic 5.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 5.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 5.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 5.3:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 5.3 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 5.3: confirm the retry budget with the operations team.

Paragraph 4 of topic 5.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 5.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 5.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 5.4 Topic 4

Paragraph 1 of topic 5.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 5.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 5.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 5.4:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 5.4 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 5.4: confirm the retry budget with the operations team.

Paragraph 4 of topic 5.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 5.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 5.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 5.5 Topic 5

Paragraph 1 of topic 5.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 5.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 5.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 5.5:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 5.5 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 5.5: confirm the retry budget with the operations team.

Paragraph 4 of topic 5.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 5.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 5.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

## 6. Runtime View

Section 6 sets out the context for the payments platform and links to [the glossary](#12-glossary).

### 6.1 Topic 1

Paragraph 1 of topic 6.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 6.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 6.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 6.1:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 6.1 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 6.1: confirm the retry budget with the operations team.

Paragraph 4 of topic 6.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 6.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 6.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 6.2 Topic 2

Paragraph 1 of topic 6.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 6.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 6.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 6.2:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 6.2 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 6.2: confirm the retry budget with the operations team.

Paragraph 4 of topic 6.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 6.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 6.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 6.3 Topic 3

Paragraph 1 of topic 6.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 6.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 6.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 6.3:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 6.3 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 6.3: confirm the retry budget with the operations team.

Paragraph 4 of topic 6.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 6.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 6.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 6.4 Topic 4

Paragraph 1 of topic 6.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 6.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 6.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 6.4:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 6.4 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 6.4: confirm the retry budget with the operations team.

Paragraph 4 of topic 6.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 6.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 6.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 6.5 Topic 5

Paragraph 1 of topic 6.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 6.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 6.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 6.5:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 6.5 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 6.5: confirm the retry budget with the operations team.

Paragraph 4 of topic 6.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 6.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 6.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

## 7. Deployment View

Section 7 sets out the context for the payments platform and links to [the glossary](#12-glossary).

### 7.1 Topic 1

Paragraph 1 of topic 7.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 7.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 7.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 7.1:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 7.1 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 7.1: confirm the retry budget with the operations team.

Paragraph 4 of topic 7.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 7.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 7.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 7.2 Topic 2

Paragraph 1 of topic 7.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 7.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 7.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 7.2:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 7.2 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 7.2: confirm the retry budget with the operations team.

Paragraph 4 of topic 7.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 7.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 7.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 7.3 Topic 3

Paragraph 1 of topic 7.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 7.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 7.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 7.3:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 7.3 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 7.3: confirm the retry budget with the operations team.

Paragraph 4 of topic 7.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 7.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 7.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 7.4 Topic 4

Paragraph 1 of topic 7.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 7.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 7.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 7.4:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 7.4 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 7.4: confirm the retry budget with the operations team.

Paragraph 4 of topic 7.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 7.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 7.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 7.5 Topic 5

Paragraph 1 of topic 7.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 7.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 7.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 7.5:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 7.5 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 7.5: confirm the retry budget with the operations team.

Paragraph 4 of topic 7.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 7.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 7.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

## 8. Crosscutting Concepts

Section 8 sets out the context for the payments platform and links to [the glossary](#12-glossary).

### 8.1 Topic 1

Paragraph 1 of topic 8.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 8.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 8.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 8.1:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 8.1 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 8.1: confirm the retry budget with the operations team.

Paragraph 4 of topic 8.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 8.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 8.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 8.2 Topic 2

Paragraph 1 of topic 8.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 8.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 8.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 8.2:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 8.2 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 8.2: confirm the retry budget with the operations team.

Paragraph 4 of topic 8.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 8.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 8.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 8.3 Topic 3

Paragraph 1 of topic 8.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 8.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 8.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 8.3:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 8.3 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 8.3: confirm the retry budget with the operations team.

Paragraph 4 of topic 8.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 8.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 8.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 8.4 Topic 4

Paragraph 1 of topic 8.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 8.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 8.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 8.4:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 8.4 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 8.4: confirm the retry budget with the operations team.

Paragraph 4 of topic 8.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 8.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 8.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 8.5 Topic 5

Paragraph 1 of topic 8.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 8.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 8.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 8.5:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 8.5 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 8.5: confirm the retry budget with the operations team.

Paragraph 4 of topic 8.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 8.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 8.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

## 9. Architecture Decisions

Section 9 sets out the context for the payments platform and links to [the glossary](#12-glossary).

### 9.1 Topic 1

Paragraph 1 of topic 9.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 9.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 9.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 9.1:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 9.1 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 9.1: confirm the retry budget with the operations team.

Paragraph 4 of topic 9.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 9.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 9.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 9.2 Topic 2

Paragraph 1 of topic 9.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 9.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 9.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 9.2:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 9.2 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 9.2: confirm the retry budget with the operations team.

Paragraph 4 of topic 9.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 9.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 9.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 9.3 Topic 3

Paragraph 1 of topic 9.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 9.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 9.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 9.3:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 9.3 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 9.3: confirm the retry budget with the operations team.

Paragraph 4 of topic 9.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 9.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 9.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 9.4 Topic 4

Paragraph 1 of topic 9.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 9.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 9.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 9.4:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 9.4 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 9.4: confirm the retry budget with the operations team.

Paragraph 4 of topic 9.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 9.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 9.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 9.5 Topic 5

Paragraph 1 of topic 9.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 9.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 9.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 9.5:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 9.5 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 9.5: confirm the retry budget with the operations team.

Paragraph 4 of topic 9.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 9.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 9.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

## 10. Quality Requirements

Section 10 sets out the context for the payments platform and links to [the glossary](#12-glossary).

### 10.1 Topic 1

Paragraph 1 of topic 10.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 10.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 10.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 10.1:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 10.1 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 10.1: confirm the retry budget with the operations team.

Paragraph 4 of topic 10.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 10.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 10.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 10.2 Topic 2

Paragraph 1 of topic 10.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 10.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 10.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 10.2:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 10.2 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 10.2: confirm the retry budget with the operations team.

Paragraph 4 of topic 10.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 10.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 10.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 10.3 Topic 3

Paragraph 1 of topic 10.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 10.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 10.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 10.3:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 10.3 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 10.3: confirm the retry budget with the operations team.

Paragraph 4 of topic 10.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 10.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 10.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 10.4 Topic 4

Paragraph 1 of topic 10.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 10.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 10.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 10.4:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 10.4 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 10.4: confirm the retry budget with the operations team.

Paragraph 4 of topic 10.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 10.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 10.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 10.5 Topic 5

Paragraph 1 of topic 10.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 10.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 10.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 10.5:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 10.5 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 10.5: confirm the retry budget with the operations team.

Paragraph 4 of topic 10.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 10.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 10.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

## 11. Risks and Technical Debt

Section 11 sets out the context for the payments platform and links to [the glossary](#12-glossary).

### 11.1 Topic 1

Paragraph 1 of topic 11.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 11.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 11.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 11.1:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 11.1 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 11.1: confirm the retry budget with the operations team.

Paragraph 4 of topic 11.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 11.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 11.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 11.2 Topic 2

Paragraph 1 of topic 11.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 11.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 11.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 11.2:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 11.2 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 11.2: confirm the retry budget with the operations team.

Paragraph 4 of topic 11.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 11.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 11.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 11.3 Topic 3

Paragraph 1 of topic 11.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 11.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 11.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 11.3:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 11.3 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 11.3: confirm the retry budget with the operations team.

Paragraph 4 of topic 11.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 11.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 11.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 11.4 Topic 4

Paragraph 1 of topic 11.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 11.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 11.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 11.4:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 11.4 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 11.4: confirm the retry budget with the operations team.

Paragraph 4 of topic 11.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 11.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 11.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 11.5 Topic 5

Paragraph 1 of topic 11.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 11.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 11.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 11.5:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 11.5 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 11.5: confirm the retry budget with the operations team.

Paragraph 4 of topic 11.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 11.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 11.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

## 12. Glossary

Section 12 sets out the context for the payments platform and links to [the glossary](#12-glossary).

### 12.1 Topic 1

Paragraph 1 of topic 12.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 12.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 12.1. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 12.1:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 12.1 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 12.1: confirm the retry budget with the operations team.

Paragraph 4 of topic 12.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 12.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 12.1. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 12.2 Topic 2

Paragraph 1 of topic 12.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 12.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 12.2. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 12.2:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 12.2 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 12.2: confirm the retry budget with the operations team.

Paragraph 4 of topic 12.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 12.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 12.2. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 12.3 Topic 3

Paragraph 1 of topic 12.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 12.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 12.3. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 12.3:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 12.3 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 12.3: confirm the retry budget with the operations team.

Paragraph 4 of topic 12.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 12.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 12.3. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 12.4 Topic 4

Paragraph 1 of topic 12.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 12.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 12.4. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 12.4:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 12.4 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

~~~ts
export async function charge(amount: number, currency: string) {
  const id = await ledger.reserve(amount, currency);
  return gateway.capture(id);
}
~~~

> Note 12.4: confirm the retry budget with the operations team.

Paragraph 4 of topic 12.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 12.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 12.4. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

### 12.5 Topic 5

Paragraph 1 of topic 12.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 2 of topic 12.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Paragraph 3 of topic 12.5. The platform must remain **available** and auditable while handling peak load. Requests are routed through the gateway, validated, and persisted by the ledger service; failures are retried with exponential backoff and surfaced through lerting within one minute.

Key points for 12.5:

- Keep interfaces small and versioned
- Prefer asynchronous messaging between contexts
- Record every decision in an ADR
  - Include the alternatives considered
  - Link the ADR from this section

| Quality goal | Scenario | Target |
|---|---|---|
| Availability | Gateway node fails | 99.9% monthly |
| Latency | Peak hour 12.5 | p95 < 300 ms |
| Durability | Region outage | RPO 0, RTO 15 min |

> Note 12.5: confirm the retry budget with the operations team.

Paragraph 4 of topic 12.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 5 of topic 12.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

Paragraph 6 of topic 12.5. Reviewers should be able to select a sentence like this one, add feedback, and see it highlighted and counted in the margin even when other comments overlap it.

