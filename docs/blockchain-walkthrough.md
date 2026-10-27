# Blockchain, visually

> Several independent participants keep copies of a shared history. Each participant checks the records, their links, and their mining work before accepting a longer history.

This walkthrough follows the implementation in [`src/server.js`](../src/server.js) and [`src/client.js`](../src/client.js). Read the diagrams from top to bottom when presenting to someone new. Hashes shown with `...` are shortened, illustrative examples.

## 1. A hash is a block's fingerprint

The same inputs always produce the same fingerprint. Changing any input changes the fingerprint. The block stores the result so another participant can calculate it again and check that it matches.

```mermaid
flowchart LR
    accTitle: How a block gets its fingerprint
    accDescr: Five block fields are encoded in a fixed-order JSON array and hashed with SHA-256 to produce a 64-character fingerprint.
    Fields["Block number<br/>Timestamp<br/>Record text<br/>Previous block's hash<br/>Nonce"]
    Encode["Put those five fields<br/>in a fixed-order JSON array"]
    Hash["SHA-256<br/>Calculate the fingerprint"]
    Result["Block hash<br/>64 hexadecimal characters"]

    Fields --> Encode --> Hash --> Result

    classDef input fill:#dbeafe,stroke:#2563eb,color:#172554;
    classDef work fill:#fef3c7,stroke:#d97706,color:#451a03;
    classDef result fill:#dcfce7,stroke:#16a34a,color:#052e16;
    class Fields input;
    class Encode,Hash work;
    class Result result;
```

**Say:** "A hash lets every participant independently check the fingerprint of a record."

## 2. The fingerprints connect the history

Each new block contains the previous block's hash. The arrows show the order of the records; the labels show which fingerprint the next block stores.

```mermaid
flowchart LR
    accTitle: Hashes connect consecutive blocks
    accDescr: Every block after genesis stores the previous block's hash, linking the records into a chain.
    Genesis["Genesis: shared starting block<br/>hash: H0"]
    First["Block 1: First shared record<br/>previousHash: H0<br/>hash: 000abc..."]
    Second["Block 2: Second shared record<br/>previousHash: 000abc...<br/>hash: 000def..."]

    Genesis -->|"Copy H0 into the next block"| First
    First -->|"Copy 000abc... into the next block"| Second

    classDef genesis fill:#f1f5f9,stroke:#64748b,color:#0f172a;
    classDef block fill:#dbeafe,stroke:#2563eb,color:#172554;
    class Genesis genesis;
    class First,Second block;
```

The genesis block is identical on every node and is exempt from mining. Every later block must satisfy the mining requirement.

**Say:** "Each block carries a reference to the history before it. That is what makes this a chain."

## 3. Mining searches for a qualifying fingerprint

The nonce is a number the miner can change. At difficulty **3**, a mined hash must begin with **`000`**. Each attempt recalculates the entire hash with a different nonce.

```mermaid
flowchart TD
    accTitle: Mining at difficulty three
    accDescr: A miner repeatedly changes the nonce and recalculates the hash until it begins with three zeroes, then appends the block and shares the chain.
    Record["Receive record text"] --> Parent["Link to the current last block<br/>Start nonce at 0"]
    Parent --> Calculate["Calculate the block's SHA-256 hash"]
    Calculate --> Target{"Does the hash<br/>begin with 000?"}
    Target -->|"No"| Retry["Increase nonce by 1"]
    Retry --> Calculate
    Target -->|"Yes"| Append["Append the mined block"]
    Append --> Share["Share the updated chain"]

    classDef input fill:#dbeafe,stroke:#2563eb,color:#172554;
    classDef work fill:#fef3c7,stroke:#d97706,color:#451a03;
    classDef success fill:#dcfce7,stroke:#16a34a,color:#052e16;
    class Record,Parent input;
    class Calculate,Target,Retry work;
    class Append,Share success;
```

There are 16 hexadecimal digits, so three leading zeroes take about **16 x 16 x 16 = 4,096 attempts on average**. The actual number varies. Another participant can verify the winning hash with one calculation.

This diagram shows a successful mining job. The server also checks input and chain limits, allows one job per node, and discards stale work if the chain changes during mining.

**Say:** "Finding a qualifying fingerprint takes work. Checking the answer is quick."

## 4. Two independent nodes synchronize

`127.0.0.1` means this computer. Ports `3000` and `3001` let two independent node processes run on the same laptop. Node B's `PEERS` setting tells it to connect to A. That socket connection carries messages in both directions.

```mermaid
sequenceDiagram
    accTitle: Two nodes synchronize over sockets
    accDescr: Node B connects to A. A mines a record requested by the terminal client and shares its updated chain. B validates the longer chain and adopts it.
    actor Presenter
    participant Client as Terminal client
    participant A as Node A, port 3000
    participant B as Node B, port 3001

    Note over A,B: Each node starts with the same genesis block
    B->>A: Connect using PEERS=http://127.0.0.1:3000
    A-->>B: chain:full - current chain
    B->>A: chain:propose - B's current chain
    Presenter->>Client: mine First shared record
    Client->>A: mine:start - record text
    loop Search until the hash begins with 000
        A->>A: Calculate a hash using the next nonce
        A-->>Client: mine:progress - sampled attempts
    end
    A->>A: Append the mined block
    A-->>Client: block:new, mine:done, chain:full
    A-->>B: chain:full - updated chain
    B->>B: Validate every block, then compare lengths
    B->>B: Adopt the longer valid chain
    Note over A,B: Both copies now have the same latest hash
```

Either node can mine. On reconnect, B offers its current chain again, including any blocks mined while disconnected. Progress events are available for visualizers; the terminal client displays chain summaries and mining completion, with full block details available through `view`.

**Say:** "The second participant checks the history for itself before adopting it."

## 5. Changing an old record leaves evidence

Validation recalculates each hash, checks the links and timestamps, and verifies proof of work. A proposal must pass all checks before its length matters.

```mermaid
flowchart TD
    accTitle: Why editing an old record is detectable
    accDescr: Editing a record changes its hash. Keeping the original hash fails validation, updating it breaks following links, and repairing the history requires valid mining work before comparison by length.
    Edit["Someone edits an old record"] --> Stored{"Keep the old<br/>stored hash?"}
    Stored -->|"Yes"| Mismatch["Recalculated hash differs<br/>Reject: contents do not match the hash"]
    Stored -->|"No: recalculate it"| Links{"Do following blocks<br/>still reference the old hash?"}
    Links -->|"Yes"| Broken["Links no longer match<br/>Reject the proposed chain"]
    Links -->|"No: repair the links too"| Work["Redo the necessary mining work<br/>for the edited block and its descendants"]
    Work --> Validate["Validate the complete proposed chain"]
    Validate --> Compare["Only a valid, longer chain can replace this node's history"]

    classDef change fill:#fef3c7,stroke:#d97706,color:#451a03;
    classDef reject fill:#fee2e2,stroke:#dc2626,color:#450a0a;
    classDef verify fill:#dbeafe,stroke:#2563eb,color:#172554;
    class Edit,Stored,Links,Work change;
    class Mismatch,Broken reject;
    class Validate,Compare verify;
```

A fully re-mined alternative history can be accepted if it is valid and longer. The rules establish consistency and work; they cannot establish whether arbitrary record text is true or authorize a payment.

**Say:** "Changing an old record means dealing with its fingerprint, every later link, and the mining requirements."

## 6. Validation comes before choosing a history

Difficulty is fixed across the network, so a longer valid chain represents more work. A chain with more blocks still has to pass every validation check.

```mermaid
flowchart TD
    accTitle: Validate a proposed history before comparing lengths
    accDescr: Invalid chains are rejected. A valid longer chain is adopted. Shorter chains are ignored. Equal-length chains are either already synchronized or remain tied until a branch grows.
    Receive["Receive a proposed chain"] --> Valid{"Are all blocks, hashes,<br/>links, timestamps and<br/>mining proofs valid?"}
    Valid -->|"No"| Reject["Reject: invalid<br/>Keep the current history"]
    Valid -->|"Yes"| Longer{"Is it longer than<br/>the current chain?"}
    Longer -->|"Yes"| Adopt["Adopt the valid longer chain<br/>Share it with peers"]
    Longer -->|"No"| Shorter{"Is it shorter?"}
    Shorter -->|"Yes"| Keep["Keep the current history<br/>It represents more work"]
    Shorter -->|"No: equal length"| Same{"Do the latest<br/>hashes match?"}
    Same -->|"Yes"| Synced["Already synchronized"]
    Same -->|"No"| Tie["Valid fork: equal work<br/>Keep the current branch<br/>until one becomes longer"]

    classDef check fill:#dbeafe,stroke:#2563eb,color:#172554;
    classDef reject fill:#fee2e2,stroke:#dc2626,color:#450a0a;
    classDef success fill:#dcfce7,stroke:#16a34a,color:#052e16;
    classDef wait fill:#fef3c7,stroke:#d97706,color:#451a03;
    class Receive,Valid,Longer,Shorter,Same check;
    class Reject reject;
    class Adopt,Synced success;
    class Keep,Tie wait;
```

**Say:** "A longer history wins only after every block passes validation."

## 7. A fork resolves when one valid branch grows

Two participants can mine different valid blocks while disconnected. When they reconnect with equal-length histories, each keeps its branch. In the automated demo, B then mines one more block and A adopts B's longer valid branch.

```mermaid
flowchart LR
    accTitle: How an equal-work fork resolves
    accDescr: A shared history splits into two valid branches. At equal length each participant retains its own branch. B mines another block, A validates that longer branch, and both converge on B's branch.
    Shared["Shared history"] --> A1["A's next block<br/>Branch A"]
    Shared --> B1["B's next block<br/>Branch B"]
    A1 -.->|"Equal length at reconnect"| Tie["Each node keeps its own branch"]
    B1 -.-> Tie
    B1 --> B2["B mines one additional block"]
    B2 --> Check["A validates B's longer chain"]
    Check --> Agree["Both nodes use branch B"]

    classDef shared fill:#f1f5f9,stroke:#64748b,color:#0f172a;
    classDef branch fill:#dbeafe,stroke:#2563eb,color:#172554;
    classDef wait fill:#fef3c7,stroke:#d97706,color:#451a03;
    classDef success fill:#dcfce7,stroke:#16a34a,color:#052e16;
    class Shared shared;
    class A1,B1,Check branch;
    class Tie wait;
    class B2,Agree success;
```

**Say:** "A temporary disagreement can happen between honest participants. One additional valid block resolves this fork."

## Show it running

From the project folder, with Node.js 20 or later:

```bash
npm install
npm run demo
```

The four `PASS` messages demonstrate synchronization, rejection of a longer fabricated chain, an equal-work fork, and resolution after one branch grows. To show the additional validation and networking checks, run:

```bash
npm test
```

The project stores text records in memory. Restarting a node resets its history. The terminal client and socket API are implemented; a browser visualizer can connect through that API.
